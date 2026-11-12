import { getAuthUser, errorResponse, HttpError, normalizeUsername, requiredText, SUPER_ADMIN_EMAIL } from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user?.email || !user.email_confirmed_at) throw new HttpError("تحقق من حساب Google قبل التسجيل.", 401);
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL) {
      throw new HttpError("حساب مدير المنصة لا يسجل ناديًا.", 403);
    }
    const body = await request.json() as {
      username?: unknown;
      password?: unknown;
      gymName?: unknown;
      ownerName?: unknown;
    };
    const username = normalizeUsername(body.username);
    const password = requiredText(body.password, "كلمة المرور", 128);
    if (password.length < 8) throw new HttpError("كلمة المرور يجب ألا تقل عن 8 أحرف.", 400);
    const gymName = requiredText(body.gymName, "اسم النادي", 100);
    const ownerName = requiredText(body.ownerName, "اسم المالك", 100);
    const db = getSupabaseAdminClient();

    const { data: existingProfile, error: profileError } = await db
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (existingProfile) throw new HttpError("هذا البريد مسجل بالفعل.", 409);

    const { error: authError } = await db.auth.admin.updateUserById(user.id, {
      password,
      user_metadata: { ...user.user_metadata, full_name: ownerName },
    });
    if (authError) throw authError;

    const now = new Date().toISOString();
    const gymId = crypto.randomUUID();
    const { error } = await db.rpc("gymflow_register_gym", {
      p_gym: {
        id: gymId,
        name: gymName,
        owner_name: ownerName,
        owner_email: user.email,
        created_at: now,
      },
      p_profile: {
        id: user.id,
        email: user.email,
        display_name: ownerName,
        username,
        created_at: now,
      },
    });
    if (error?.code === "23505") throw new HttpError("اسم المستخدم أو بريد Google مسجل بالفعل.", 409);
    if (error) throw error;
    return Response.json({ created: true, status: "pending" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
