import { getAdminDb } from "@/lib/firebase-admin";
import { createSessionResponse, errorResponse, HttpError, normalizeUsername, usernameToEmail, type UserProfile } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    if (typeof body.password !== "string" || !body.password) {
      throw new HttpError("كلمة المرور مطلوبة.", 400);
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) throw new Error("Firebase Web API key is not configured.");
    const usernameSnapshot = await getAdminDb().collection("usernames").doc(username).get();
    if (!usernameSnapshot.exists) throw new HttpError("اسم المستخدم أو كلمة المرور غير صحيحة.", 401);

    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: usernameToEmail(username), password: body.password, returnSecureToken: true }),
        cache: "no-store",
      },
    );
    const authResult = await authResponse.json() as { idToken?: string; error?: { message?: string } };
    if (!authResponse.ok || !authResult.idToken) {
      if (authResponse.status >= 500) throw new Error(`Firebase Authentication failed: ${authResult.error?.message ?? authResponse.status}`);
      throw new HttpError("اسم المستخدم أو كلمة المرور غير صحيحة.", 401);
    }

    const uid = usernameSnapshot.data()?.uid;
    if (typeof uid !== "string") throw new Error("Username mapping is invalid.");
    const userSnapshot = await getAdminDb().collection("users").doc(uid).get();
    if (!userSnapshot.exists) throw new Error("Authenticated user profile is missing.");
    const profile = { ...userSnapshot.data(), uid } as UserProfile;
    return createSessionResponse(authResult.idToken, profile);
  } catch (error) {
    return errorResponse(error);
  }
}
