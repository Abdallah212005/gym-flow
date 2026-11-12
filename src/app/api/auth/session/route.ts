import {
  errorResponse,
  getActiveSupportSession,
  getAuthUser,
  getGym,
  getProfile,
  profileFromAuthUser,
  SUPER_ADMIN_EMAIL,
} from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { connection } from "next/server";
import type { GymAccount, GymAppUser } from "@/lib/gym-data";

export async function GET(request: Request) {
  await connection();
  try {
    const authUser = await getAuthUser();
    if (!authUser) return Response.json({ profile: null, gym: null, supportMode: false });

    const isSuperAdmin = authUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
    const profile: GymAppUser | null = isSuperAdmin
      ? profileFromAuthUser(authUser)
      : await getProfile(authUser.id);
    if (!profile) {
      const providers = authUser.app_metadata.providers;
      const registrationRequired = authUser.app_metadata.provider === "google" ||
        (Array.isArray(providers) && providers.includes("google"));
      return Response.json({
        profile: null,
        gym: null,
        supportMode: false,
        registrationRequired,
        email: authUser.email ?? "",
        displayName: String(authUser.user_metadata.full_name ?? authUser.user_metadata.name ?? ""),
      });
    }

    if (isSuperAdmin) {
      const supportSession = await getActiveSupportSession(request, authUser.id);
      if (!supportSession) return Response.json({ profile, gym: null, supportMode: false });
      const gym = await getGym(supportSession.gymId);
      if (!gym) return Response.json({ error: "بيانات النادي غير موجودة." }, { status: 403 });
      return Response.json({
        profile: { ...profile, gymId: supportSession.gymId, role: "owner", permissions: ["*"] },
        gym,
        supportMode: true,
      });
    }
    if (!profile.gymId) return Response.json({ profile, gym: null, supportMode: false });

    const gym = await getGym(profile.gymId);
    if (!gym) return Response.json({ error: "بيانات النادي غير موجودة." }, { status: 403 });
    if (gym.subscriptionStatus === "active" && typeof gym.subscriptionEndsAt === "string" && Date.parse(gym.subscriptionEndsAt) <= Date.now()) {
      const { error } = await getSupabaseAdminClient()
        .from("gyms")
        .update({ subscription_status: "expired" })
        .eq("id", gym.id);
      if (error) throw error;
      gym.subscriptionStatus = "expired";
    }
    return Response.json({ profile, gym: gym as GymAccount, supportMode: false });
  } catch (error) {
    return errorResponse(error);
  }
}
