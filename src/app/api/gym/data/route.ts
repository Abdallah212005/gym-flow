import { deleteGymRecord, getGymRecord, insertGymRecord, listGymRecords, updateGymRecord } from "@/lib/gym-records";
import { errorResponse, HttpError, recordSupportAudit, requireActiveGym, requiredText } from "@/lib/server-auth";

const collections = ["plans", "attendance", "payments", "staff", "expenses", "reports"] as const;
type DataCollection = typeof collections[number];

function getCollection(value: string | null): DataCollection {
  if (!collections.includes(value as DataCollection)) throw new HttpError("القسم المطلوب غير مدعوم.", 400);
  return value as DataCollection;
}

function assertPermission(role: string, permissions: string[], permission: string) {
  if (role !== "owner" && !permissions.includes(permission)) {
    throw new HttpError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const collectionNames = url.searchParams.getAll("collection");
    const { gym, profile } = await requireActiveGym(request);
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const names = collectionNames.length
      ? collectionNames.map((name) => getCollection(name))
      : collections.filter((name) => profile.role === "owner" || profile.permissions.includes(`read:${name}`));
    if (profile.role !== "owner" && names.some((name) => !profile.permissions.includes(`read:${name}`))) {
      throw new HttpError("ليس لديك صلاحية لعرض أحد الأقسام المطلوبة.", 403);
    }

    const results = await Promise.all(names.map(async (name) => [
      name,
      await listGymRecords(gym.id, name),
    ] as const));
    return Response.json({ data: Object.fromEntries(results) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { gym, profile, supportSession } = await requireActiveGym(request);
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const body = await request.json() as { collection?: unknown; data?: unknown };
    const collection = getCollection(typeof body.collection === "string" ? body.collection : null);
    assertPermission(profile.role, profile.permissions, `write:${collection}`);
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      throw new HttpError("بيانات غير صالحة.", 400);
    }

    const values = body.data as Record<string, unknown>;
    const now = new Date().toISOString();
    const record: Record<string, unknown> = {
      ...values,
      createdBy: profile.uid,
      createdAt: now,
      updatedAt: now,
    };
    if (collection === "plans") {
      record.name = requiredText(values.name, "اسم الخطة", 80);
      const plans = await listGymRecords(gym.id, "plans");
      if (plans.some((plan) => plan.name === record.name)) throw new HttpError("اسم الخطة مستخدم بالفعل.", 409);
      const durationMonths = Number(values.durationMonths);
      const price = Number(values.price);
      if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 60 || !Number.isFinite(price) || price < 0) {
        throw new HttpError("مدة الخطة أو سعرها غير صالح.", 400);
      }
      record.durationMonths = durationMonths;
      record.price = price;
    } else if (collection === "reports") {
      record.title = requiredText(values.title, "عنوان التقرير", 100);
      record.details = requiredText(values.details, "تفاصيل التقرير", 2000);
      record.status = "جديد";
    }
    const id = crypto.randomUUID();
    await recordSupportAudit(supportSession, "data.create", {
      collection,
      recordId: id,
      fields: Object.keys(values).join(", "),
    });
    const saved = await insertGymRecord(gym.id, collection, record, { id });
    return Response.json({ record: saved }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { gym, profile, supportSession } = await requireActiveGym(request);
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const body = await request.json() as { collection?: unknown; id?: unknown; data?: unknown };
    const collection = getCollection(typeof body.collection === "string" ? body.collection : null);
    assertPermission(profile.role, profile.permissions, `write:${collection}`);
    if (typeof body.id !== "string" || !body.id || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
      throw new HttpError("بيانات غير صالحة.", 400);
    }

    const values = body.data as Record<string, unknown>;
    const allowedFields = collection === "plans" ? ["name", "durationMonths", "price", "active"] : [];
    if (Object.keys(values).some((key) => !allowedFields.includes(key))) {
      throw new HttpError("الحقول المرسلة غير مسموحة.", 400);
    }
    const existing = await getGymRecord(gym.id, collection, body.id);
    if (!existing) throw new HttpError("السجل غير موجود.", 404);
    if (collection === "plans") {
      if (values.name !== undefined) requiredText(values.name, "اسم الخطة", 80);
      if (typeof values.name === "string" && values.name !== existing.payload.name) {
        const plans = await listGymRecords(gym.id, "plans");
        if (plans.some((plan) => plan.id !== body.id && plan.name === values.name)) {
          throw new HttpError("اسم الخطة مستخدم بالفعل.", 409);
        }
      }
      if (values.active !== undefined && typeof values.active !== "boolean") {
        throw new HttpError("حالة الخطة غير صالحة.", 400);
      }
      if (values.durationMonths !== undefined && (!Number.isInteger(values.durationMonths) || Number(values.durationMonths) < 1 || Number(values.durationMonths) > 60)) {
        throw new HttpError("مدة الخطة غير صالحة.", 400);
      }
      if (values.price !== undefined && (!Number.isFinite(values.price) || Number(values.price) < 0)) {
        throw new HttpError("سعر الخطة غير صالح.", 400);
      }
    }

    const updatedPayload = { ...existing.payload, ...values, updatedAt: new Date().toISOString() };
    await recordSupportAudit(supportSession, "data.update", {
      collection,
      recordId: body.id,
      fields: Object.keys(values).join(", "),
    });
    const updated = await updateGymRecord(gym.id, collection, body.id, updatedPayload);
    if (!updated) throw new HttpError("السجل غير موجود.", 404);
    return Response.json({ record: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const collection = getCollection(url.searchParams.get("collection"));
    const id = url.searchParams.get("id");
    const { gym, profile, supportSession } = await requireActiveGym(request);
    if (!gym) throw new HttpError("غير مصرح.", 403);
    assertPermission(profile.role, profile.permissions, `write:${collection}`);
    if (!id) throw new HttpError("معرّف السجل مطلوب.", 400);

    const existing = await getGymRecord(gym.id, collection, id);
    if (!existing) throw new HttpError("السجل غير موجود.", 404);
    await recordSupportAudit(supportSession, "data.delete", { collection, recordId: id });
    const deleted = await deleteGymRecord(gym.id, collection, id);
    if (!deleted) throw new HttpError("السجل غير موجود.", 404);
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
