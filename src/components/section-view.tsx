"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpLeft,
  Building2,
  Check,
  CircleHelp,
  Download,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import type { GymAccount, GymAppData, GymAppUser, GymSection, Member } from "@/lib/gym-data";
import { formatMoney, normalizePhoneNumber } from "@/lib/gym-data";
import { Avatar, Button, EmptyState, Modal, PageHeading, StatusBadge } from "@/components/ui";

type TableConfig = {
  title: string;
  description: string;
  action: string;
  columns: string[];
  rows: string[][];
  summary: string;
  collection: keyof GymAppData;
};

type SupportAuditEvent = {
  id: string;
  action: string;
  createdAt: string;
  details: Record<string, string | number | boolean | null>;
};

type SupportAuditSession = {
  id: string;
  gymName: string;
  adminEmail: string;
  startedAt: string;
  endedAt?: string;
  active: boolean;
  events: SupportAuditEvent[];
};

const tableConfigs: Partial<Record<GymSection, TableConfig>> = {
  memberships: {
    title: "الاشتراكات",
    description: "خطط مرنة تناسب أعضاء ناديك.",
    action: "إضافة خطة",
    columns: ["الخطة", "المدة", "السعر", "الأعضاء", "الحالة"],
    rows: [],
    summary: "خطط الاشتراك المسجلة",
    collection: "plans",
  },
  attendance: {
    title: "الحضور",
    description: "سجل الحضور اليومي ومتابعة دخول الأعضاء.",
    action: "تسجيل حضور",
    columns: ["العضو", "وقت الدخول", "طريقة التسجيل", "حالة الاشتراك"],
    rows: [],
    summary: "سجل الحضور المسجل",
    collection: "attendance",
  },
  payments: {
    title: "المدفوعات",
    description: "كل المعاملات المالية اليدوية في مكان واحد.",
    action: "تسجيل دفعة",
    columns: ["العضو", "التفاصيل", "طريقة الدفع", "التاريخ", "المبلغ"],
    rows: [],
    summary: "سجل المدفوعات المسجلة",
    collection: "payments",
  },
  trainers: {
    title: "المدربون والموظفون",
    description: "إدارة فريق العمل والأدوار داخل النادي.",
    action: "إضافة موظف",
    columns: ["الموظف", "الدور", "التخصص", "الراتب الشهري", "الحالة"],
    rows: [],
    summary: "حسابات فريق النادي",
    collection: "staff",
  },
  expenses: {
    title: "المصروفات",
    description: "سجّل المصروفات وتابع ميزانية ناديك.",
    action: "إضافة مصروف",
    columns: ["البند", "التصنيف", "التاريخ", "طريقة الدفع", "المبلغ"],
    rows: [],
    summary: "المصروفات المسجلة",
    collection: "expenses",
  },
};

export function SectionView({
  section,
  notify,
  members,
  data,
  user,
  planPrices,
  updatePlanPrices,
  addRecord,
  refreshData,
  navigate,
  recordAttendance,
  recordPayment,
}: {
  section: GymSection;
  notify: (message: string) => void;
  members: Member[];
  data: GymAppData;
  user: GymAppUser;
  planPrices: Record<string, number>;
  updatePlanPrices: (prices: Record<string, number>) => Promise<void>;
  addRecord: (collection: keyof GymAppData, record: Record<string, unknown>) => Promise<void>;
  refreshData: () => Promise<void>;
  navigate: (section: GymSection) => void;
  recordAttendance: (id: string) => Promise<boolean>;
  recordPayment: (id: string, amount: number, detail: string, paymentMethod: string) => Promise<boolean>;
}) {
  if (section === "settings") return <SettingsView notify={notify} user={user} planPrices={planPrices} updatePlanPrices={updatePlanPrices} />;
  if (section === "reports") return <ReportsView notify={notify} data={data} members={members} />;
  if (section === "platform") return <PlatformView notify={notify} />;

  const config = tableConfigs[section];
  if (!config) return null;
  return <TableSection key={section} config={config} section={section} notify={notify} members={members} data={data} user={user} addRecord={addRecord} refreshData={refreshData} recordAttendance={recordAttendance} recordPayment={recordPayment} navigate={navigate} />;
}

