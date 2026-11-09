import { getAdminDb } from "@/lib/firebase-admin";
import {
  errorResponse,
  getGoogleOwnerProfile,
  getProfile,
  getVerifiedSession,
  SESSION_COOKIE,
  SUPER_ADMIN_EMAIL,
} from "@/lib/server-auth";
import type { GymAccount, GymAppUser } from "@/lib/gym-data";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  try {
    const decoded = await getVerifiedSession(cookie);
    if (!decoded) return Response.json({ error: "سجّل الدخول للمتابعة." }, { status: 401 });

    const profile: GymAppUser | null = decoded.email?.toLowerCase() === SUPER_ADMIN_EMAIL
      ? {
          uid: decoded.uid,
          email: SUPER_ADMIN_EMAIL,
          displayName: decoded.name ?? "Super Admin",
          role: "super_admin" as const,
          permissions: ["*"],
        }
      : await getProfile(decoded.uid) ?? await getGoogleOwnerProfile(decoded.uid);
    if (!profile) return Response.json({ error: "الحساب غير مرتبط بنادٍ." }, { status: 403 });
    if (!profile.gymId) return Response.json({ profile, gym: null });

    const gymSnapshot = await getAdminDb().collection("gyms").doc(profile.gymId).get();
    if (!gymSnapshot.exists) return Response.json({ error: "بيانات النادي غير موجودة." }, { status: 403 });
    const gym = { ...gymSnapshot.data(), id: gymSnapshot.id } as GymAccount;
    if (gym.subscriptionStatus === "active" && typeof gym.subscriptionEndsAt === "string" && Date.parse(gym.subscriptionEndsAt) <= Date.now()) {
      await gymSnapshot.ref.update({ subscriptionStatus: "expired" });
      gym.subscriptionStatus = "expired";
    }
    return Response.json({ profile, gym });
  } catch (error) {
    return errorResponse(error);
  }
}
