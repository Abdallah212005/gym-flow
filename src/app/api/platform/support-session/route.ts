import { getAdminDb } from "@/lib/firebase-admin";
import {
  errorResponse,
  getActiveSupportSession,
  HttpError,
  recordSupportAudit,
  requireUser,
  SUPPORT_SESSION_COOKIE,
  SUPPORT_SESSION_DURATION_MS,
} from "@/lib/server-auth";

async function requireSuperAdmin(request: Request) {
  const session = await requireUser(request);
  if (session.profile.role !== "super_admin") throw new HttpError("هذه الصفحة مخصصة لمدير المنصة.", 403);
  return session;
}

function supportCookie(value: string, maxAge: number) {
  return `${SUPPORT_SESSION_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const snapshot = await getAdminDb().collection("supportSessions").orderBy("startedAt", "desc").limit(50).get();
    const sessions = await Promise.all(snapshot.docs.map(async (document) => {
      const session = document.data();
      const expiresAt = typeof session.expiresAt === "string" ? Date.parse(session.expiresAt) : Number.NaN;
      const expired = session.active === true && (!Number.isFinite(expiresAt) || expiresAt <= Date.now());
      const expiredAt = expired ? new Date().toISOString() : "";
      if (expired) {
        await document.ref.update({ active: false, endedAt: expiredAt, endReason: "expired" });
        await document.ref.collection("events").add({
          action: "session.end",
          details: { reason: "expired" },
          adminUid: session.adminUid,
          adminEmail: session.adminEmail,
          gymId: session.gymId,
          createdAt: expiredAt,
        });
      }
      const events = await document.ref.collection("events").orderBy("createdAt", "desc").limit(50).get();
      return {
        id: document.id,
        ...session,
        ...(expired ? { active: false, endedAt: expiredAt } : {}),
        events: events.docs.reverse().map((event) => ({ id: event.id, ...event.data() })),
      };
    }));
    return Response.json({ sessions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin(request);
    const body = await request.json() as { gymId?: unknown };
    if (typeof body.gymId !== "string" || !body.gymId.trim() || body.gymId.trim().length > 128 || body.gymId.includes("/")) {
      throw new HttpError("معرّف النادي غير صالح.", 400);
    }
    const gymId = body.gymId.trim();

    const db = getAdminDb();
    const gymSnapshot = await db.collection("gyms").doc(gymId).get();
    if (!gymSnapshot.exists) throw new HttpError("النادي غير موجود.", 404);

    const previousSession = await getActiveSupportSession(request, user.decoded.uid);
    if (previousSession) {
      const previousRef = db.collection("supportSessions").doc(previousSession.id);
      const now = new Date().toISOString();
      await recordSupportAudit(previousSession, "session.end", { reason: "switched" });
      await previousRef.update({ active: false, endedAt: now, endReason: "switched" });
    }

    const id = crypto.randomUUID();
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SUPPORT_SESSION_DURATION_MS);
    const supportRef = db.collection("supportSessions").doc(id);
    await supportRef.create({
      adminUid: user.decoded.uid,
      adminEmail: user.profile.email,
      gymId,
      gymName: String(gymSnapshot.get("name") ?? ""),
      active: true,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivityAt: startedAt.toISOString(),
    });
    const supportSession = {
      id,
      gymId,
      adminUid: user.decoded.uid,
      adminEmail: user.profile.email,
    };
    try {
      await recordSupportAudit(supportSession, "session.start", {
        gymName: String(gymSnapshot.get("name") ?? ""),
      });
    } catch (error) {
      await supportRef.update({
        active: false,
        endedAt: new Date().toISOString(),
        endReason: "audit_failed",
      });
      throw error;
    }

    const response = Response.json({ gym: { ...gymSnapshot.data(), id: gymSnapshot.id } });
    response.headers.append("Set-Cookie", supportCookie(id, SUPPORT_SESSION_DURATION_MS / 1000));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSuperAdmin(request);
    const supportSession = await getActiveSupportSession(request, user.decoded.uid);
    if (supportSession) {
      await recordSupportAudit(supportSession, "session.end", { reason: "manual" });
      await getAdminDb().collection("supportSessions").doc(supportSession.id).update({
        active: false,
        endedAt: new Date().toISOString(),
        endReason: "manual",
      });
    }

    const response = Response.json({ ended: true });
    response.headers.append("Set-Cookie", supportCookie("", 0));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