function TableSection({
  config,
  section,
  notify,
  members,
  data,
  user,
  addRecord,
  refreshData,
  navigate,
  recordAttendance,
  recordPayment,
}: {
  config: TableConfig;
  section: GymSection;
  notify: (message: string) => void;
  members: Member[];
  data: GymAppData;
  user: GymAppUser;
  addRecord: (collection: keyof GymAppData, record: Record<string, unknown>) => Promise<void>;
  refreshData: () => Promise<void>;
  navigate: (section: GymSection) => void;
  recordAttendance: (id: string) => Promise<boolean>;
  recordPayment: (id: string, amount: number, detail: string, paymentMethod: string) => Promise<boolean>;
}) {
  const rows = data[config.collection].map((record) => {
    const date = typeof record.createdAt === "string"
      ? new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium" }).format(new Date(record.createdAt))
      : "—";
    if (section === "memberships") return [
      String(record.name ?? ""),
      `${String(record.durationMonths ?? "")} شهر`,
      `${formatMoney(Number(record.price ?? 0))} ج.م`,
      String(members.filter((member) => member.plan === record.name).length),
      record.active === false ? "موقّف" : "مفعّل",
    ];
    if (section === "attendance") return [
      String(record.memberName ?? ""),
      date,
      String(record.method ?? "يدوي"),
      String(record.status ?? ""),
    ];
    if (section === "payments") return [
      String(record.memberName ?? ""),
      String(record.detail ?? ""),
      String(record.paymentMethod ?? ""),
      date,
      `${formatMoney(Number(record.amount ?? 0))} ج.م`,
    ];
    if (section === "trainers") return [
      String(record.name ?? ""),
      String(record.role ?? ""),
      String(record.specialty ?? ""),
      `${formatMoney(Number(record.salary ?? 0))} ج.م`,
      String(record.status ?? "نشط"),
    ];
    return [
      String(record.name ?? ""),
      String(record.category ?? ""),
      date,
      String(record.paymentMethod ?? ""),
      `${formatMoney(Number(record.amount ?? 0))} ج.م`,
    ];
  });
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [person, setPerson] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [teamPermissions, setTeamPermissions] = useState<string[]>(["read:members"]);
  const [error, setError] = useState("");
  const canWrite = section === "trainers"
    ? user.role === "owner"
    : user.role === "owner" || user.permissions.includes(`write:${config.collection}`);
  const displayRows = rows;
  const filteredRows = useMemo(() => displayRows.filter((row) => row.join(" ").includes(query.trim())), [displayRows, query]);

  const titleMap: Record<GymSection, string> = {
    overview: "", members: "", memberships: "المنتجات والخطط", attendance: "متابعة الدخول",
    payments: "الإدارة المالية", trainers: "الفريق", expenses: "الإدارة المالية",
    reports: "", settings: "", platform: "",
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person.trim()) {
      setError("هذا الحقل مطلوب.");
      return;
    }

    try {
    if (section === "attendance") {
      const digits = normalizePhoneNumber(person);
      const member = members.find((candidate) =>
        candidate.name.includes(person.trim()) || (digits.length > 0 && normalizePhoneNumber(candidate.phone).includes(digits)),
      );
      if (!member) {
        setError("لم نعثر على عضو بهذا الاسم أو الرقم.");
        return;
      }
      if (member.status === "منتهي") {
        setError("لا يمكن تسجيل الحضور؛ اشتراك هذا العضو منتهي.");
        return;
      }
      if (!await recordAttendance(member.id)) return;
      await refreshData();
    }
    else if (section === "memberships") {
      const durationMonths = Number(details);
      const price = Number(amount);
      if (!Number.isInteger(durationMonths) || durationMonths < 1 || !Number.isFinite(price) || price < 0) {
        setError("أدخل مدة صحيحة وسعرًا صالحًا.");
        return;
      }
      await addRecord("plans", { name: person.trim(), durationMonths, price, active: true });
    }
    else if (section === "payments") {
      const digits = normalizePhoneNumber(person);
      const member = members.find((candidate) =>
        candidate.name.includes(person.trim()) || (digits.length > 0 && normalizePhoneNumber(candidate.phone).includes(digits)),
      );
      const paymentAmount = Number(amount);
      if (!member) {
        setError("اكتب اسم عضو مسجل أو رقم هاتفه لربط الدفعة بملفه.");
        return;
      }
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        setError("أدخل مبلغًا صحيحًا أكبر من صفر.");
        return;
      }
      if (!await recordPayment(member.id, paymentAmount, details || "دفعة نقدية", "نقدي")) return;
      await refreshData();
    }
    else if (section === "trainers") {
      const salary = Number(amount);
      if (!/^[A-Za-z0-9._-]{3,32}$/.test(username) || password.length < 8 || !Number.isFinite(salary) || salary < 0 || !teamPermissions.length) {
        setError("أدخل اسم مستخدم وكلمة مرور (٨ أحرف على الأقل) وراتبًا صالحًا.");
        return;
      }
      const response = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, displayName: person.trim(), role: "employee", permissions: teamPermissions, specialty: details, salary }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "تعذر إنشاء حساب الموظف.");
        return;
      }
      await refreshData();
    }
    else {
      const expenseAmount = Number(amount);
      if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
        setError("أدخل مبلغًا صحيحًا أكبر من صفر.");
        return;
      }
      await addRecord("expenses", { name: person.trim(), category: details || "تشغيل", amount: expenseAmount, paymentMethod: "نقدي" });
    }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر حفظ البيانات.");
      return;
    }

    setPerson("");
    setDetails("");
    setAmount("");
    setUsername("");
    setPassword("");
    setError("");
    setShowForm(false);
    notify(section === "attendance" ? "تم تسجيل الحضور بنجاح." : "تمت الإضافة بنجاح.");
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow={titleMap[section]} title={config.title} description={config.description} action={canWrite ? <Button icon={<Plus size={17} />} onClick={() => setShowForm(true)}>{config.action}</Button> : undefined} />
      {section === "attendance" && <div className="attendance-callout"><span className="callout-icon"><Check size={17} /></span><div><strong>تسجيل الحضور</strong><span>يتم التحقق من صلاحية اشتراك العضو قبل تسجيل الحضور.</span></div></div>}
      {section === "memberships" && <MembershipPlanCards rows={filteredRows} onAdd={() => setShowForm(true)} canAdd={canWrite} canSettings={user.role === "owner"} onSettings={() => navigate("settings")} />}
      {section !== "memberships" && <section className="panel member-table-panel">
        <div className="table-toolbar">
          <div className="table-title"><h2>{section === "attendance" ? "سجل الحضور" : section === "payments" ? "سجل المعاملات" : config.title}</h2><span className="count-pill">{filteredRows.length}</span></div>
          <div className="table-controls">
            <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث..." /></label>
            <button className="filter-select"><SlidersHorizontal size={15} /> تصفية</button>
          </div>
        </div>
        {filteredRows.length ? <div className="table-scroll"><table className="data-table">
          <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th /></tr></thead>
          <tbody>{filteredRows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>
            {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === 0 && (section === "trainers" || section === "attendance") ? <div className="member-cell"><Avatar initials={cell.slice(0, 2)} color={rowIndex % 2 ? "blue" : "mint"} /><strong>{cell}</strong></div> : ["نشط", "مفعّل", "قارب على الانتهاء", "منتهي", "موقوف", "تجريبي"].includes(cell) ? <StatusBadge>{cell}</StatusBadge> : cell}</td>)}
            <td><button className="row-more" aria-label="خيارات">···</button></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState title={query ? "لا توجد نتائج" : "لا توجد بيانات بعد"} description={query ? "لا توجد عناصر تطابق بحثك." : "ستظهر السجلات هنا بعد إضافة أول عنصر."} />}
        <div className="table-footer"><span>{config.summary} · {data[config.collection].length}</span><div><button disabled>السابق</button><button className="current-page">١</button><button disabled>التالي</button></div></div>
      </section>}
      <Modal open={showForm} title={config.action} description="أدخل البيانات المطلوبة ثم احفظ التغييرات." onClose={() => setShowForm(false)}>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field form-field-wide"><span>{section === "attendance" ? "اسم العضو أو رقم الهاتف" : section === "expenses" ? "اسم المصروف" : section === "memberships" ? "اسم الخطة" : section === "trainers" ? "اسم الموظف" : "اسم العضو"}</span><input autoFocus required value={person} onChange={(event) => setPerson(event.target.value)} placeholder="اكتب هنا..." /></label>
          {section !== "attendance" && <label className="form-field form-field-wide"><span>{section === "memberships" ? "المدة بالشهور" : section === "payments" ? "تفاصيل الدفعة" : section === "expenses" ? "التصنيف" : "التخصص أو المسمى الوظيفي"}</span><input type={section === "memberships" ? "number" : "text"} min={section === "memberships" ? 1 : undefined} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="اختياري" /></label>}
          {section !== "attendance" && <label className="form-field form-field-wide"><span>{section === "memberships" ? "السعر (ج.م)" : section === "trainers" ? "الراتب الشهري (ج.م)" : "المبلغ (ج.م)"}</span><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>}
          {section === "trainers" && <>
            <label className="form-field form-field-wide"><span>اسم المستخدم لتسجيل الدخول</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" /></label>
            <label className="form-field form-field-wide"><span>كلمة المرور (٨ أحرف على الأقل)</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
            <fieldset className="form-field form-field-wide permission-fieldset"><legend>الصلاحيات</legend>
              {["read:members", "write:members", "read:attendance", "write:attendance", "read:payments", "write:payments", "read:plans", "write:plans", "read:expenses", "write:expenses", "read:staff", "read:reports"].map((permission) => <label key={permission}><input type="checkbox" checked={teamPermissions.includes(permission)} onChange={(event) => setTeamPermissions((current) => event.target.checked ? [...current, permission] : current.filter((value) => value !== permission))} /> {permission}</label>)}
            </fieldset>
          </>}
          {error && <p className="form-error form-field-wide">{error}</p>}
          <div className="form-actions form-field-wide"><Button variant="secondary" type="button" onClick={() => setShowForm(false)}>إلغاء</Button><Button type="submit">حفظ</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function MembershipPlanCards({ rows, onAdd, canAdd, canSettings, onSettings }: { rows: string[][]; onAdd: () => void; canAdd: boolean; canSettings: boolean; onSettings: () => void }) {
  return (
    <section className="plan-library">
      <div className="plan-library-heading">
        <div>
          <span className="section-index">{rows.length} خطط</span>
          <h2>خطط النادي</h2>
        </div>
        {canSettings && <button className="plan-library-link" onClick={onSettings}>تعديل الأسعار من الإعدادات <ArrowUpLeft size={14} /></button>}
      </div>
      <div className="plan-card-grid">
        {rows.map((row, index) => (
          <article className="plan-card plan-card-cream" key={`${row[0]}-${index}`}>
            <div className="plan-card-top"><span className="plan-card-number">خطة اشتراك</span><StatusBadge>{row[4]}</StatusBadge></div>
            <div className="plan-card-content">
              <h3>{row[0]}</h3>
              <div className="plan-duration">{row[1]}</div>
              <div className="plan-price">{row[2].replace(" ج.م", "")}<small> ج.م <i>/ للفترة</i></small></div>
            </div>
            <div className="plan-card-bottom">
              <div className="plan-usage-label"><span>الأعضاء على الخطة</span><strong>{row[3]}</strong></div>
            </div>
          </article>
        ))}
        {canAdd && <button className="plan-create-card" onClick={onAdd}><span><Plus size={21} /></span><strong>إضافة خطة</strong></button>}
      </div>
      {!rows.length && <EmptyState title="لا توجد خطط بعد" description="أضف خطط الاشتراك الخاصة بناديك للبدء." />}
    </section>
  );
}

