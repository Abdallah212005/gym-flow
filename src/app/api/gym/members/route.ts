import { getAdminDb } from "@/lib/firebase-admin";
import {
  errorResponse,
  HttpError,
  requireActiveGym,
  requiredText,
} from "@/lib/server-auth";
import type { Member, MemberActivity, MembershipPeriod } from "@/lib/gym-data";
import { getPeriodEndDate, toIsoDate } from "@/lib/gym-data";

function memberStatus(endDate: string): Member["status"] {
  const [year, month, day] = endDate.split("-").map(Number);
  const end = new Date(year, month - 1, day);
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
    const { gym, profile } = await requireActiveGym(request, "write:members");
    if (!gym) throw new HttpError("غير مصرح.", 403);
    const body = await request.json() as { name?: unknown; phone?: unknown; plan?: unknown };
    if (profile.role !== "owner" && !profile.permissions.includes("write:members")) {
      throw new HttpError("ليس لديك صلاحية لإضافة أعضاء.", 403);
    }
    const name = requiredText(body.name, "اسم العضو", 100);
    const phone = requiredText(body.phone, "رقم الهاتف", 30);
    const plan = requiredText(body.plan, "الخطة", 80);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) throw new HttpError("رقم الهاتف غير مكتمل.", 400);
    const db = getAdminDb();
    const gymRef = db.collection("gyms").doc(gym.id);
    const memberRef = gymRef.collection("members").doc();
    const plans = await gymRef.collection("plans").where("name", "==", plan).limit(1).get();
    if (plans.empty || plans.docs[0].get("active") !== true) throw new HttpError("اختر خطة اشتراك مفعّلة.", 400);
    const price = Number(plans.docs[0].get("price") ?? 0);
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
      paidAmount: 0,
      paymentMethod: "",
    };
    const activity: MemberActivity[] = [
      { id: `${memberRef.id}-registered`, type: "registration", date: startDate, title: "تسجيل العضو", detail: "إنشاء ملف العضو في النادي." },
      { id: `${memberRef.id}-membership-1`, type: "membership", date: startDate, title: "بدء الاشتراك", detail: `${plan} · حتى ${endDate}` },
    ];
    const member: Member = {
      id: memberRef.id,
      name,
      phone,
      plan,
      joinedAt: new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(now),
      expiresAt: new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${endDate}T00:00:00`)),
      status: memberStatus(endDate),
      paid: false,
      initials: name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join(""),
      color: "mint",
      membershipHistory: [membership],
      activityHistory: activity,
      createdAt: now.toISOString(),
    } as Member;
    await memberRef.create(member);
    return Response.json({ member }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { gym, profile } = await requireActiveGym(request);
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
        transaction.delete(memberRef);
        return;
      }
      if (action === "attendance") {
        if (memberStatus(member.membershipHistory.at(-1)?.endDate ?? "") === "منتهي") {
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
        if (!Number.isFinite(amount) || amount <= 0) throw new HttpError("اختر خطة صالحة وأدخل مبلغًا أكبر من صفر.", 400);
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
        const paymentMethod = requiredText(body.paymentMethod, "طريقة الدفع", 40);
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
          { id: `${newPeriod.id}-payment`, type: "payment", date: isoDateTime(now), title: amount >= price ? "سداد الاشتراك" : "دفعة جزئية للاشتراك", detail: `${paymentMethod} · ${plan}`, amount },
        ];
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
        const history = [...member.membershipHistory];
        const latestPeriod = history.at(-1);
        if (latestPeriod) {
          history[history.length - 1] = {
            ...latestPeriod,
            paidAmount: latestPeriod.paidAmount + amount,
            paymentMethod,
          };
        }
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
          paid: latestPeriod ? latestPeriod.paidAmount + amount >= latestPeriod.price : member.paid,
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
