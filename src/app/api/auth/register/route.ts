import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  errorResponse,
  LOGIN_EMAIL_DOMAIN,
  normalizeUsername,
  requiredText,
  verifyGoogleIdToken,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  let createdUid: string | undefined;
  try {
    const body = await request.json() as {
      idToken?: unknown;
      username?: unknown;
      password?: unknown;
      gymName?: unknown;
      ownerName?: unknown;
    };
    const decoded = await verifyGoogleIdToken(body.idToken);
    if (decoded.email?.toLowerCase() === "aamr222382@gmail.com") {
      return Response.json({ error: "حساب مدير المنصة لا يسجل ناديًا." }, { status: 403 });
    }
    const username = normalizeUsername(body.username);
    const password = requiredText(body.password, "كلمة المرور", 128);
    if (password.length < 8) return Response.json({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف." }, { status: 400 });
    const gymName = requiredText(body.gymName, "اسم النادي", 100);
    const ownerName = requiredText(body.ownerName, "اسم المالك", 100);

    const auth = getAdminAuth();
    const db = getAdminDb();
    const existingOwner = await db.collection("googleOwners").doc(decoded.uid).get();
    if (existingOwner.exists) return Response.json({ error: "هذا البريد مسجل بالفعل." }, { status: 409 });
    const existingAuthUser = await auth.getUserByEmail(`${username}@${LOGIN_EMAIL_DOMAIN}`).catch((error: unknown) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") return null;
      throw error;
    });
    if (existingAuthUser) return Response.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });

    const gymRef = db.collection("gyms").doc();
    const usernameRef = db.collection("usernames").doc(username);
    const googleOwnerRef = db.collection("googleOwners").doc(decoded.uid);
    const ownerAuth = await auth.createUser({
      email: `${username}@${LOGIN_EMAIL_DOMAIN}`,
      password,
      displayName: ownerName,
      emailVerified: true,
    });
    createdUid = ownerAuth.uid;

    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const usernameSnapshot = await transaction.get(usernameRef);
      const ownerSnapshot = await transaction.get(googleOwnerRef);
      if (usernameSnapshot.exists || ownerSnapshot.exists) {
        throw new Error("USERNAME_OR_OWNER_EXISTS");
      }
      transaction.create(gymRef, {
        name: gymName,
        ownerName,
        ownerEmail: decoded.email,
        googleOwnerUid: decoded.uid,
        subscriptionStatus: "pending",
        subscriptionStartsAt: null,
        subscriptionEndsAt: null,
        createdAt: now,
      });
      transaction.create(usernameRef, { uid: ownerAuth.uid, gymId: gymRef.id });
      transaction.create(googleOwnerRef, { gymId: gymRef.id, ownerUid: ownerAuth.uid, createdAt: now });
      transaction.create(db.collection("users").doc(ownerAuth.uid), {
        uid: ownerAuth.uid,
        email: decoded.email,
        displayName: ownerName,
        username,
        gymId: gymRef.id,
        role: "owner",
        permissions: ["*"],
        createdAt: now,
      });
    });

    return Response.json({ created: true, status: "pending" }, { status: 201 });
  } catch (error) {
    if (createdUid) {
      try {
        await getAdminAuth().deleteUser(createdUid);
      } catch (cleanupError) {
        console.error("Could not remove unlinked Firebase Auth user:", cleanupError);
      }
    }
    if (error instanceof Error && error.message === "USERNAME_OR_OWNER_EXISTS") {
      return Response.json({ error: "اسم المستخدم أو بريد Google مسجل بالفعل." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
