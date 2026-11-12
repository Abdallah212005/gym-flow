import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase";

export const SUPPORT_SESSION_COOKIE = "gymflow_support_session";
export const SUPPORT_SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
export const SUPER_ADMIN_EMAIL = "aamr222382@gmail.com";
export const LOGIN_EMAIL_DOMAIN = "users.gymflow.app";

export type GymStatus = "pending" | "active" | "expired" | "suspended";
export type GymRole = "owner" | "manager" | "employee";

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  gymId?: string;
  role: "super_admin" | GymRole;
  permissions: string[];
  createdAt?: string;
};

export type GymProfile = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  subscriptionStatus: GymStatus;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
};

export type SupportSession = {
  id: string;
  gymId: string;
  adminUid: string;
  adminEmail: string;
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function normalizeUsername(value: unknown) {
  if (typeof value !== "string") throw new HttpError("اسم المستخدم مطلوب.", 400);
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new HttpError("اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا إنجليزيًا أو رقمًا.", 400);
  }
  return username;
}

export function requiredText(value: unknown, label: string, maximum = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new HttpError(`${label} مطلوب.`, 400);
  }
  return value.trim();
}

export async function getAuthUser() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user;
}

export function profileFromAuthUser(user: User): UserProfile {
  return {
    uid: user.id,
    email: user.email ?? "",
    displayName: String(user.user_metadata.full_name ?? user.user_metadata.name ?? user.email ?? ""),
    role: "super_admin",
    permissions: ["*"],
  };
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("user_profiles")
    .select("id,email,display_name,username,gym_id,role,permissions,created_at")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    uid: data.id,
    email: data.email,
    displayName: data.display_name,
    ...(data.username ? { username: data.username } : {}),
    ...(data.gym_id ? { gymId: data.gym_id } : {}),
    role: data.role,
    permissions: data.permissions ?? [],
    createdAt: data.created_at,
  };
}

export async function getGym(gymId: string): Promise<GymProfile | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("gyms")
    .select("*")
    .eq("id", gymId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    ownerName: data.owner_name,
    ownerEmail: data.owner_email,
    subscriptionStatus: data.subscription_status,
    subscriptionStartsAt: data.subscription_starts_at,
    subscriptionEndsAt: data.subscription_ends_at,
    createdAt: data.created_at,
  };
}

function getCookieValue(request: Request, name: string) {
  return request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function getActiveSupportSession(request: Request, adminUid: string) {
  const sessionId = getCookieValue(request, SUPPORT_SESSION_COOKIE);
  if (!sessionId || !/^[a-f0-9-]{36}$/i.test(sessionId)) return null;
  const { data, error } = await getSupabaseAdminClient()
    .from("support_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.active || data.admin_uid !== adminUid || Date.parse(data.expires_at) <= Date.now()) return null;
  return {
    id: data.id,
    gymId: data.gym_id,
    adminUid: data.admin_uid,
    adminEmail: data.admin_email,
  } satisfies SupportSession;
}

export async function recordSupportAudit(
  session: SupportSession | null,
  action: string,
  details: Record<string, string | number | boolean | null> = {},
) {
  if (!session) return;
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: current, error: readError } = await db
    .from("support_sessions")
    .select("active,expires_at")
    .eq("id", session.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!current?.active || Date.parse(current.expires_at) <= Date.now()) {
    throw new HttpError("انتهت جلسة الدعم. ابدأ جلسة جديدة للمتابعة.", 401);
  }
  const { error: eventError } = await db.from("support_events").insert({
    session_id: session.id,
    action,
    details,
    admin_uid: session.adminUid,
    admin_email: session.adminEmail,
    gym_id: session.gymId,
    created_at: now,
  });
  if (eventError) throw eventError;
  const { error: updateError } = await db.from("support_sessions")
    .update({ last_activity_at: now })
    .eq("id", session.id)
    .eq("active", true);
  if (updateError) throw updateError;
}

function isExpired(gym: GymProfile) {
  return !gym.subscriptionEndsAt || new Date(gym.subscriptionEndsAt).getTime() <= Date.now();
}

export async function requireUser() {
  const user = await getAuthUser();
  if (!user) throw new HttpError("سجّل الدخول للمتابعة.", 401);
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  const profile = isSuperAdmin ? profileFromAuthUser(user) : await getProfile(user.id);
  if (!profile) throw new HttpError("الحساب غير مرتبط بنادٍ.", 403);
  if (isSuperAdmin) return { decoded: { uid: user.id, email: user.email, name: profile.displayName }, profile, gym: null };
  if (!profile.gymId) throw new HttpError("الحساب غير مرتبط بنادٍ.", 403);
  const gym = await getGym(profile.gymId);
  if (!gym) throw new HttpError("بيانات النادي غير موجودة.", 403);
  return { decoded: { uid: user.id, email: user.email, name: profile.displayName }, profile, gym };
}

export async function requireActiveGym(request: Request, permission?: string) {
  const session = await requireUser();
  if (session.profile.role === "super_admin") {
    const supportSession = await getActiveSupportSession(request, session.decoded.uid);
    if (!supportSession) throw new HttpError("ابدأ جلسة دعم لأحد الأندية من إدارة المنصة.", 403);
    const gym = await getGym(supportSession.gymId);
    if (!gym) throw new HttpError("بيانات النادي غير موجودة.", 404);
    return {
      ...session,
      profile: { ...session.profile, gymId: supportSession.gymId, role: "owner" as const, permissions: ["*"] },
      gym,
      supportSession,
    };
  }

  const { gym } = session;
  if (!gym) throw new HttpError("الحساب غير مرتبط بنادٍ.", 403);
  let status = gym.subscriptionStatus;
  if (status === "active" && isExpired(gym)) {
    status = "expired";
    const { error } = await getSupabaseAdminClient()
      .from("gyms")
      .update({ subscription_status: status })
      .eq("id", gym.id);
    if (error) throw error;
  }
  if (status !== "active") {
    throw new HttpError(`اشتراك النادي ${status === "pending" ? "قيد المراجعة" : status === "suspended" ? "موقوف" : "منتهي"}.`, 403);
  }
  if (permission && session.profile.role !== "owner" && !session.profile.permissions.includes(permission)) {
    throw new HttpError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403);
  }
  return { ...session, supportSession: null };
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return Response.json({ error: "هذا الاسم مستخدم بالفعل." }, { status: 409 });
  }
  console.error("GymFlow API error:", error);
  return Response.json({ error: "حدث خطأ داخلي. حاول مرة أخرى." }, { status: 500 });
}
