import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  errorResponse,
  HttpError,
  LOGIN_EMAIL_DOMAIN,
  normalizeUsername,
  recordSupportAudit,
  requireActiveGym,
  requiredText,
} from "@/lib/server-auth";

const validPermissions = new Set([
  "read:members", "write:members", "read:plans", "write:plans",
  "read:attendance", "write:attendance", "read:payments", "write:payments",
  "read:staff", "write:staff", "read:expenses", "write:expenses",
  "read:reports", "write:reports",
]);

export async function GET(request: Request) {
  try {
    const { gym, profile } = await requireActiveGym(request, "manage:team");
    if (!gym || profile.role !== "owner") throw new HttpError("إدارة الموظفين متاحة لمالك النادي فقط.", 403);
    const { data, error } = await getSupabaseAdminClient()
      .from("user_profiles")
      .select("id,display_name,username,role,permissions,created_at")
      .eq("gym_id", gym.id);
    if (error) throw error;
    return Response.json({
      users: data.map((user) => ({
        uid: user.id,
        displayName: user.display_name,
        username: user.username,
        role: user.role,
        permissions: user.permissions ?? [],
        createdAt: user.created_at,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let createdUid: string | undefined;
  try {
    const { gym, profile, supportSession } = await requireActiveGym(request, "manage:team");
    if (!gym || profile.role !== "owner") throw new HttpError("إدارة الموظفين متاحة لمالك النادي فقط.", 403);
    const body = await request.json() as {
      username?: unknown;
      password?: unknown;
      displayName?: unknown;
      role?: unknown;
      permissions?: unknown;
      specialty?: unknown;
      salary?: unknown;
    };
    const username = normalizeUsername(body.username);
    const displayName = requiredText(body.displayName, "اسم الموظف", 100);
    const password = requiredText(body.password, "كلمة المرور", 128);
    if (password.length < 8) throw new HttpError("كلمة المرور يجب ألا تقل عن 8 أحرف.", 400);
    const salary = Number(body.salary);
    if (!Number.isFinite(salary) || salary < 0) throw new HttpError("الراتب غير صالح.", 400);
    const specialty = typeof body.specialty === "string" ? body.specialty.trim().slice(0, 100) : "";
    const role = body.role === "manager" ? "manager" : body.role === "employee" ? "employee" : null;
    if (!role) throw new HttpError("الدور المحدد غير صالح.", 400);
    if (!Array.isArray(body.permissions) || !body.permissions.every((permission) => typeof permission === "string" && validPermissions.has(permission))) {
      throw new HttpError("قائمة الصلاحيات غير صالحة.", 400);
    }
    if (role === "manager" && body.permissions.length === 0) throw new HttpError("اختر صلاحية واحدة على الأقل للمدير.", 400);

    await recordSupportAudit(supportSession, "team.create", { role });
    const permissions = [...new Set(body.permissions as string[])];
    const now = new Date().toISOString();
    const email = `${username}@${LOGIN_EMAIL_DOMAIN}`;
    const db = getSupabaseAdminClient();
    const { data: authResult, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });
    if (authError) {
      if (authError.code === "email_exists" || authError.code === "user_already_exists") {
        throw new HttpError("اسم المستخدم مستخدم بالفعل.", 409);
      }
      throw authError;
    }
    createdUid = authResult.user.id;

    const { error } = await db.rpc("gymflow_create_team_user", {
      p_profile: {
        id: createdUid,
        email,
        display_name: displayName,
        username,
        gym_id: gym.id,
        role,
        permissions,
        created_at: now,
        created_by: profile.uid,
      },
      p_staff: {
        id: createdUid,
        gym_id: gym.id,
        created_at: now,
        payload: {
          uid: createdUid,
          name: displayName,
          username,
          role: role === "manager" ? "مدير" : "موظف",
          specialty,
          salary,
          status: "نشط",
          createdAt: now,
          createdBy: profile.uid,
        },
      },
    });
    if (error?.code === "23505") throw new HttpError("اسم المستخدم مستخدم بالفعل.", 409);
    if (error) throw error;
    return Response.json({
      user: { uid: createdUid, displayName, username, role, permissions, createdAt: now },
    }, { status: 201 });
  } catch (error) {
    if (createdUid) {
      const { error: cleanupError } = await getSupabaseAdminClient().auth.admin.deleteUser(createdUid);
      if (cleanupError) console.error("Could not remove unlinked Supabase Auth user:", cleanupError);
    }
    return errorResponse(error);
  }
}
