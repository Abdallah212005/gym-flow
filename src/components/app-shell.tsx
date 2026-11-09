"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GymSection, Member, MemberActivity, MembershipPeriod } from "@/lib/gym-data";
import {
  formatJoinedDate,
  getPeriodEndDate,
  initialMembers,
  membershipPlanPrices,
  toIsoDate,
} from "@/lib/gym-data";
import { GymAppProvider } from "@/components/gym-app-context";
import { Avatar, IconButton, ToastMessage } from "@/components/ui";

type NavItem = { id: GymSection; label: string; icon: LucideIcon };

const primaryNavigation: NavItem[] = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "members", label: "الأعضاء", icon: UsersRound },
  { id: "memberships", label: "الاشتراكات", icon: CalendarDays },
  { id: "attendance", label: "الحضور", icon: Activity },
  { id: "payments", label: "المدفوعات", icon: CreditCard },
  { id: "trainers", label: "المدربون والموظفون", icon: Dumbbell },
  { id: "expenses", label: "المصروفات", icon: Wallet },
  { id: "reports", label: "التقارير", icon: Activity },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

const pageTitles: Record<GymSection, string> = {
  overview: "نظرة عامة",
  members: "الأعضاء",
  memberships: "الاشتراكات",
  attendance: "الحضور",
  payments: "المدفوعات",
  trainers: "المدربون والموظفون",
  expenses: "المصروفات",
  reports: "التقارير",
  settings: "الإعدادات",
  platform: "إدارة المنصة",
};

