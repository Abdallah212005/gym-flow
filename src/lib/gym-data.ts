export type MemberStatus = "نشط" | "قارب على الانتهاء" | "منتهي";

export type MembershipPeriod = {
  id: string;
  plan: string;
  startDate: string;
  endDate: string;
  price: number;
  paidAmount: number;
  paymentMethod: string;
};

export type MemberActivity = {
  id: string;
  type: "registration" | "membership" | "payment" | "attendance";
  date: string;
  title: string;
  detail: string;
  amount?: number;
};

export type Member = {
  id: number;
  name: string;
  phone: string;
  plan: string;
  joinedAt: string;
  expiresAt: string;
  status: MemberStatus;
  paid: boolean;
  initials: string;
  color: string;
  membershipHistory: MembershipPeriod[];
  activityHistory: MemberActivity[];
};

export type GymSection =
  | "overview"
  | "members"
  | "memberships"
  | "attendance"
  | "payments"
  | "trainers"
  | "expenses"
  | "reports"
  | "settings"
  | "platform";

const planPrices: Record<string, number> = {
  "اشتراك شهري": 850,
  "اشتراك ربع سنوي": 2200,
  "اشتراك نصف سنوي": 4000,
  "اشتراك سنوي": 6800,
};

function seedMember(member: Omit<Member, "membershipHistory" | "activityHistory">): Member {
  const [day, month] = member.joinedAt.split(" ");
  const monthNumber: Record<string, string> = {
    يناير: "01", فبراير: "02", مارس: "03", أبريل: "04", مايو: "05", يونيو: "06",
    يوليو: "07", أغسطس: "08", سبتمبر: "09", أكتوبر: "10", نوفمبر: "11", ديسمبر: "12",
  };
  const joinedDay = Number(day.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))));
  const joinedIso = `2025-${monthNumber[month] ?? "06"}-${String(joinedDay).padStart(2, "0")}`;
  const [endDay, endMonth] = member.expiresAt.split(" ");
  const endIso = `2025-${monthNumber[endMonth] ?? "07"}-${String(Number(endDay.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))))).padStart(2, "0")}`;
  const price = planPrices[member.plan] ?? 0;
  const paidAmount = member.paid ? price : 0;
  const period: MembershipPeriod = {
    id: `${member.id}-membership-1`,
    plan: member.plan,
    startDate: joinedIso,
    endDate: endIso,
    price,
    paidAmount,
    paymentMethod: member.paid ? "نقدي" : "",
  };
  const activityHistory: MemberActivity[] = [
    { id: `${member.id}-registered`, type: "registration", date: joinedIso, title: "تسجيل العضو", detail: "إنشاء ملف العضو في النادي." },
    { id: `${member.id}-membership-1`, type: "membership", date: joinedIso, title: "بدء الاشتراك", detail: `${member.plan} · حتى ${member.expiresAt}` },
    ...(member.paid
      ? [{ id: `${member.id}-payment-1`, type: "payment" as const, date: joinedIso, title: "سداد الاشتراك", detail: `دفع نقدي · ${member.plan}`, amount: price }]
      : []),
    { id: `${member.id}-attendance-1`, type: "attendance", date: "2025-06-18", title: "تسجيل حضور", detail: "الفترة المسائية · ٦:٢٠ م" },
    { id: `${member.id}-attendance-2`, type: "attendance", date: "2025-06-21", title: "تسجيل حضور", detail: "الفترة الصباحية · ٩:١٥ ص" },
  ];

  return { ...member, membershipHistory: [period], activityHistory };
}

export const initialMembers: Member[] = [
  seedMember({ id: 1, name: "عمر محمود", phone: "010 2345 6789", plan: "اشتراك شهري", joinedAt: "١٢ يونيو ٢٠٢٥", expiresAt: "١٢ يوليو ٢٠٢٥", status: "نشط", paid: true, initials: "عم", color: "mint" }),
  seedMember({ id: 2, name: "سارة أحمد", phone: "011 4567 8901", plan: "اشتراك ربع سنوي", joinedAt: "١٠ يونيو ٢٠٢٥", expiresAt: "١٠ يوليو ٢٠٢٥", status: "قارب على الانتهاء", paid: true, initials: "سأ", color: "peach" }),
  seedMember({ id: 3, name: "يوسف علي", phone: "012 7890 1234", plan: "اشتراك شهري", joinedAt: "٨ يونيو ٢٠٢٥", expiresAt: "٨ يوليو ٢٠٢٥", status: "نشط", paid: false, initials: "يع", color: "blue" }),
  seedMember({ id: 4, name: "ندى خالد", phone: "010 9876 5432", plan: "اشتراك سنوي", joinedAt: "٥ يونيو ٢٠٢٥", expiresAt: "٥ يوليو ٢٠٢٥", status: "نشط", paid: true, initials: "نك", color: "lilac" }),
  seedMember({ id: 5, name: "كريم حسن", phone: "015 2345 6789", plan: "اشتراك شهري", joinedAt: "٣ يونيو ٢٠٢٥", expiresAt: "٣ يوليو ٢٠٢٥", status: "منتهي", paid: true, initials: "كح", color: "sand" }),
  seedMember({ id: 6, name: "مريم إبراهيم", phone: "011 1234 5678", plan: "اشتراك نصف سنوي", joinedAt: "١ يونيو ٢٠٢٥", expiresAt: "١ يوليو ٢٠٢٥", status: "قارب على الانتهاء", paid: true, initials: "مإ", color: "rose" }),
];

export const membershipPlanPrices = planPrices;

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPeriodEndDate(startDate: string, durationMonths: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const targetMonth = new Date(year, month - 1 + durationMonths, 1);
  const anniversaryDay = Math.min(
    day,
    new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate(),
  );
  return toIsoDate(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), anniversaryDay - 1));
}

export function formatHistoryDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatHistoryTimestamp(value: string) {
  const [date, time] = value.split("T");
  return `${formatHistoryDate(date)}${time ? ` · ${time.slice(0, 5)}` : ""}`;
}

export function formatJoinedDate(value: Date) {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export const recentTransactions = [
  { name: "عمر محمود", detail: "اشتراك شهري", method: "نقدي", date: "اليوم، ١٠:٤٢ ص", amount: 850 },
  { name: "ندى خالد", detail: "اشتراك سنوي", method: "بطاقة", date: "اليوم، ٩:١٥ ص", amount: 6800 },
  { name: "مريم إبراهيم", detail: "تجديد اشتراك", method: "نقدي", date: "أمس، ٦:٣٠ م", amount: 2200 },
];

export const monthlyRevenue = [
  { label: "يناير", value: 42 },
  { label: "فبراير", value: 61 },
  { label: "مارس", value: 48 },
  { label: "أبريل", value: 75 },
  { label: "مايو", value: 59 },
  { label: "يونيو", value: 88 },
];

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value);
