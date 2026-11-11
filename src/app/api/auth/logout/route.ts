import { getAdminDb } from "@/lib/firebase-admin";
import {
  clearSessionResponse,
  getActiveSupportSession,
  getVerifiedSession,
  recordSupportAudit,
  SESSION_COOKIE,
  SUPPORT_SESSION_COOKIE,
  SUPER_ADMIN_EMAIL,
} from "@/lib/server-auth";

export async function POST(request: Request) {
  const sessionCookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const decoded = await getVerifiedSession(sessionCookie);
  if (decoded?.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
    const supportSession = await getActiveSupportSession(request, decoded.uid);
    if (supportSession) {
      await recordSupportAudit(supportSession, "session.end", { reason: "logout" });
      await getAdminDb().collection("supportSessions").doc(supportSession.id).update({
        active: false,
        endedAt: new Date().toISOString(),
        endReason: "logout",
      });
    }
  }
  const response = clearSessionResponse();
  response.headers.append(
    "Set-Cookie",
    `${SUPPORT_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}