function sectionFromPath(pathname: string): GymSection {
  const section = pathname.split("/").filter(Boolean)[0] as GymSection | undefined;
  return section && section in pageTitles ? section : "overview";
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const section = sectionFromPath(pathname);
  const [members, setMembers] = useState(initialMembers);
  const [planPrices, setPlanPrices] = useState(membershipPlanPrices);
  const [toast, setToast] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function notify(message: string) {
    setToast(message);
  }

  function navigate(nextSection: GymSection) {
    setMobileMenuOpen(false);
    setSearch("");
    setMemberSearchQuery("");
    router.push(nextSection === "overview" ? "/" : `/${nextSection}`);
  }

  function searchMembers() {
    if (!search.trim()) return;
    setMemberSearchQuery(search.trim());
    setMobileMenuOpen(false);
    setSearch("");
    router.push("/members");
  }

  function openMemberForm() {
    setMobileMenuOpen(false);
    setAddMemberOpen(true);
    router.push("/members");
  }

  function addMember(member: Omit<Member, "id" | "membershipHistory" | "activityHistory">) {
    const now = new Date();
    const durationMonths: Record<string, number> = {
      "اشتراك شهري": 1,
      "اشتراك ربع سنوي": 3,
      "اشتراك نصف سنوي": 6,
      "اشتراك سنوي": 12,
    };
    const startDate = toIsoDate(now);
    const endDate = getPeriodEndDate(startDate, durationMonths[member.plan] ?? 1);
    const id = Date.now();
    setMembers((current) => [{
      ...member,
      id,
      joinedAt: formatJoinedDate(now),
      expiresAt: formatJoinedDate(new Date(`${endDate}T00:00:00`)),
      membershipHistory: [{
        id: `${id}-membership-1`,
        plan: member.plan,
        startDate,
        endDate,
        price: planPrices[member.plan] ?? 0,
        paidAmount: 0,
        paymentMethod: "",
      }],
      activityHistory: [{
        id: `${id}-registered`,
        type: "registration",
        date: startDate,
        title: "تسجيل العضو",
        detail: "إنشاء ملف العضو في النادي.",
      }, {
        id: `${id}-membership-1`,
        type: "membership",
        date: startDate,
        title: "بدء الاشتراك",
        detail: `${member.plan} · من ${formatJoinedDate(now)} إلى ${formatJoinedDate(new Date(`${endDate}T00:00:00`))}`,
      }],
    }, ...current]);
    notify("تمت إضافة العضو بنجاح.");
  }

  function deleteMember(id: number) {
    setMembers((current) => current.filter((member) => member.id !== id));
    notify("تم حذف العضو.");
  }

  function renewMember(id: number, plan: string, paidAmount: number, paymentMethod: string) {
    const now = new Date();
    const today = toIsoDate(now);
    const durationMonths: Record<string, number> = {
      "اشتراك شهري": 1,
      "اشتراك ربع سنوي": 3,
      "اشتراك نصف سنوي": 6,
      "اشتراك سنوي": 12,
    };
    const duration = durationMonths[plan];
    if (!duration || paidAmount <= 0) {
      notify("اختر خطة صالحة وأدخل مبلغًا أكبر من صفر.");
      return;
    }

    setMembers((current) =>
      current.map((member) =>
        member.id !== id
          ? member
          : (() => {
              const latestPeriod = member.membershipHistory.at(-1);
              let startDate = today;
              if (latestPeriod) {
                const [year, month, day] = latestPeriod.endDate.split("-").map(Number);
                const previousEnd = new Date(year, month - 1, day);
                const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                if (previousEnd >= todayDate) {
                  previousEnd.setDate(previousEnd.getDate() + 1);
                  startDate = toIsoDate(previousEnd);
                }
              }

              const endDateIso = getPeriodEndDate(startDate, duration);
              const [endYear, endMonth, endDay] = endDateIso.split("-").map(Number);
              const endDate = new Date(endYear, endMonth - 1, endDay);
              const price = planPrices[plan];
              const renewedAt = now.toISOString();
              const newPeriod: MembershipPeriod = {
                id: `${id}-${Date.now()}`,
                plan,
                startDate,
                endDate: endDateIso,
                price,
                paidAmount,
                paymentMethod,
              };
              const newActivities: MemberActivity[] = [
                {
                  id: `${newPeriod.id}-membership`,
                  type: "membership",
                  date: startDate,
                  title: "تجديد الاشتراك",
                  detail: `${plan} · من ${formatJoinedDate(new Date(`${startDate}T00:00:00`))} إلى ${formatJoinedDate(endDate)}`,
                },
                {
                  id: `${newPeriod.id}-payment`,
                  type: "payment",
                  date: renewedAt,
                  title: paidAmount >= price ? "سداد الاشتراك" : "دفعة جزئية للاشتراك",
                  detail: `${paymentMethod} · ${plan}`,
                  amount: paidAmount,
                },
              ];

              return {
                ...member,
                plan,
                status: "نشط",
                paid: paidAmount >= price,
                expiresAt: formatJoinedDate(endDate),
                membershipHistory: [...member.membershipHistory, newPeriod],
                activityHistory: [...member.activityHistory, ...newActivities],
              };
            })(),
      ),
    );
    notify("تم تجديد الاشتراك بنجاح.");
  }

  function appendMemberActivity(id: number, activity: Omit<MemberActivity, "id">) {
    setMembers((current) => current.map((member) => member.id === id
      ? { ...member, activityHistory: [...member.activityHistory, { ...activity, id: `${id}-${Date.now()}` }] }
      : member));
  }

  function recordAttendance(id: number) {
    const now = new Date();
    appendMemberActivity(id, {
      type: "attendance",
      date: `${toIsoDate(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      title: "تسجيل حضور",
      detail: "تسجيل يدوي عند الاستقبال.",
    });
  }

  function recordPayment(id: number, amount: number, detail: string, paymentMethod: string) {
    const now = new Date();
    const activity: MemberActivity = {
      id: `${id}-${Date.now()}`,
      type: "payment",
      date: `${toIsoDate(now)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      title: "تسجيل دفعة",
      detail: `${detail} · ${paymentMethod}`,
      amount,
    };
    setMembers((current) => current.map((member) => {
      if (member.id !== id) return member;
      const membershipHistory = [...member.membershipHistory];
      const latestPeriod = membershipHistory.at(-1);
      if (latestPeriod) {
        membershipHistory[membershipHistory.length - 1] = {
          ...latestPeriod,
          paidAmount: latestPeriod.paidAmount + amount,
          paymentMethod,
        };
      }
      return {
        ...member,
        paid: latestPeriod ? latestPeriod.paidAmount + amount >= latestPeriod.price : member.paid,
        membershipHistory,
        activityHistory: [...member.activityHistory, activity],
      };
    }));
  }

  const contextValue = {
    members,
    planPrices,
    updatePlanPrices: setPlanPrices,
    addMember,
    deleteMember,
    renewMember,
    recordAttendance,
    recordPayment,
    notify,
    addMemberOpen,
    setAddMemberOpen,
    memberSearchQuery,
    setMemberSearchQuery,
    navigate,
    openMemberForm,
  };

  return (
    <GymAppProvider value={contextValue}>
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
          <div className="brand-row">
            <span className="brand-mark"><Activity size={19} strokeWidth={2.2} /></span>
            <span className="brand-name">gym<span>flow</span></span>
            <IconButton className="mobile-close" label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}><X size={18} /></IconButton>
          </div>
          <button className="gym-switcher" onClick={() => notify("أنت تعمل الآن في مساحة باور هاوس جيم.")}>
            <span className="gym-logo">PH</span>
            <span className="gym-switcher-copy"><strong>باور هاوس جيم</strong><small>الخطة الاحترافية</small></span>
            <ChevronDown size={15} />
          </button>
          <div className="nav-caption">القائمة الرئيسية</div>
          <nav className="main-nav" aria-label="القائمة الرئيسية">
            {primaryNavigation.map((item) => (
              <NavButton key={item.id} item={item} active={section === item.id} onClick={() => navigate(item.id)} />
            ))}
          </nav>
          <div className="owner-divider"><span>مساحة المنصة</span></div>
          <NavButton item={{ id: "platform", label: "إدارة المنصة", icon: Shield }} active={section === "platform"} onClick={() => navigate("platform")} owner />
          <div className="sidebar-bottom">
            <div className="sidebar-help"><span className="help-mark">?</span><div><strong>تحتاج مساعدة؟</strong><span>فريقنا هنا لمساعدتك</span></div><ChevronDown size={14} /></div>
            <button className="profile-button" onClick={() => notify("حساب أحمد منصور — مدير النادي.")}>
              <Avatar initials="أم" color="dark" />
              <span><strong>أحمد منصور</strong><small>مدير النادي</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
        </aside>

        {mobileMenuOpen && <button className="sidebar-overlay" aria-label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)} />}
        <main className="main-content">
          <header className="topbar">
            <div className="topbar-right">
              <IconButton className="menu-toggle" label="فتح القائمة" onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></IconButton>
              <span className="breadcrumb">الرئيسية</span><span className="breadcrumb-divider">/</span><strong>{pageTitles[section]}</strong>
            </div>
            <div className="topbar-left">
              <label className="global-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchMembers(); }} placeholder="بحث سريع..." />
                <kbd>⌘ K</kbd>
              </label>
              <div className="notification-wrap">
                <IconButton label="الإشعارات" className={notificationsOpen ? "icon-active" : ""} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><i className="notification-dot" /></IconButton>
                {notificationsOpen && (
                  <div className="notification-popover">
                    <div className="notification-head"><strong>الإشعارات</strong><button onClick={() => { setNotificationsOpen(false); notify("تم تحديد الإشعارات كمقروءة."); }}>تحديد كمقروءة</button></div>
                    <div className="notification-item"><span className="notification-mark notification-mark-amber" /><div><strong>اشتراكات قاربت على الانتهاء</strong><p>٨ أعضاء تنتهي اشتراكاتهم هذا الأسبوع.</p><small>منذ ١٥ دقيقة</small></div></div>
                    <div className="notification-item"><span className="notification-mark notification-mark-green" /><div><strong>تم تسجيل ١٢ عضوًا اليوم</strong><p>النشاط أعلى من متوسط الأسبوع.</p><small>منذ ساعة</small></div></div>
                  </div>
                )}
              </div>
              <span className="topbar-divider" />
              <button className="topbar-user" onClick={() => notify("حساب أحمد منصور — مدير النادي.")}><Avatar initials="أم" color="mint" /><ChevronDown size={14} /></button>
            </div>
          </header>
          <div className="mobile-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchMembers(); }} placeholder="بحث سريع..." /></div>
          <div className="content-area">{children}</div>
        </main>
        {toast && <ToastMessage message={toast} onClose={() => setToast("")} />}
        <button className="quick-add" aria-label="إضافة عضو سريع" onClick={openMemberForm}><Plus size={19} /></button>
      </div>
    </GymAppProvider>
  );
}

function NavButton({
  item,
  active,
  onClick,
  owner = false,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  owner?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button className={`nav-item ${active ? "nav-item-active" : ""} ${owner ? "nav-item-owner" : ""}`} onClick={onClick}>
      <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{owner && <span className="owner-lock">●</span>}
    </button>
  );
}
