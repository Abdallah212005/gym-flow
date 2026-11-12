import { cookies } from "next/headers";
import {
  getActiveSupportSession,
  getAuthUser,
  recordSupportAudit,
  SUPPORT_SESSION_COOKIE,
  SUPER_ADMIN_EMAIL,
} from "@/lib/server-auth";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
    const supportSession = await getActiveSupportSession(request, user.id);
    if (supportSession) {
      await recordSupportAudit(supportSession, "session.end", { reason: "logout" });
      const { error } = await getSupabaseAdminClient()
        .from("support_sessions")
        .update({ active: false, ended_at: new Date().toISOString(), end_reason: "logout" })
        .eq("id", supportSession.id);
      if (error) throw error;
    }
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  const cookieStore = await cookies();
  cookieStore.set(SUPPORT_SESSION_COOKIE, "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return new Response(null, { status: 204 });
}
