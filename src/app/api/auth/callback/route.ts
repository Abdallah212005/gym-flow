import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(new URL("/?authError=google", request.url));

  try {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return Response.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("GymFlow Google OAuth callback failed:", error);
    return Response.redirect(new URL("/?authError=google", request.url));
  }
}
