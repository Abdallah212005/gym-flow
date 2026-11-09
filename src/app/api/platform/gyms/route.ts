import { getAdminDb } from "@/lib/firebase-admin";
import { errorResponse, HttpError, requireUser } from "@/lib/server-auth";

async function requireSuperAdmin(request: Request) {
  const session = await requireUser(request);
  if (session.profile.role !== "super_admin") throw new HttpError("هذه الصفحة مخصصة لمدير المنصة.", 403);
  return session;
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const gymId = new URL(request.url).searchParams.get("gymId");
    if (gymId) {
      const db = getAdminDb();
      const gymSnapshot = await db.collection("gyms").doc(gymId).get();
      if (!gymSnapshot.exists) throw new HttpError("النادي غير موجود.", 404);
      const gymRef = db.collection("gyms").doc(gymId);
      const collections = ["plans", "attendance", "payments", "staff", "expenses", "reports"] as const;
      const [membersSnapshot, ...collectionSnapshots] = await Promise.all([
        gymRef.collection("members").orderBy("createdAt", "desc").limit(200).get(),
        ...collections.map((name) => gymRef.collection(name).orderBy("createdAt", "desc").limit(200).get()),
      ]);
      return Response.json({
        gym: { ...gymSnapshot.data(), id: gymSnapshot.id },
        members: membersSnapshot.docs.map((document) => ({ ...document.data(), id: document.id })),
        data: Object.fromEntries(collections.map((name, index) => [
          name,
          collectionSnapshots[index].docs.map((document) => ({ ...document.data(), id: document.id })),
        ])),
      });
    }
    const snapshot = await getAdminDb().collection("gyms").orderBy("createdAt", "desc").limit(500).get();
    return Response.json({
      gyms: snapshot.docs.map((document) => ({ ...document.data(), id: document.id })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperAdmin(request);
    const body = await request.json() as {
      gymId?: unknown;
      status?: unknown;
      startsAt?: unknown;
      endsAt?: unknown;
    };
    if (typeof body.gymId !== "string" || !body.gymId) throw new HttpError("معرّف النادي مطلوب.", 400);
    if (!["pending", "active", "expired", "suspended"].includes(String(body.status))) {
      throw new HttpError("حالة الاشتراك غير صالحة.", 400);
    }

    const update: Record<string, unknown> = {
      subscriptionStatus: body.status,
      subscriptionUpdatedAt: new Date().toISOString(),
    };
    if (body.status === "active") {
      if (typeof body.startsAt !== "string" || typeof body.endsAt !== "string") {
        throw new HttpError("حدد تاريخ بداية ونهاية الاشتراك.", 400);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.startsAt) || !/^\d{4}-\d{2}-\d{2}$/.test(body.endsAt)) {
        throw new HttpError("صيغة التاريخ غير صالحة.", 400);
      }
      const start = Date.parse(`${body.startsAt}T00:00:00.000Z`);
      const end = Date.parse(`${body.endsAt}T23:59:59.999Z`);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        throw new HttpError("تاريخ نهاية الاشتراك يجب أن يكون بعد تاريخ بدايته.", 400);
      }
      if (start > Date.now()) throw new HttpError("لا يمكن تفعيل اشتراك يبدأ في تاريخ مستقبلي.", 400);
      update.subscriptionStartsAt = new Date(start).toISOString();
      update.subscriptionEndsAt = new Date(end).toISOString();
    }

    const gymRef = getAdminDb().collection("gyms").doc(body.gymId);
    const snapshot = await gymRef.get();
    if (!snapshot.exists) throw new HttpError("النادي غير موجود.", 404);
    await gymRef.update(update);
    return Response.json({ gym: { ...snapshot.data(), ...update, id: body.gymId } });
  } catch (error) {
    return errorResponse(error);
  }
}
