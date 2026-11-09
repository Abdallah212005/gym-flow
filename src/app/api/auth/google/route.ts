import {
  createSessionResponse,
  errorResponse,
  getGoogleOwnerProfile,
  SUPER_ADMIN_EMAIL,
  verifyGoogleIdToken,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { idToken?: unknown };
    const idToken = body.idToken;
    const decoded = await verifyGoogleIdToken(idToken);
    if (decoded.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
      if (typeof idToken !== "string") return Response.json({ error: "تعذر التحقق من حساب Google." }, { status: 401 });
      return createSessionResponse(idToken, {
        uid: decoded.uid,
        email: SUPER_ADMIN_EMAIL,
        displayName: decoded.name ?? "Super Admin",
        role: "super_admin",
        permissions: ["*"],
      });
    }

    const profile = await getGoogleOwnerProfile(decoded.uid);
    if (profile) {
      if (typeof idToken !== "string") return Response.json({ error: "تعذر التحقق من حساب Google." }, { status: 401 });
      return createSessionResponse(idToken, profile);
    }
    return Response.json({ registrationRequired: true });
  } catch (error) {
    return errorResponse(error);
  }
}
