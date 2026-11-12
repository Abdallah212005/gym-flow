import { getGym } from "@/lib/server-auth";
import {
  errorResponse,
  getActiveSupportSession,
  HttpError,
  recordSupportAudit,
  requireUser,
  SUPPORT_SESSION_COOKIE,
  SUPPORT_SESSION_DURATION_MS,
} from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

async function requireSuperAdmin() {
  const session = await requireUser();
  if (session.profile.role !== "super_admin") throw new HttpError("هذه الصفحة مخصصة لمدير المنصة.", 403);
  return session;
}

function supportCookie(value: string, maxAge: number) {
  return `${SUPPORT_SESSION_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export async function GET() {
  try {
    await requireSuperAdmin();
    const { data, error } = await getSupabaseAdminClient()
      .from("support_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const sessions = await Promise.all(data.map(async (session) => {
      const expiresAt = Date.parse(session.expires_at);
      const expired = session.active && (!Number.isFinite(expiresAt) || expiresAt <= Date.now());
      const expiredAt = expired ? new Date().toISOString() : "";
      if (expired) {
        const { error: updateError } = await getSupabaseAdminClient()
          .from("support_sessions")
          .update({ active: false, ended_at: expiredAt, end_reason: "expired" })
          .eq("id", session.id);
        if (updateError) throw updateError;
        const { error: eventError } = await getSupabaseAdminClient().from("support_events").insert({
          session_id: session.id,
          action: "session.end",
          details: { reason: "expired" },
          admin_uid: session.admin_uid,
          admin_email: session.admin_email,
          gym_id: session.gym_id,
          created_at: expiredAt,
        });
        if (eventError) throw eventError;
      }
      const { data: events, error: eventError } = await getSupabaseAdminClient()
        .from("support_events")
        .select("id,action,details,admin_uid,admin_email,gym_id,created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (eventError) throw eventError;
      return {
        id: session.id,
        adminUid: session.admin_uid,
        adminEmail: session.admin_email,
        gymId: session.gym_id,
        gymName: session.gym_name,
        active: expired ? false : session.active,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        lastActivityAt: session.last_activity_at,
        ...(expired ? { endedAt: expiredAt } : session.ended_at ? { endedAt: session.ended_at } : {}),
        ...(session.end_reason ? { endReason: session.end_reason } : {}),
        events: events.reverse().map((event) => ({
          id: String(event.id),
          action: event.action,
          details: event.details,
          adminUid: event.admin_uid,
          adminEmail: event.admin_email,
          gymId: event.gym_id,
          createdAt: event.created_at,
        })),
      };
    }));
    return Response.json({ sessions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const body = await request.json() as { gymId?: unknown };
    if (typeof body.gymId !== "string" || !body.gymId.trim() || body.gymId.trim().length > 128 || body.gymId.includes("/")) {
      throw new HttpError("معرّف النادي غير صالح.", 400);
    }
    const gymId = body.gymId.trim();
    const gym = await getGym(gymId);
    if (!gym) throw new HttpError("النادي غير موجود.", 404);
    const db = getSupabaseAdminClient();

    const previousSession = await getActiveSupportSession(request, user.decoded.uid);
    if (previousSession) {
      const now = new Date().toISOString();
      await recordSupportAudit(previousSession, "session.end", { reason: "switched" });
      const { error } = await db.from("support_sessions")
        .update({ active: false, ended_at: now, end_reason: "switched" })
        .eq("id", previousSession.id);
      if (error) throw error;
    }

    const id = crypto.randomUUID();
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SUPPORT_SESSION_DURATION_MS);
    const { error } = await db.from("support_sessions").insert({
      id,
      admin_uid: user.decoded.uid,
      admin_email: user.profile.email,
      gym_id: gymId,
      gym_name: gym.name,
      active: true,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_activity_at: startedAt.toISOString(),
    });
    if (error) throw error;

    const supportSession = {
      id,
      gymId,
      adminUid: user.decoded.uid,
      adminEmail: user.profile.email,
    };
    try {
      await recordSupportAudit(supportSession, "session.start", { gymName: gym.name });
    } catch (error) {
      const { error: updateError } = await db.from("support_sessions")
        .update({ active: false, ended_at: new Date().toISOString(), end_reason: "audit_failed" })
        .eq("id", id);
      if (updateError) console.error("Could not close support session after audit failure:", updateError);
      throw error;
    }

    const response = Response.json({ gym });
    response.headers.append("Set-Cookie", supportCookie(id, SUPPORT_SESSION_DURATION_MS / 1000));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const supportSession = await getActiveSupportSession(request, user.decoded.uid);
    if (supportSession) {
      await recordSupportAudit(supportSession, "session.end", { reason: "manual" });
      const { error } = await getSupabaseAdminClient()
        .from("support_sessions")
        .update({ active: false, ended_at: new Date().toISOString(), end_reason: "manual" })
        .eq("id", supportSession.id);
      if (error) throw error;
    }

    const response = Response.json({ ended: true });
    response.headers.append("Set-Cookie", supportCookie("", 0));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
