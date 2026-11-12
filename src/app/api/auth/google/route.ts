import { getSupabaseServerClient } from "@/lib/supabase";
import { connection } from "next/server";

export async function GET(request: Request) {
  await connection();
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("/api/auth/callback", request.url).toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("Supabase did not return a Google OAuth URL.");
    return Response.redirect(data.url);
  } catch (error) {
    console.error("GymFlow Google OAuth initialization failed:", error);
    return Response.redirect(new URL("/?authError=google", request.url));
  }
}
