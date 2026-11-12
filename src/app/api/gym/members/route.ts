import { getGymRecord, listGymRecords } from "@/lib/gym-records";
import {
  errorResponse,
  HttpError,
  recordSupportAudit,
  requireActiveGym,
  requiredText,
} from "@/lib/server-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Member, MemberActivity, MembershipPeriod } from "@/lib/gym-data";
import { getPeriodEndDate, normalizePhoneNumber, toIsoDate } from "@/lib/gym-data";

function memberStatus(endDate: unknown): Member["status"] {
  if (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return "منتهي";
  const [year, month, day] = endDate.split("-").map(Number);
  const end = new Date(year, month - 1, day);
  if (toIsoDate(end) !== endDate) return "منتهي";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remaining = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  return remaining < 0 ? "منتهي" : remaining <= 7 ? "قارب على الانتهاء" : "نشط";
}

function isoDateTime(date: Date) {
  return `${toIsoDate(date)}T${date.toTimeString().slice(0, 5)}`;
}

function mapMemberRpcError(error: { code?: string; message?: string }): never {
  if (error.code === "23505") {
    throw new HttpError("العميل موجود بالفعل. افتح ملفه لتجديد الاشتراك بدلًا من إنشاء ملف جديد.", 409);
  }
  if (error.code === "40001") throw new HttpError("تم تعديل ملف العضو في مكان آخر. حدّث الصفحة ثم حاول مجددًا.", 409);
  if (error.code === "P0002") throw new HttpError("العضو غير موجود.", 404);
  throw error;
}

export async function GET(request: Request) {
  try {
    const { gym } = await requireActiveGym(request, "read:members");
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const members = await listGymRecords(gym.id, "members");
    return Response.json({ members: members as unknown as Member[] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { gym, profile, supportSession } = await requireActiveGym(request, "write:members");
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const body = await request.json() as {
      name?: unknown;
      phone?: unknown;
      plan?: unknown;
      paidAmount?: unknown;
      paymentMethod?: unknown;
    };
    if (profile.role !== "owner" && !profile.permissions.includes("write:members")) {
      throw new HttpError("ليس لديك صلاحية لإضافة أعضاء.", 403);
    }
    const name = requiredText(body.name, "اسم العضو", 100);
    const phone = requiredText(body.phone, "رقم الهاتف", 30);
    const plan = requiredText(body.plan, "الخطة", 80);
    const phoneDigits = normalizePhoneNumber(phone);
    if (phoneDigits.length < 10) throw new HttpError("رقم الهاتف غير مكتمل.", 400);
    const plans = await listGymRecords(gym.id, "plans");
    const selectedPlan = plans.find((item) => item.name === plan && item.active === true);
    if (!selectedPlan) throw new HttpError("اختر خطة اشتراك مفعّلة.", 400);
    const price = Number(selectedPlan.price ?? 0);
    const paidAmount = Number(body.paidAmount ?? 0);
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > price) {
      throw new HttpError("المبلغ المدفوع يجب أن يكون بين صفر وسعر الخطة.", 400);
    }
    let paymentMethod = "";
    if (paidAmount > 0) {
      if (profile.role !== "owner" && !profile.permissions.includes("write:payments")) {
        throw new HttpError("ليس لديك صلاحية لتسجيل دفعة.", 403);
      }
      paymentMethod = requiredText(body.paymentMethod, "طريقة الدفع", 40);
    }
    const durationMonths = Number(selectedPlan.durationMonths);
    if (!Number.isInteger(durationMonths) || durationMonths < 1) throw new HttpError("مدة الخطة غير صالحة.", 500);

    const now = new Date();
    const nowIso = now.toISOString();
    const startDate = toIsoDate(now);
    const endDate = getPeriodEndDate(startDate, durationMonths);
    const memberId = crypto.randomUUID();
    const membership: MembershipPeriod = {
      id: `${memberId}-membership-1`,
      plan,
      startDate,
      endDate,
      price,
      paidAmount,
      paymentMethod,
    };
    const activity: MemberActivity[] = [
      { id: `${memberId}-registered`, type: "registration", date: startDate, title: "تسجيل العضو", detail: "إنشاء ملف العضو في النادي." },
      { id: `${memberId}-membership-1`, type: "membership", date: startDate, title: "بدء الاشتراك", detail: `${plan} · حتى ${endDate}` },
    ];
    if (paidAmount > 0) {
      activity.push({
        id: `${memberId}-payment-1`,
        type: "payment",
        date: nowIso,
        title: paidAmount >= price ? "سداد الاشتراك" : "دفعة جزئية للاشتراك",
        detail: `${paymentMethod} · ${plan}`,
        amount: paidAmount,
      });
    }
    const member: Member = {
      id: memberId,
      name,
      phone,
      plan,
      joinedAt: new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(now),
      expiresAt: new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${endDate}T00:00:00`)),
      status: memberStatus(endDate),
      paid: paidAmount >= price,
      initials: name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join(""),
      color: "mint",
      membershipHistory: [membership],
      activityHistory: activity,
      createdAt: nowIso,
    };
    const payment = paidAmount > 0 ? {
      id: crypto.randomUUID(),
      memberId,
      memberName: name,
      detail: plan,
      paymentMethod,
      amount: paidAmount,
      createdBy: profile.uid,
      createdAt: nowIso,
    } : null;

    await recordSupportAudit(supportSession, "member.create", {
      memberId,
      plan,
      paidAmount,
    });
    const { error } = await getSupabaseAdminClient().rpc("gymflow_create_member", {
      p_gym_id: gym.id,
      p_member: member,
      p_phone_normalized: phoneDigits,
      p_payment: payment,
    });
    if (error) mapMemberRpcError(error);
    return Response.json({ member }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { gym, profile, supportSession } = await requireActiveGym(request);
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const body = await request.json() as {
      action?: unknown;
      memberId?: unknown;
      plan?: unknown;
      amount?: unknown;
      paymentMethod?: unknown;
      detail?: unknown;
    };
    const memberId = requiredText(body.memberId, "معرّف العضو", 100);
    const row = await getGymRecord(gym.id, "members", memberId);
    if (!row) throw new HttpError("العضو غير موجود.", 404);
    const member = row.payload as unknown as Member;
    const now = new Date();
    const nowIso = now.toISOString();
    const action = body.action;
    const requiredPermissions = action === "attendance" ? ["write:attendance"]
      : action === "payment" ? ["write:payments"]
        : action === "renew" ? ["write:members", "write:payments"]
          : ["write:members"];
    if (profile.role !== "owner" && !requiredPermissions.every((permission) => profile.permissions.includes(permission))) {
      throw new HttpError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403);
    }

    await recordSupportAudit(supportSession, `member.${typeof action === "string" ? action : "unknown"}`, {
      memberId,
      ...(typeof body.plan === "string" ? { plan: body.plan } : {}),
      ...(Number.isFinite(Number(body.amount)) ? { amount: Number(body.amount) } : {}),
    });

    if (action === "delete") {
      const { error } = await getSupabaseAdminClient().rpc("gymflow_commit_member_change", {
        p_gym_id: gym.id,
        p_member_id: memberId,
        p_expected_updated_at: row.updated_at,
        p_member: null,
        p_payment: null,
        p_attendance: null,
        p_delete: true,
      });
      if (error) mapMemberRpcError(error);
      return Response.json({ deleted: true });
    }

    let updatedMember: Member;
    let payment: Record<string, unknown> | null = null;
    let attendance: Record<string, unknown> | null = null;
    if (action === "attendance") {
      if (memberStatus(member.membershipHistory?.at(-1)?.endDate) === "منتهي") {
        throw new HttpError("لا يمكن تسجيل الحضور؛ اشتراك هذا العضو منتهي.", 409);
      }
      const event: MemberActivity = {
        id: `${memberId}-${crypto.randomUUID()}`,
        type: "attendance",
        date: isoDateTime(now),
        title: "تسجيل حضور",
        detail: "تسجيل يدوي عند الاستقبال.",
      };
      updatedMember = { ...member, activityHistory: [...member.activityHistory, event] };
      attendance = {
        id: crypto.randomUUID(),
        memberId,
        memberName: member.name,
        method: "يدوي",
        status: member.status,
        createdBy: profile.uid,
        createdAt: nowIso,
      };
    } else if (action === "renew") {
      const plan = requiredText(body.plan, "الخطة", 80);
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < 0) throw new HttpError("أدخل مبلغًا مدفوعًا صالحًا لا يقل عن صفر.", 400);
      const plans = await listGymRecords(gym.id, "plans");
      const selectedPlan = plans.find((item) => item.name === plan && item.active === true);
      if (!selectedPlan) throw new HttpError("اختر خطة اشتراك مفعّلة.", 400);
      const duration = Number(selectedPlan.durationMonths);
      if (!Number.isInteger(duration) || duration < 1) throw new HttpError("مدة الخطة غير صالحة.", 500);
      const lastPeriod = member.membershipHistory.at(-1);
      let startDate = toIsoDate(now);
      if (lastPeriod?.endDate) {
        const [year, month, day] = lastPeriod.endDate.split("-").map(Number);
        const previousEnd = new Date(year, month - 1, day);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (previousEnd >= today) {
          previousEnd.setDate(previousEnd.getDate() + 1);
          startDate = toIsoDate(previousEnd);
        }
      }
      const endDate = getPeriodEndDate(startDate, duration);
      const price = Number(selectedPlan.price ?? 0);
      if (amount > price) throw new HttpError("المبلغ المدفوع لا يمكن أن يتجاوز سعر الخطة.", 400);
      const paymentMethod = amount > 0 ? requiredText(body.paymentMethod, "طريقة الدفع", 40) : "";
      const newPeriod: MembershipPeriod = {
        id: `${memberId}-${crypto.randomUUID()}`,
        plan,
        startDate,
        endDate,
        price,
        paidAmount: amount,
        paymentMethod,
      };
      const activities: MemberActivity[] = [
        { id: `${newPeriod.id}-membership`, type: "membership", date: startDate, title: "تجديد الاشتراك", detail: `${plan} · حتى ${endDate}` },
      ];
      if (amount > 0) {
        activities.push({
          id: `${newPeriod.id}-payment`,
          type: "payment",
          date: isoDateTime(now),
          title: amount >= price ? "سداد الاشتراك" : "دفعة جزئية للاشتراك",
          detail: `${paymentMethod} · ${plan}`,
          amount,
        });
        payment = {
          id: crypto.randomUUID(),
          memberId,
          memberName: member.name,
          detail: plan,
          paymentMethod,
          amount,
          createdBy: profile.uid,
          createdAt: nowIso,
        };
      }
      updatedMember = {
        ...member,
        plan,
        status: memberStatus(endDate),
        paid: amount >= price,
        expiresAt: new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${endDate}T00:00:00`)),
        membershipHistory: [...member.membershipHistory, newPeriod],
        activityHistory: [...member.activityHistory, ...activities],
      };
    } else if (action === "payment") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new HttpError("أدخل مبلغًا أكبر من صفر.", 400);
      const paymentMethod = requiredText(body.paymentMethod, "طريقة الدفع", 40);
      const detail = requiredText(body.detail, "تفاصيل الدفعة", 120);
      const history = [...(member.membershipHistory ?? [])];
      const totalOutstanding = history.reduce(
        (total, period) => total + Math.max(period.price - period.paidAmount, 0),
        0,
      );
      if (totalOutstanding > 0 && amount > totalOutstanding) {
        throw new HttpError("المبلغ أكبر من إجمالي المستحق على العضو.", 400);
      }
      let remainingPayment = amount;
      for (let index = 0; index < history.length && remainingPayment > 0; index += 1) {
        const period = history[index];
        const outstanding = Math.max(period.price - period.paidAmount, 0);
        const applied = Math.min(outstanding, remainingPayment);
        if (applied > 0) {
          history[index] = {
            ...period,
            paidAmount: period.paidAmount + applied,
            paymentMethod,
          };
          remainingPayment -= applied;
        }
      }
      const latestPeriod = history.at(-1);
      const activity: MemberActivity = {
        id: `${memberId}-${crypto.randomUUID()}`,
        type: "payment",
        date: isoDateTime(now),
        title: "تسجيل دفعة",
        detail: `${detail} · ${paymentMethod}`,
        amount,
      };
      payment = {
        id: crypto.randomUUID(),
        memberId,
        memberName: member.name,
        detail,
        paymentMethod,
        amount,
        createdBy: profile.uid,
        createdAt: nowIso,
      };
      updatedMember = {
        ...member,
        paid: latestPeriod ? latestPeriod.paidAmount >= latestPeriod.price : member.paid,
        membershipHistory: history,
        activityHistory: [...member.activityHistory, activity],
      };
    } else {
      throw new HttpError("العملية المطلوبة غير مدعومة.", 400);
    }

    const memberPayload = { ...updatedMember, updatedAt: nowIso };
    const { error } = await getSupabaseAdminClient().rpc("gymflow_commit_member_change", {
      p_gym_id: gym.id,
      p_member_id: memberId,
      p_expected_updated_at: row.updated_at,
      p_member: memberPayload,
      p_payment: payment,
      p_attendance: attendance,
      p_delete: false,
    });
    if (error) mapMemberRpcError(error);
    return Response.json({ member: memberPayload });
  } catch (error) {
    return errorResponse(error);
  }
}
