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
  id: string;
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
  createdAt?: string;
  updatedAt?: string;
};

export function normalizePhoneNumber(value: string) {
  return value
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const codePoint = digit.charCodeAt(0);
      return String(codePoint - (codePoint >= 0x06f0 ? 0x06f0 : 0x0660));
    })
    .replace(/\D/g, "");
}

export type GymRecord = {
  id: string;
  [key: string]: string | number | boolean | null | undefined;
};

export type GymAppUser = {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  gymId?: string;
  role: "super_admin" | "owner" | "manager" | "employee";
  permissions: string[];
};

export type GymAccount = {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  subscriptionStatus: "pending" | "active" | "expired" | "suspended";
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
};

export type GymAppData = {
  plans: GymRecord[];
  attendance: GymRecord[];
  payments: GymRecord[];
  staff: GymRecord[];
  expenses: GymRecord[];
  reports: GymRecord[];
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

export const membershipPlanPrices: Record<string, number> = {};

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

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value);
