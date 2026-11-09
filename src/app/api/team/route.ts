import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import {
  errorResponse,
  HttpError,
  LOGIN_EMAIL_DOMAIN,
  normalizeUsername,
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
    const snapshot = await getAdminDb().collection("users").where("gymId", "==", gym.id).get();
    return Response.json({
      users: snapshot.docs.map((document) => {
        const user = document.data();
        return {
          uid: document.id,
          displayName: user.displayName,
          username: user.username,
          role: user.role,
          permissions: user.permissions ?? [],
          createdAt: user.createdAt,
        };
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let createdUid: string | undefined;
  try {
    const { gym, profile } = await requireActiveGym(request, "manage:team");
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

    const auth = getAdminAuth();
    const db = getAdminDb();
    const usernameRef = db.collection("usernames").doc(username);
    const authUser = await auth.createUser({
      email: `${username}@${LOGIN_EMAIL_DOMAIN}`,
      password,
      displayName,
      emailVerified: true,
    });
    createdUid = authUser.uid;
    const userRef = db.collection("users").doc(authUser.uid);
    const staffRef = db.collection("gyms").doc(gym.id).collection("staff").doc(authUser.uid);
    const now = new Date().toISOString();
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(usernameRef);
      if (existing.exists) throw new Error("USERNAME_EXISTS");
      transaction.create(usernameRef, { uid: authUser.uid, gymId: gym.id });
      transaction.create(userRef, {
        uid: authUser.uid,
        email: `${username}@${LOGIN_EMAIL_DOMAIN}`,
        displayName,
        username,
        gymId: gym.id,
        role,
        permissions: [...new Set(body.permissions as string[])],
        createdAt: now,
        createdBy: profile.uid,
      });
      transaction.create(staffRef, {
        uid: authUser.uid,
        name: displayName,
        username,
        role: role === "manager" ? "مدير" : "موظف",
        specialty,
        salary,
        status: "نشط",
        createdAt: now,
        createdBy: profile.uid,
      });
    });
    return Response.json({
      user: {
        uid: authUser.uid,
        displayName,
        username,
        role,
        permissions: [...new Set(body.permissions as string[])],
        createdAt: now,
      },
    }, { status: 201 });
  } catch (error) {
    if (createdUid) {
      try {
        await getAdminAuth().deleteUser(createdUid);
      } catch (cleanupError) {
        console.error("Could not remove unlinked Firebase Auth user:", cleanupError);
      }
    }
    if (error instanceof Error && error.message === "USERNAME_EXISTS") {
      return Response.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/email-already-exists") {
      return Response.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });
    }
    return errorResponse(error);
  }
}
