import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase";
import { errorResponse, HttpError, normalizeUsername } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    if (typeof body.password !== "string" || !body.password) {
      throw new HttpError("كلمة المرور مطلوبة.", 400);
    }

    const { data: profile, error: profileError } = await getSupabaseAdminClient()
      .from("user_profiles")
      .select("email")
      .eq("username", username)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.email) throw new HttpError("اسم المستخدم أو كلمة المرور غير صحيحة.", 401);

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: body.password,
    });
    if (error) throw new HttpError("اسم المستخدم أو كلمة المرور غير صحيحة.", 401);
    return Response.json({ signedIn: true });
  } catch (error) {
    return errorResponse(error);
  }
}
