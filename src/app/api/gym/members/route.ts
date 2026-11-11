import { getAdminDb } from "@/lib/firebase-admin";
import {
  errorResponse,
  HttpError,
  recordSupportAudit,
  requireActiveGym,
  requiredText,
} from "@/lib/server-auth";
import type { Member, MemberActivity, MembershipPeriod } from "@/lib/gym-data";
import { getPeriodEndDate, normalizePhoneNumber, toIsoDate } from "@/lib/gym-data";

function memberStatus(endDate: unknown): Member["status"] {
  if (typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return "منتهي";
  }
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

export async function GET(request: Request) {
  try {
    const { gym } = await requireActiveGym(request, "read:members");
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const snapshot = await getAdminDb().collection("gyms").doc(gym.id).collection("members")
      .orderBy("createdAt", "desc").limit(500).get();
    return Response.json({ members: snapshot.docs.map((document) => document.data() as Member) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { gym, profile, supportSession } = await requireActiveGym(request, "write:members");
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const body = await request.json() as { name?: unknown; phone?: unknown; plan?: unknown; paidAmount?: unknown; paymentMethod?: unknown };
    if (profile.role !== "owner" && !profile.permissions.includes("write:members")) {
      throw new HttpError("ليس لديك صلاحية لإضافة أعضاء.", 403);
    }
    const name = requiredText(body.name, "اسم العضو", 100);
    const phone = requiredText(body.phone, "رقم الهاتف", 30);
    const plan = requiredText(body.plan, "الخطة", 80);
    const digits = normalizePhoneNumber(phone);
    if (digits.length < 10) throw new HttpError("رقم الهاتف غير مكتمل.", 400);
    const db = getAdminDb();
    const gymRef = db.collection("gyms").doc(gym.id);
    const memberRef = gymRef.collection("members").doc();
    const phoneIndexRef = gymRef.collection("memberPhoneIndex").doc(digits);
    const duplicateQuery = gymRef.collection("members").where("phone", "==", phone).limit(1);
    const paymentRef = gymRef.collection("payments").doc();
    const paidAmount = Number(body.paidAmount ?? 0);
    let paymentMethod = "";
    let createdMember: Member | null = null;

    await recordSupportAudit(supportSession, "member.create", {
      memberId: memberRef.id,
      plan,
      paidAmount: Number.isFinite(paidAmount) ? paidAmount : 0,
    });
    await db.runTransaction(async (transaction) => {
      const phoneIndex = await transaction.get(phoneIndexRef);
      const legacyDuplicate = await transaction.get(duplicateQuery);
      const plans = await transaction.get(gymRef.collection("plans").where("name", "==", plan).limit(1));
      if (phoneIndex.exists || !legacyDuplicate.empty) {
        throw new HttpError("العميل موجود بالفعل. افتح ملفه لتجديد الاشتراك بدلًا من إنشاء ملف جديد.", 409);
      }
      if (plans.empty || plans.docs[0].get("active") !== true) throw new HttpError("اختر خطة اشتراك مفعّلة.", 400);
      const price = Number(plans.docs[0].get("price") ?? 0);
      if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > price) {
        throw new HttpError("المبلغ المدفوع يجب أن يكون بين صفر وسعر الخطة.", 400);
      }
      if (paidAmount > 0) {
        if (profile.role !== "owner" && !profile.permissions.includes("write:payments")) {
          throw new HttpError("ليس لديك صلاحية لتسجيل دفعة.", 403);
        }
        paymentMethod = requiredText(body.paymentMethod, "طريقة الدفع", 40);
      }
      const durationMonths = Number(plans.docs[0].get("durationMonths"));
      if (!Number.isInteger(durationMonths) || durationMonths < 1) throw new HttpError("مدة الخطة غير صالحة.", 500);
      const now = new Date();
      const startDate = toIsoDate(now);
      const endDate = getPeriodEndDate(startDate, durationMonths);
      const membership: MembershipPeriod = {
        id: `${memberRef.id}-membership-1`,
        plan,
        startDate,
        endDate,
        price,
        paidAmount,
        paymentMethod,
      };
      const activity: MemberActivity[] = [
        { id: `${memberRef.id}-registered`, type: "registration", date: startDate, title: "تسجيل العضو", detail: "إنشاء ملف العضو في النادي." },
        { id: `${memberRef.id}-membership-1`, type: "membership", date: startDate, title: "بدء الاشتراك", detail: `${plan} · حتى ${endDate}` },
      ];
      if (paidAmount > 0) {
        activity.push({
          id: `${memberRef.id}-payment-1`,
          type: "payment",
          date: now.toISOString(),
          title: paidAmount >= price ? "سداد الاشتراك" : "دفعة جزئية للاشتراك",
          detail: `${paymentMethod} · ${plan}`,
          amount: paidAmount,
        });
      }
      const member: Member = {
        id: memberRef.id,
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
        createdAt: now.toISOString(),
      };
      transaction.create(memberRef, member);
      transaction.create(phoneIndexRef, { memberId: memberRef.id });
      if (paidAmount > 0) {
        transaction.create(paymentRef, {
          memberId: memberRef.id,
          memberName: name,
          detail: plan,
          paymentMethod,
          amount: paidAmount,
          createdBy: profile.uid,
          createdAt: now.toISOString(),
        });
      }
      createdMember = member;
    });
    if (!createdMember) throw new Error("تعذر إنشاء ملف العضو بعد إتمام المعاملة.");
    return Response.json({ member: createdMember }, { status: 201 });
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
    const db = getAdminDb();
    const memberRef = db.collection("gyms").doc(gym.id).collection("members").doc(memberId);
    let updatedMember: Member | undefined;

    await recordSupportAudit(supportSession, `member.${typeof body.action === "string" ? body.action : "unknown"}`, {
      memberId,
      ...(typeof body.plan === "string" ? { plan: body.plan } : {}),
      ...(Number.isFinite(Number(body.amount)) ? { amount: Number(body.amount) } : {}),
    });
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(memberRef);
      if (!snapshot.exists) throw new HttpError("العضو غير موجود.", 404);
      const member = snapshot.data() as Member;
      const now = new Date();
      const action = body.action;
      const requiredPermissions = action === "attendance" ? ["write:attendance"]
        : action === "payment" ? ["write:payments"]
          : action === "renew" ? ["write:members", "write:payments"]
            : ["write:members"];
      if (profile.role !== "owner" && !requiredPermissions.every((permission) => profile.permissions.includes(permission))) {
        throw new HttpError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403);
      }
      if (action === "delete") {
        const phoneDigits = normalizePhoneNumber(member.phone);
        const phoneIndexRef = db.collection("gyms").doc(gym.id).collection("memberPhoneIndex").doc(phoneDigits);
        const phoneIndex = await transaction.get(phoneIndexRef);
        transaction.delete(memberRef);
        if (phoneIndex.exists && phoneIndex.get("memberId") === memberId) transaction.delete(phoneIndexRef);
        return;
      }
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
        const attendanceRef = db.collection("gyms").doc(gym.id).collection("attendance").doc();
        transaction.create(attendanceRef, {
          memberId,
          memberName: member.name,
          method: "يدوي",
          status: member.status,
          createdBy: profile.uid,
          createdAt: now.toISOString(),
        });
      } else if (action === "renew") {
        const plan = requiredText(body.plan, "الخطة", 80);
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) throw new HttpError("أدخل مبلغًا مدفوعًا صالحًا لا يقل عن صفر.", 400);
        const plans = await transaction.get(db.collection("gyms").doc(gym.id).collection("plans")
          .where("name", "==", plan).limit(1));
        if (plans.empty || plans.docs[0].get("active") !== true) throw new HttpError("اختر خطة اشتراك مفعّلة.", 400);
        const duration = Number(plans.docs[0].get("durationMonths"));
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
        const price = Number(plans.docs[0].get("price") ?? 0);
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
          const paymentRef = db.collection("gyms").doc(gym.id).collection("payments").doc();
          transaction.create(paymentRef, {
            memberId,
            memberName: member.name,
            detail: plan,
            paymentMethod,
            amount,
            createdBy: profile.uid,
            createdAt: now.toISOString(),
          });
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
        const payment: MemberActivity = {
          id: `${memberId}-${crypto.randomUUID()}`,
          type: "payment",
          date: isoDateTime(now),
          title: "تسجيل دفعة",
          detail: `${detail} · ${paymentMethod}`,
          amount,
        };
        const paymentRef = db.collection("gyms").doc(gym.id).collection("payments").doc();
        transaction.create(paymentRef, {
          memberId,
          memberName: member.name,
          detail,
          paymentMethod,
          amount,
          createdBy: profile.uid,
          createdAt: now.toISOString(),
        });
        updatedMember = {
          ...member,
          paid: latestPeriod ? latestPeriod.paidAmount >= latestPeriod.price : member.paid,
          membershipHistory: history,
          activityHistory: [...member.activityHistory, payment],
        };
      } else {
        throw new HttpError("العملية المطلوبة غير مدعومة.", 400);
      }

      transaction.set(memberRef, { ...updatedMember, updatedAt: now.toISOString() });
    });

    if (body.action === "delete") return Response.json({ deleted: true });
    return Response.json({ member: updatedMember });
  } catch (error) {
    return errorResponse(error);
  }
}
