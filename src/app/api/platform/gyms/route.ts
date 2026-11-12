import { listGymRecords } from "@/lib/gym-records";
import { getGym } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { errorResponse, HttpError, requireUser } from "@/lib/server-auth";

async function requireSuperAdmin() {
  const session = await requireUser();
  if (session.profile.role !== "super_admin") throw new HttpError("هذه الصفحة مخصصة لمدير المنصة.", 403);
  return session;
}

export async function GET(request: Request) {
  try {
    await requireSuperAdmin();
    const gymId = new URL(request.url).searchParams.get("gymId");
    if (gymId) {
      const gym = await getGym(gymId);
      if (!gym) throw new HttpError("النادي غير موجود.", 404);
      const collections = ["plans", "attendance", "payments", "staff", "expenses", "reports"] as const;
      const [members, ...collectionRecords] = await Promise.all([
        listGymRecords(gymId, "members", 200),
        ...collections.map((name) => listGymRecords(gymId, name, 200)),
      ]);
      return Response.json({
        gym,
        members,
        data: Object.fromEntries(collections.map((name, index) => [name, collectionRecords[index]])),
      });
    }

    const { data, error } = await getSupabaseAdminClient()
      .from("gyms")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return Response.json({
      gyms: data.map((gym) => ({
        id: gym.id,
        name: gym.name,
        ownerName: gym.owner_name,
        ownerEmail: gym.owner_email,
        subscriptionStatus: gym.subscription_status,
        subscriptionStartsAt: gym.subscription_starts_at,
        subscriptionEndsAt: gym.subscription_ends_at,
        createdAt: gym.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireSuperAdmin();
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

    const status = body.status as string;
    const update: Record<string, unknown> = {
      subscription_status: status,
      subscription_updated_at: new Date().toISOString(),
    };
    if (status === "active") {
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
      update.subscription_starts_at = new Date(start).toISOString();
      update.subscription_ends_at = new Date(end).toISOString();
    }

    const { data, error } = await getSupabaseAdminClient()
      .from("gyms")
      .update(update)
      .eq("id", body.gymId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError("النادي غير موجود.", 404);
    const gym = await getGym(body.gymId);
    return Response.json({ gym });
  } catch (error) {
    return errorResponse(error);
  }
}