function ReportsView({ notify, data, members }: { notify: (message: string) => void; data: GymAppData; members: Member[] }) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const createdThisMonth = <T,>(records: T[], getDate: (record: T) => unknown) => records.filter((record) => {
    const date = getDate(record);
    return typeof date === "string" && Date.parse(date) >= monthStart.getTime();
  });
  const payments = createdThisMonth(data.payments, (record) => record.createdAt);
  const expenses = createdThisMonth(data.expenses, (record) => record.createdAt);
  const attendance = createdThisMonth(data.attendance, (record) => record.createdAt);
  const newMembers = createdThisMonth(members, (member) => member.createdAt);
  const income = payments.reduce((total, record) => total + Number(record.amount ?? 0), 0);
  const expenseTotal = expenses.reduce((total, record) => total + Number(record.amount ?? 0), 0);
  const reportRows = [
    ["أعضاء جدد", String(newMembers.length), "هذا الشهر"],
    ["زيارات الحضور", String(attendance.length), "هذا الشهر"],
    ["المدفوعات المسجلة", `${formatMoney(income)} ج.م`, "هذا الشهر"],
    ["صافي الحركة المالية", `${formatMoney(income - expenseTotal)} ج.م`, "مدفوعات ناقص المصروفات"],
  ];

  function exportCsv() {
    const csv = ["التقرير,النتيجة,الفترة", ...reportRows.map((row) => row.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    link.download = "gymflow-reports.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    notify("تم تنزيل التقرير بصيغة CSV.");
  }

  return <div className="page-stack">
    <PageHeading eyebrow="بيانات النادي" title="التقارير" description="ملخص مبني على سجلات النادي لهذا الشهر." action={<Button variant="secondary" icon={<Download size={16} />} onClick={exportCsv}>تصدير CSV</Button>} />
    <div className="report-kpis">{reportRows.map((row) => <article className="stat-card report-kpi" key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><div><span>{row[2]}</span></div></article>)}</div>
    <div className="data-note"><CircleHelp size={15} /> الأرقام محسوبة من البيانات المسجلة في النظام، ولا تتضمن مقارنة بفترة سابقة.</div>
  </div>;
}

function SettingsView({
  notify,
  user,
  planPrices,
  updatePlanPrices,
}: {
  notify: (message: string) => void;
  user: GymAppUser;
  planPrices: Record<string, number>;
  updatePlanPrices: (prices: Record<string, number>) => Promise<void>;
}) {
  return <div className="page-stack">
    <PageHeading eyebrow="إعدادات الحساب" title="الإعدادات" description="بيانات الحساب المرتبط بالنادي." />
    <div className="settings-layout">
      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2>معلومات الحساب</h2><p>بيانات تسجيل الدخول والصلاحيات الحالية.</p></div><span className="settings-logo">{user.displayName.slice(0, 2)}</span></div>
        <dl className="account-details">
          <div><dt>الاسم</dt><dd>{user.displayName}</dd></div>
          <div><dt>البريد الإلكتروني</dt><dd>{user.email}</dd></div>
          {user.username && <div><dt>اسم المستخدم</dt><dd>{user.username}</dd></div>}
          <div><dt>الدور</dt><dd>{user.role === "owner" ? "مالك النادي" : user.role === "manager" ? "مدير" : "موظف"}</dd></div>
        </dl>
        <form className="settings-form" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const prices = Object.fromEntries(Object.keys(planPrices).map((name) => [name, Number(form.get(name))]));
          if (Object.values(prices).some((price) => !Number.isFinite(price) || price < 0)) {
            notify("تحقق من أسعار الخطط.");
            return;
          }
          updatePlanPrices(prices).then(() => notify("تم حفظ أسعار الخطط.")).catch((error: unknown) => notify(error instanceof Error ? error.message : "تعذر حفظ الأسعار."));
        }}>
          <div className="pricing-editor-heading form-field-wide"><div><h3>أسعار خطط الاشتراك</h3><p>الأسعار هنا هي المقترحة عند تسجيل عضو أو تجديد اشتراكه.</p></div><span>EGP / ج.م</span></div>
          {Object.entries(planPrices).map(([planName, price]) => <label className="form-field" key={planName}>
            <span>{planName}</span>
            <div className="price-input-wrap"><input name={planName} type="number" min="0" step="1" required defaultValue={price} /><span>ج.م</span></div>
          </label>)}
          {Object.keys(planPrices).length > 0 && <div className="form-actions form-field-wide"><span>تُحدّث الأسعار المسجلة فقط.</span><Button type="submit">حفظ الأسعار</Button></div>}
          {!Object.keys(planPrices).length && <EmptyState title="لا توجد خطط" description="أضف خطة اشتراك أولًا لتعديل أسعارها." />}
        </form>
      </section>
    </div>
  </div>;
}

