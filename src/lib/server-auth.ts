import type { DecodedIdToken, UserRecord } from "firebase-admin/auth";
import type { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export const SESSION_COOKIE = "__session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
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

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
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

export async function verifyGoogleIdToken(idToken: unknown): Promise<DecodedIdToken> {
  if (typeof idToken !== "string" || !idToken) throw new HttpError("تعذر التحقق من حساب Google.", 401);
  let decoded: DecodedIdToken;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken, true);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error &&
      ["auth/invalid-id-token", "auth/id-token-expired", "auth/id-token-revoked"].includes(String(error.code))) {
      throw new HttpError("انتهت صلاحية التحقق من Google. حاول مرة أخرى.", 401);
    }
    throw error;
  }
  if (!decoded.email || decoded.email_verified !== true) {
    throw new HttpError("استخدم حساب Google موثقًا بالبريد الإلكتروني.", 403);
  }
  return decoded;
}

export async function createSessionResponse(
  idToken: string,
  profile: UserProfile,
  extra: Record<string, unknown> = {},
) {
  const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  const response = Response.json({ profile, ...extra });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionCookie}; Max-Age=${SESSION_DURATION_MS / 1000}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}

export async function getVerifiedSession(cookie: string | undefined) {
  if (!cookie) return null;
  try {
    return await getAdminAuth().verifySessionCookie(cookie, true);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("auth/")
    ) {
      return null;
    }
    throw error;
  }
}

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  return { ...snapshot.data(), uid } as UserProfile;
}

export async function getGoogleOwnerProfile(googleUid: string): Promise<UserProfile | null> {
  const db = getAdminDb();
  const ownerLink = await db.collection("googleOwners").doc(googleUid).get();
  if (!ownerLink.exists) return null;

  const ownerData = ownerLink.data();
  if (typeof ownerData?.ownerUid === "string") {
    const profile = await getProfile(ownerData.ownerUid);
    if (profile?.role === "owner" && profile.gymId === ownerData.gymId) return profile;
  }
  if (typeof ownerData?.gymId !== "string") return null;

  const owners = await db.collection("users")
    .where("gymId", "==", ownerData.gymId)
    .where("role", "==", "owner")
    .limit(1)
    .get();
  if (owners.empty) return null;
  return { ...owners.docs[0].data(), uid: owners.docs[0].id } as UserProfile;
}

function isExpired(gym: GymProfile) {
  return !gym.subscriptionEndsAt || new Date(gym.subscriptionEndsAt).getTime() <= Date.now();
}

export async function requireUser(request: Request) {
  const cookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const decoded = await getVerifiedSession(cookie);
  if (!decoded) throw new HttpError("سجّل الدخول للمتابعة.", 401);

  const profile = await getProfile(decoded.uid)
    ?? (decoded.email?.toLowerCase() !== SUPER_ADMIN_EMAIL ? await getGoogleOwnerProfile(decoded.uid) : null);
  if (decoded.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
    return {
      decoded,
      profile: profile ?? {
        uid: decoded.uid,
        email: SUPER_ADMIN_EMAIL,
        displayName: decoded.name ?? "Super Admin",
        role: "super_admin" as const,
        permissions: ["*"],
      },
      gym: null,
    };
  }
  if (!profile?.gymId) throw new HttpError("الحساب غير مرتبط بنادٍ.", 403);

  const gymSnapshot = await getAdminDb().collection("gyms").doc(profile.gymId).get();
  if (!gymSnapshot.exists) throw new HttpError("بيانات النادي غير موجودة.", 403);
  const gym = { ...gymSnapshot.data(), id: gymSnapshot.id } as GymProfile;
  return { decoded, profile, gym };
}

export async function requireActiveGym(request: Request, permission?: string) {
  const session = await requireUser(request);
  if (session.profile.role === "super_admin") return session;

  const { gym } = session;
  if (!gym) throw new HttpError("الحساب غير مرتبط بنادٍ.", 403);
  let status = gym.subscriptionStatus;
  if (status === "active" && isExpired(gym)) {
    status = "expired";
    await getAdminDb().collection("gyms").doc(gym.id).update({ subscriptionStatus: status });
  }
  if (status !== "active") {
    throw new HttpError(`اشتراك النادي ${status === "pending" ? "قيد المراجعة" : status === "suspended" ? "موقوف" : "منتهي"}.`, 403);
  }
  if (permission && session.profile.role !== "owner" && !session.profile.permissions.includes(permission)) {
    throw new HttpError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403);
  }
  return session;
}

export function getDocumentData<T extends DocumentData>(snapshot: DocumentSnapshot<T>) {
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function getUserRecord(uid: string): Promise<UserRecord> {
  return getAdminAuth().getUser(uid);
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error("GymFlow API error:", error);
  return Response.json({ error: "حدث خطأ داخلي. حاول مرة أخرى." }, { status: 500 });
}

export function clearSessionResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    },
  });
}
