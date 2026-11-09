"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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
import type { GymAccount, GymAppData, GymAppUser, GymSection, Member } from "@/lib/gym-data";
import { GymAppProvider } from "@/components/gym-app-context";
import { Avatar, IconButton, ToastMessage } from "@/components/ui";
import { AuthGate } from "@/components/auth-gate";

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

const emptyData: GymAppData = {
  plans: [],
  attendance: [],
  payments: [],
  staff: [],
  expenses: [],
  reports: [],
};

async function requestJson(path: string, method = "GET", body?: Record<string, unknown>) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
  });
  const result = await response.json() as { error?: string; [key: string]: unknown };
  if (!response.ok) throw new Error(result.error ?? "تعذر الاتصال بالخادم.");
  return result;
}

async function loadGymData(profile: GymAppUser) {
  const collections = ["plans", "attendance", "payments", "staff", "expenses", "reports"];
  const readableCollections = profile.role === "owner"
    ? collections
    : collections.filter((name) => profile.permissions.includes(`read:${name}`));
  const readsMembers = profile.role === "owner" || profile.permissions.includes("read:members");
  const collectionQuery = readableCollections.map((name) => `collection=${encodeURIComponent(name)}`).join("&");
  const [memberResult, dataResult] = await Promise.all([
    readsMembers ? requestJson("/api/gym/members") : Promise.resolve({ members: [] }),
    requestJson(`/api/gym/data${collectionQuery ? `?${collectionQuery}` : ""}`),
  ]);
  return {
    members: memberResult.members as Member[],
    data: { ...emptyData, ...(dataResult.data as Partial<GymAppData>) },
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const section = sectionFromPath(pathname);
  const [members, setMembers] = useState<Member[]>([]);
  const [data, setData] = useState<GymAppData>(emptyData);
  const [user, setUser] = useState<GymAppUser | null>(null);
  const [gym, setGym] = useState<GymAccount | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const planPrices = Object.fromEntries(data.plans
    .filter((plan) => plan.active !== false)
    .map((plan) => [String(plan.name), Number(plan.price)]));
  const sectionPermission: Partial<Record<GymSection, string>> = {
    members: "read:members",
    memberships: "read:plans",
    attendance: "read:attendance",
    payments: "read:payments",
    trainers: "read:staff",
    expenses: "read:expenses",
  };
  const visibleNavigation = user?.role === "owner"
    ? primaryNavigation
    : primaryNavigation.filter((item) => item.id === "overview" || (item.id === "settings" ? false : item.id === "reports"
      ? user?.permissions.includes("read:reports") && ["members", "attendance", "payments", "expenses"].every((name) => user.permissions.includes(`read:${name}`))
      : user?.permissions.includes(sectionPermission[item.id] ?? "")));
  const fallbackSection = visibleNavigation.find((item) => item.id !== "overview")?.id ?? "overview";
  const redirectTarget = !user
    ? null
    : user.role === "super_admin"
      ? section === "platform" ? null : "/platform"
      : section === "platform"
        ? "/"
        : user.role !== "owner" && section !== "overview" && !visibleNavigation.some((item) => item.id === section)
          ? fallbackSection === "overview" ? "/" : `/${fallbackSection}`
          : null;
  const canWriteMembers = user?.role === "owner" || user?.permissions.includes("write:members");
  const canSearchMembers = user?.role === "owner" || user?.permissions.includes("read:members");

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  const refreshData = useCallback(async () => {
    if (!user || (user.role !== "super_admin" && gym?.subscriptionStatus !== "active")) return;
    if (user.role === "super_admin") return;
    const result = await loadGymData(user);
    setMembers(result.members);
    setData(result.data);
    setLoadError("");
  }, [gym, user]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await response.json() as { profile?: GymAppUser; gym?: GymAccount | null; error?: string };
        if (!response.ok || !result.profile) throw new Error(result.error ?? "تعذر التحقق من الحساب.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setUser(result?.profile ?? null);
        setGym(result?.gym ?? null);
        const account = result?.gym;
        if (result?.profile && result.profile.role !== "super_admin" && account && account.subscriptionStatus === "active") {
          loadGymData(result.profile)
            .then((loaded) => {
              if (!active) return;
              setMembers(loaded.members);
              setData(loaded.data);
            })
            .catch((error: unknown) => {
              if (active) setLoadError(error instanceof Error ? error.message : "تعذر تحميل بيانات النادي.");
            });
        }
        setSessionReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "تعذر الاتصال بالخادم.");
        setSessionReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function notify(message: string) {
    setToast(message);
  }

  async function handleAuthenticated(profile: GymAppUser, account: GymAccount | null) {
    setUser(profile);
    setGym(account);
    setLoadError("");
    if (profile.role !== "super_admin" && account?.subscriptionStatus === "active") {
      try {
        const loaded = await loadGymData(profile);
        setMembers(loaded.members);
        setData(loaded.data);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "تعذر تحميل بيانات النادي.");
      }
    }
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

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("تعذر تسجيل الخروج.");
      setUser(null);
      setGym(null);
      setMembers([]);
      setData(emptyData);
      router.replace("/");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر تسجيل الخروج.");
    }
  }

  async function addMember(member: Omit<Member, "id" | "membershipHistory" | "activityHistory" | "joinedAt" | "expiresAt" | "status" | "paid" | "initials" | "color">) {
    try {
      const result = await requestJson("/api/gym/members", "POST", member);
      setMembers((current) => [result.member as Member, ...current]);
      notify("تمت إضافة العضو بنجاح.");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذرت إضافة العضو.");
      return false;
    }
  }

  async function deleteMember(id: string) {
    try {
      await requestJson("/api/gym/members", "PATCH", { action: "delete", memberId: id });
      setMembers((current) => current.filter((member) => member.id !== id));
      notify("تم حذف العضو.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر حذف العضو.");
    }
  }

  async function updateMember(id: string, action: string, body: Record<string, unknown> = {}) {
    try {
      const result = await requestJson("/api/gym/members", "PATCH", { action, memberId: id, ...body });
      if (result.member) {
        setMembers((current) => current.map((member) => member.id === id ? result.member as Member : member));
      }
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر حفظ التغيير.");
      return false;
    }
  }

  async function renewMember(id: string, plan: string, paidAmount: number, paymentMethod: string) {
    const success = await updateMember(id, "renew", { plan, amount: paidAmount, paymentMethod });
    if (success) notify("تم تجديد الاشتراك بنجاح.");
    return success;
  }

  async function recordAttendance(id: string) {
    return updateMember(id, "attendance");
  }

  async function recordPayment(id: string, amount: number, detail: string, paymentMethod: string) {
    return updateMember(id, "payment", { amount, detail, paymentMethod });
  }

  async function addRecord(collection: keyof GymAppData, record: Record<string, unknown>) {
    try {
      const result = await requestJson("/api/gym/data", "POST", { collection, data: record });
      const saved = result.record as GymAppData[typeof collection][number];
      setData((current) => ({ ...current, [collection]: [saved, ...current[collection]] }));
      notify("تم الحفظ بنجاح.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "تعذر حفظ البيانات.");
      throw error;
    }
  }

  async function updatePlanPrices(prices: Record<string, number>) {
    const records = data.plans;
    for (const [name, price] of Object.entries(prices)) {
      const existing = records.find((plan) => plan.name === name);
      if (!existing) throw new Error("تعذر العثور على خطة لتحديث سعرها. حدّث الصفحة ثم حاول مجددًا.");
      await requestJson("/api/gym/data", "PATCH", { collection: "plans", id: existing.id, data: { price } });
    }
    await refreshData();
  }

  const contextValue = {
    user: user!,
    gym,
    members,
    data,
    planPrices,
    updatePlanPrices,
    refreshData,
    addRecord,
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
  if (!sessionReady) {
    return <main className="auth-page"><section className="auth-card" aria-live="polite">جارٍ التحقق من الحساب...</section></main>;
  }
  if (loadError && !user) {
    return <main className="auth-page"><section className="auth-card"><h1>تعذر الاتصال بالخادم</h1><p className="form-error">{loadError}</p><button className="auth-mode-link" onClick={() => window.location.reload()}>إعادة المحاولة</button></section></main>;
  }
  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }
  if (user.role !== "super_admin" && (!gym || gym.subscriptionStatus !== "active")) {
    const subscriptionMessage = !gym || gym.subscriptionStatus === "pending"
      ? "طلب تسجيل النادي قيد المراجعة. لن تتاح وظائف النظام حتى تفعيل الاشتراك."
      : gym.subscriptionStatus === "suspended"
        ? "تم إيقاف اشتراك النادي. تواصل مع إدارة المنصة."
        : "انتهى اشتراك النادي. تواصل مع إدارة المنصة لتجديده.";
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-row auth-brand"><span className="brand-mark">G</span><span className="brand-name">gym<span>flow</span></span></div>
          <p className="eyebrow">{gym?.name ?? "GymFlow"}</p>
          <h1>النادي غير مفعّل</h1>
          <p className="page-description">{subscriptionMessage}</p>
          <button className="auth-mode-link" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setGym(null); }}>تسجيل الخروج</button>
        </section>
      </main>
    );
  }
  if (redirectTarget) {
    return <main className="auth-page"><section className="auth-card">جارٍ فتح الصفحة المناسبة لحسابك...</section></main>;
  }

  return (
    <GymAppProvider value={contextValue}>
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
          <div className="brand-row">
            <span className="brand-mark"><Activity size={19} strokeWidth={2.2} /></span>
            <span className="brand-name">gym<span>flow</span></span>
            <IconButton className="mobile-close" label="إغلاق القائمة" onClick={() => setMobileMenuOpen(false)}><X size={18} /></IconButton>
          </div>
          {user.role !== "super_admin" && <button className="gym-switcher">
            <span className="gym-logo">{gym?.name.slice(0, 2) ?? "G"}</span>
            <span className="gym-switcher-copy"><strong>{gym?.name}</strong><small>حساب النادي</small></span>
            <ChevronDown size={15} />
          </button>}
          {user.role !== "super_admin" && <><div className="nav-caption">القائمة الرئيسية</div>
          <nav className="main-nav" aria-label="القائمة الرئيسية">
            {visibleNavigation.map((item) => (
              <NavButton key={item.id} item={item} active={section === item.id} onClick={() => navigate(item.id)} />
            ))}
          </nav></>}
          {user.role === "super_admin" && <><div className="owner-divider"><span>مساحة المنصة</span></div>
          <NavButton item={{ id: "platform", label: "إدارة المنصة", icon: Shield }} active={section === "platform"} onClick={() => navigate("platform")} owner /></>}
          <div className="sidebar-bottom">
            <div className="sidebar-help"><span className="help-mark">?</span><div><strong>تحتاج مساعدة؟</strong><span>فريقنا هنا لمساعدتك</span></div><ChevronDown size={14} /></div>
            <button className="profile-button" onClick={() => notify(user.email)}>
              <Avatar initials={user.displayName.slice(0, 2)} color="dark" />
              <span><strong>{user.displayName}</strong><small>{user.username ?? user.email}</small></span>
              <ChevronDown size={15} />
            </button>
            <button className="logout-button" onClick={() => void logout()}>تسجيل الخروج</button>
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
              {canSearchMembers && <label className="global-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchMembers(); }} placeholder="بحث سريع..." />
                <kbd>⌘ K</kbd>
              </label>}
              {user.role !== "super_admin" && <div className="notification-wrap">
                <IconButton label="الإشعارات" className={notificationsOpen ? "icon-active" : ""} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /></IconButton>
                {notificationsOpen && (
                  <div className="notification-popover">
                    <div className="notification-head"><strong>الإشعارات</strong><button onClick={() => setNotificationsOpen(false)}>إغلاق</button></div>
                    <p className="notification-item">لا توجد إشعارات جديدة.</p>
                  </div>
                )}
              </div>}
              <span className="topbar-divider" />
              <button className="topbar-user" onClick={() => notify(user.email)}><Avatar initials={user.displayName.slice(0, 2)} color="mint" /><ChevronDown size={14} /></button>
            </div>
          </header>
          {canSearchMembers && <div className="mobile-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchMembers(); }} placeholder="بحث سريع..." /></div>}
          {loadError && <div className="load-error-banner" role="alert"><span>{loadError}</span><button onClick={() => void refreshData().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "تعذر تحميل بيانات النادي."))}>إعادة المحاولة</button></div>}
          <div className="content-area">{children}</div>
        </main>
        {toast && <ToastMessage message={toast} onClose={() => setToast("")} />}
        {canWriteMembers && user.role !== "super_admin" && <button className="quick-add" aria-label="إضافة عضو سريع" onClick={openMemberForm}><Plus size={19} /></button>}
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