function PlatformView({ notify }: { notify: (message: string) => void }) {
  const [gyms, setGyms] = useState<GymAccount[]>([]);
  const [auditSessions, setAuditSessions] = useState<SupportAuditSession[]>([]);
  const [dateRanges, setDateRanges] = useState<Record<string, { startsAt: string; endsAt: string }>>({});
  const [error, setError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openingGymId, setOpeningGymId] = useState("");
  const statusLabels: Record<GymAccount["subscriptionStatus"], string> = {
    pending: "قيد المراجعة",
    active: "نشط",
    expired: "منتهي",
    suspended: "موقوف",
  };
  const fetchGyms = useCallback(async () => {
    const response = await fetch("/api/platform/gyms", { credentials: "same-origin", cache: "no-store" });
    const result = await response.json() as { gyms?: GymAccount[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "تعذر تحميل الأندية.");
    return result.gyms ?? [];
  }, []);
  const fetchSupportAudit = useCallback(async () => {
    const response = await fetch("/api/platform/support-session", { credentials: "same-origin", cache: "no-store" });
    const result = await response.json() as { sessions?: SupportAuditSession[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? "تعذر تحميل سجل جلسات الدعم.");
    return result.sessions ?? [];
  }, []);
  const applyGyms = useCallback((accounts: GymAccount[]) => {
    const { today, end } = getDefaultSubscriptionDates();
    setGyms(accounts);
    setDateRanges(Object.fromEntries(accounts.map((gym) => [gym.id, {
      startsAt: gym.subscriptionStartsAt?.slice(0, 10) ?? today,
      endsAt: gym.subscriptionEndsAt?.slice(0, 10) ?? end,
    }])));
  }, []);
  const loadGyms = useCallback(async () => {
    try {
      applyGyms(await fetchGyms());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الأندية.");
    } finally {
      setLoading(false);
    }
  }, [applyGyms, fetchGyms]);
  const loadSupportAudit = useCallback(async () => {
    try {
      setAuditSessions(await fetchSupportAudit());
      setAuditError("");
    } catch (loadError) {
      setAuditError(loadError instanceof Error ? loadError.message : "تعذر تحميل سجل جلسات الدعم.");
    }
  }, [fetchSupportAudit]);
  useEffect(() => {
    let active = true;
    fetchGyms()
      .then((accounts) => { if (active) applyGyms(accounts); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الأندية."); })
      .finally(() => { if (active) setLoading(false); });
    fetchSupportAudit()
      .then((sessions) => { if (active) { setAuditSessions(sessions); setAuditError(""); } })
      .catch((loadError: unknown) => { if (active) setAuditError(loadError instanceof Error ? loadError.message : "تعذر تحميل سجل جلسات الدعم."); });
    return () => { active = false; };
  }, [applyGyms, fetchGyms, fetchSupportAudit]);

  async function updateGym(gym: GymAccount, status: GymAccount["subscriptionStatus"]) {
    const dates = dateRanges[gym.id] ?? getDefaultSubscriptionDates();
    try {
      const response = await fetch("/api/platform/gyms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ gymId: gym.id, status, ...(status === "active" ? dates : {}) }),
      });
      const result = await response.json() as { gym?: GymAccount; error?: string };
      if (!response.ok || !result.gym) throw new Error(result.error ?? "تعذر تحديث الاشتراك.");
      setGyms((current) => current.map((item) => item.id === gym.id ? result.gym! : item));
      notify("تم تحديث حالة اشتراك النادي.");
    } catch (updateError) {
      notify(updateError instanceof Error ? updateError.message : "تعذر تحديث الاشتراك.");
    }
  }

  async function openGym(gym: GymAccount) {
    setOpeningGymId(gym.id);
    try {
      const response = await fetch("/api/platform/support-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ gymId: gym.id }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "تعذر فتح نظام النادي.");
      window.location.reload();
    } catch (openError) {
      notify(openError instanceof Error ? openError.message : "تعذر فتح نظام النادي.");
      setOpeningGymId("");
    }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="مساحة المالك" title="إدارة المنصة" description="إدارة اشتراكات الأندية المسجلة على GymFlow." />
    <div className="owner-banner"><span className="owner-shield"><ShieldCheck size={18} /></span><div><strong>لوحة مالك المنصة</strong><span>التحكم في اشتراكات GymFlow منفصل تمامًا عن عضويات أعضاء النادي.</span></div><span className="owner-only">للمالك فقط</span></div>
    <div className="stats-grid owner-stats"><article className="stat-card"><span className="stat-label">إجمالي الأندية</span><strong className="stat-value">{formatMoney(gyms.length)}</strong></article><article className="stat-card"><span className="stat-label">اشتراكات نشطة</span><strong className="stat-value">{formatMoney(gyms.filter((gym) => gym.subscriptionStatus === "active").length)}</strong></article><article className="stat-card"><span className="stat-label">قيد المراجعة</span><strong className="stat-value">{formatMoney(gyms.filter((gym) => gym.subscriptionStatus === "pending").length)}</strong></article><article className="stat-card"><span className="stat-label">موقوفة أو منتهية</span><strong className="stat-value">{formatMoney(gyms.filter((gym) => gym.subscriptionStatus === "suspended" || gym.subscriptionStatus === "expired").length)}</strong></article></div>
    <section className="panel member-table-panel">
      <div className="table-toolbar"><div className="table-title"><div><h2>حسابات الأندية</h2><span className="panel-subtitle">حدد فترة الاشتراك ثم فعّل النادي أو أوقفه.</span></div></div><button className="filter-select" onClick={() => void loadGyms()}>تحديث</button></div>
      {error && <p className="form-error">{error}</p>}
      {loading ? <EmptyState title="جارٍ تحميل الأندية" description="يتم الاتصال بقاعدة البيانات." /> : !gyms.length ? <EmptyState title="لا توجد أندية بعد" description="ستظهر هنا الأندية التي تسجل عبر بوابة التسجيل." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>النادي</th><th>المالك</th><th>البريد</th><th>بداية الاشتراك</th><th>نهاية الاشتراك</th><th>الحالة</th><th>إجراء</th><th>دخول الدعم</th></tr></thead><tbody>
        {gyms.map((gym) => <tr key={gym.id}>
          <td><div className="member-cell"><span className="gym-avatar"><Building2 size={16} /></span><strong>{gym.name}</strong></div></td>
          <td>{gym.ownerName}</td><td>{gym.ownerEmail}</td>
          <td><input aria-label={`بداية اشتراك ${gym.name}`} type="date" value={dateRanges[gym.id]?.startsAt ?? getDefaultSubscriptionDates().today} onChange={(event) => setDateRanges((current) => ({ ...current, [gym.id]: { ...(current[gym.id] ?? getDefaultSubscriptionDates()), startsAt: event.target.value } }))} /></td>
          <td><input aria-label={`نهاية اشتراك ${gym.name}`} type="date" value={dateRanges[gym.id]?.endsAt ?? getDefaultSubscriptionDates().end} onChange={(event) => setDateRanges((current) => ({ ...current, [gym.id]: { ...(current[gym.id] ?? getDefaultSubscriptionDates()), endsAt: event.target.value } }))} /></td>
          <td><StatusBadge>{statusLabels[gym.subscriptionStatus]}</StatusBadge></td>
          <td>{gym.subscriptionStatus === "active"
            ? <button className="owner-action" onClick={() => void updateGym(gym, "suspended")}>إيقاف</button>
            : <button className="owner-action" onClick={() => void updateGym(gym, "active")}>تفعيل الاشتراك</button>}</td>
          <td><button className="owner-action" disabled={Boolean(openingGymId)} onClick={() => void openGym(gym)}>{openingGymId === gym.id ? "جارٍ الفتح..." : "فتح النظام"}</button></td>
        </tr>)}
      </tbody></table></div>}
      <div className="owner-table-note"><Wallet size={15} /> لا توجد مدفوعات تلقائية. تفعيل الاشتراك وتجديده يتم يدويًا بواسطة مالك المنصة.</div>
    </section>
    <section className="panel member-table-panel">
      <div className="table-toolbar"><div className="table-title"><div><h2>سجل جلسات الدعم</h2><span className="panel-subtitle">الدخول والتغييرات التي نفّذها مدير المنصة.</span></div></div><button className="filter-select" onClick={() => void loadSupportAudit()}>تحديث السجل</button></div>
      {auditError && <p className="form-error">{auditError}</p>}
      {!auditSessions.length ? <EmptyState title="لا توجد جلسات دعم مسجلة" description="ستظهر هنا جلسات فتح أنظمة الأندية." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>النادي</th><th>المسؤول</th><th>بداية الجلسة</th><th>نهاية الجلسة</th><th>الأحداث</th></tr></thead><tbody>
        {auditSessions.map((session) => <tr key={session.id}>
          <td>{session.gymName || "نادي غير معروف"}</td>
          <td>{session.adminEmail}</td>
          <td>{formatSupportDate(session.startedAt)}</td>
          <td>{session.active ? "نشطة" : session.endedAt ? formatSupportDate(session.endedAt) : "منتهية"}</td>
          <td><div className="support-audit-events">{session.events.map((event) => <span key={event.id}>
            <strong>{supportActionLabel(event.action)}</strong>
            <small>{formatSupportDate(event.createdAt)}{supportEventContext(event.details) ? ` · ${supportEventContext(event.details)}` : ""}</small>
          </span>)}</div></td>
        </tr>)}
      </tbody></table></div>}
    </section>
  </div>;
}

function formatSupportDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ar-EG", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function supportActionLabel(action: string) {
  const labels: Record<string, string> = {
    "session.start": "بدء الجلسة",
    "session.end": "إنهاء الجلسة",
    "data.create": "إضافة بيانات",
    "data.update": "تعديل بيانات",
    "data.delete": "حذف بيانات",
    "member.create": "تسجيل عضو",
    "member.delete": "حذف عضو",
    "member.renew": "تجديد اشتراك",
    "member.payment": "تسجيل دفعة",
    "member.attendance": "تسجيل حضور",
    "team.create": "إضافة حساب موظف",
  };
  return labels[action] ?? action;
}

function supportEventContext(details: SupportAuditEvent["details"]) {
  return [
    details.collection,
    details.recordId ? `سجل ${details.recordId}` : null,
    details.memberId ? `عضو ${details.memberId}` : null,
    details.plan ? `الخطة ${details.plan}` : null,
    details.paidAmount !== undefined ? `مدفوع ${formatMoney(Number(details.paidAmount))}` : null,
    details.amount !== undefined ? `المبلغ ${formatMoney(Number(details.amount))}` : null,
    details.fields,
    details.reason,
  ].filter((value): value is string => typeof value === "string").join(" · ");
}

function getDefaultSubscriptionDates() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  now.setDate(now.getDate() + 30);
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return { today, end, startsAt: today, endsAt: end };
}
