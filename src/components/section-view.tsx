"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpLeft,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import type { GymSection, Member } from "@/lib/gym-data";
import { formatMoney } from "@/lib/gym-data";
import { Avatar, Button, EmptyState, Modal, PageHeading, StatusBadge } from "@/components/ui";

type TableConfig = {
  title: string;
  description: string;
  action: string;
  columns: string[];
  rows: string[][];
  summary: string;
  amount?: string;
};

const tableConfigs: Partial<Record<GymSection, TableConfig>> = {
  memberships: {
    title: "الاشتراكات",
    description: "خطط مرنة تناسب أعضاء ناديك.",
    action: "إضافة خطة",
    columns: ["الخطة", "المدة", "السعر", "الأعضاء", "الحالة"],
    rows: [
      ["اشتراك شهري", "شهر واحد", "٨٥٠ ج.م", "٧٦ عضو", "مفعّل"],
      ["اشتراك ربع سنوي", "٣ أشهر", "٢٬٢٠٠ ج.م", "٣٢ عضو", "مفعّل"],
      ["اشتراك نصف سنوي", "٦ أشهر", "٤٬٠٠٠ ج.م", "١٨ عضو", "مفعّل"],
      ["اشتراك سنوي", "١٢ شهرًا", "٦٬٨٠٠ ج.م", "١٢ عضو", "مفعّل"],
    ],
    summary: "٤ خطط اشتراك",
  },
  attendance: {
    title: "الحضور",
    description: "سجل الحضور اليومي ومتابعة دخول الأعضاء.",
    action: "تسجيل حضور",
    columns: ["العضو", "وقت الدخول", "طريقة التسجيل", "حالة الاشتراك"],
    rows: [
      ["عمر محمود", "١٠:٤٢ ص", "يدوي", "نشط"],
      ["سارة أحمد", "١٠:٣٦ ص", "يدوي", "قارب على الانتهاء"],
      ["يوسف علي", "١٠:٢٨ ص", "يدوي", "نشط"],
      ["ندى خالد", "١٠:١٢ ص", "يدوي", "نشط"],
      ["كريم حسن", "٩:٥٤ ص", "—", "منتهي"],
    ],
    summary: "٨٤ عملية حضور اليوم",
  },
  payments: {
    title: "المدفوعات",
    description: "كل المعاملات المالية اليدوية في مكان واحد.",
    action: "تسجيل دفعة",
    columns: ["العضو", "التفاصيل", "طريقة الدفع", "التاريخ", "المبلغ"],
    rows: [
      ["عمر محمود", "اشتراك شهري", "نقدي", "اليوم، ١٠:٤٢ ص", "٨٥٠ ج.م"],
      ["ندى خالد", "اشتراك سنوي", "بطاقة", "اليوم، ٩:١٥ ص", "٦٬٨٠٠ ج.م"],
      ["مريم إبراهيم", "تجديد اشتراك", "نقدي", "أمس، ٦:٣٠ م", "٢٬٢٠٠ ج.م"],
      ["يوسف علي", "دفعة جزئية", "تحويل بنكي", "أمس، ٤:١٠ م", "٤٠٠ ج.م"],
    ],
    summary: "إجمالي إيرادات اليوم",
    amount: "١٢٬٨٥٠ ج.م",
  },
  trainers: {
    title: "المدربون والموظفون",
    description: "إدارة فريق العمل والأدوار داخل النادي.",
    action: "إضافة موظف",
    columns: ["الموظف", "الدور", "التخصص", "الراتب الشهري", "الحالة"],
    rows: [
      ["محمد سامي", "مدرب", "قوة ولياقة", "٨٬٠٠٠ ج.م", "نشط"],
      ["نهى عادل", "مدربة", "يوغا", "٧٬٥٠٠ ج.م", "نشط"],
      ["علي شريف", "استقبال", "خدمة العملاء", "٥٬٠٠٠ ج.م", "نشط"],
    ],
    summary: "٣ أعضاء في فريق العمل",
  },
  expenses: {
    title: "المصروفات",
    description: "سجّل المصروفات وتابع ميزانية ناديك.",
    action: "إضافة مصروف",
    columns: ["البند", "التصنيف", "التاريخ", "طريقة الدفع", "المبلغ"],
    rows: [
      ["فاتورة الكهرباء", "مرافق", "٢٠ يونيو ٢٠٢٥", "تحويل بنكي", "٣٬٤٥٠ ج.م"],
      ["مستلزمات تنظيف", "تشغيل", "١٨ يونيو ٢٠٢٥", "نقدي", "٧٨٠ ج.م"],
      ["صيانة أجهزة", "صيانة", "١٦ يونيو ٢٠٢٥", "نقدي", "١٬٢٠٠ ج.م"],
    ],
    summary: "إجمالي مصروفات الشهر",
    amount: "١٨٬٤٣٠ ج.م",
  },
};

const initialGyms = [
  { name: "نادي باور هاوس", owner: "أحمد منصور", plan: "احترافي سنوي", end: "١٢ ديسمبر ٢٠٢٥", status: "نشط" },
  { name: "فيت زون", owner: "سلمى حسن", plan: "أساسي شهري", end: "٢٨ يونيو ٢٠٢٥", status: "تجريبي" },
  { name: "أكتف جيم", owner: "محمود عادل", plan: "احترافي شهري", end: "١٥ مايو ٢٠٢٥", status: "موقوف" },
];

export function SectionView({
  section,
  notify,
  members,
  planPrices,
  updatePlanPrices,
  navigate,
  recordAttendance,
  recordPayment,
}: {
  section: GymSection;
  notify: (message: string) => void;
  members: Member[];
  planPrices: Record<string, number>;
  updatePlanPrices: (prices: Record<string, number>) => void;
  navigate: (section: GymSection) => void;
  recordAttendance: (id: number) => void;
  recordPayment: (id: number, amount: number, detail: string, paymentMethod: string) => void;
}) {
  if (section === "settings") return <SettingsView notify={notify} planPrices={planPrices} updatePlanPrices={updatePlanPrices} />;
  if (section === "reports") return <ReportsView notify={notify} />;
  if (section === "platform") return <PlatformView notify={notify} />;

  const config = tableConfigs[section];
  if (!config) return null;
  return <TableSection key={section} config={config} section={section} notify={notify} members={members} planPrices={planPrices} recordAttendance={recordAttendance} recordPayment={recordPayment} navigate={navigate} />;
}

function TableSection({
  config,
  section,
  notify,
  members,
  planPrices,
  navigate,
  recordAttendance,
  recordPayment,
}: {
  config: TableConfig;
  section: GymSection;
  notify: (message: string) => void;
  members: Member[];
  planPrices: Record<string, number>;
  navigate: (section: GymSection) => void;
  recordAttendance: (id: number) => void;
  recordPayment: (id: number, amount: number, detail: string, paymentMethod: string) => void;
}) {
  const [rows, setRows] = useState(config.rows);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [person, setPerson] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const displayRows = section === "memberships"
    ? rows.map((row) => [row[0], row[1], `${formatMoney(planPrices[row[0]] ?? Number(row[2].replace(/\D/g, "")))} ج.م`, row[3], row[4]])
    : rows;
  const filteredRows = useMemo(() => displayRows.filter((row) => row.join(" ").includes(query.trim())), [displayRows, query]);

  const titleMap: Record<GymSection, string> = {
    overview: "", members: "", memberships: "المنتجات والخطط", attendance: "متابعة الدخول",
    payments: "الإدارة المالية", trainers: "الفريق", expenses: "الإدارة المالية",
    reports: "", settings: "", platform: "",
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person.trim()) {
      setError("هذا الحقل مطلوب.");
      return;
    }

    let newRow: string[];
    if (section === "attendance") {
      const digits = person.replace(/\D/g, "");
      const member = members.find((candidate) =>
        candidate.name.includes(person.trim()) || (digits.length > 0 && candidate.phone.replace(/\D/g, "").includes(digits)),
      );
      if (!member) {
        setError("لم نعثر على عضو بهذا الاسم أو الرقم.");
        return;
      }
      if (member.status === "منتهي") {
        setError("لا يمكن تسجيل الحضور؛ اشتراك هذا العضو منتهي.");
        return;
      }
      recordAttendance(member.id);
      newRow = [member.name, "الآن", "يدوي", "نشط"];
    }
    else if (section === "memberships") newRow = [person, details || "شهر واحد", `${amount || "٠"} ج.م`, "٠ عضو", "مفعّل"];
    else if (section === "payments") {
      const digits = person.replace(/\D/g, "");
      const member = members.find((candidate) =>
        candidate.name.includes(person.trim()) || (digits.length > 0 && candidate.phone.replace(/\D/g, "").includes(digits)),
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
      recordPayment(member.id, paymentAmount, details || "دفعة نقدية", "نقدي");
      newRow = [member.name, details || "دفعة نقدية", "نقدي", "اليوم، الآن", `${amount} ج.م`];
    }
    else if (section === "trainers") newRow = [person, details || "مدرب", "لياقة عامة", `${amount || "٠"} ج.م`, "نشط"];
    else newRow = [person, details || "تشغيل", "اليوم", "نقدي", `${amount || "٠"} ج.م`];

    setRows((current) => [newRow, ...current]);
    setPerson("");
    setDetails("");
    setAmount("");
    setError("");
    setShowForm(false);
    notify(section === "attendance" ? "تم تسجيل الحضور بنجاح." : "تمت الإضافة بنجاح.");
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow={titleMap[section]} title={config.title} description={config.description} action={<Button icon={<Plus size={17} />} onClick={() => setShowForm(true)}>{config.action}</Button>} />
      {config.amount && <div className="finance-strip"><div><span>{config.summary}</span><strong>{config.amount}</strong></div><div className="finance-strip-note"><ArrowUpRight size={16} /> أرقام هذا الشهر <span>بيانات تجريبية</span></div></div>}
      {section === "attendance" && <div className="attendance-callout"><span className="callout-icon"><Check size={17} /></span><div><strong>العضوية سارية؟ يمكن تسجيل الحضور</strong><span>نتحقق من حالة الاشتراك قبل تسجيل الدخول.</span></div><span className="callout-live">مباشر</span></div>}
      {section === "memberships" && <MembershipPlanCards rows={filteredRows} onAdd={() => setShowForm(true)} onSettings={() => navigate("settings")} />}
      {section !== "memberships" && <section className="panel member-table-panel">
        <div className="table-toolbar">
          <div className="table-title"><h2>{section === "attendance" ? "سجل اليوم" : section === "payments" ? "سجل المعاملات" : config.title}</h2><span className="count-pill">{filteredRows.length}</span></div>
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
        </table></div> : <EmptyState title="لا توجد نتائج" description="لا توجد عناصر تطابق بحثك." />}
        <div className="table-footer"><span>{config.summary}</span><div><button disabled>السابق</button><button className="current-page">١</button><button disabled>التالي</button></div></div>
      </section>}
      <Modal open={showForm} title={config.action} description="أدخل البيانات المطلوبة ثم احفظ التغييرات." onClose={() => setShowForm(false)}>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field form-field-wide"><span>{section === "attendance" ? "اسم العضو أو رقم الهاتف" : section === "expenses" ? "اسم المصروف" : section === "memberships" ? "اسم الخطة" : section === "trainers" ? "اسم الموظف" : "اسم العضو"}</span><input autoFocus value={person} onChange={(event) => setPerson(event.target.value)} placeholder="اكتب هنا..." /></label>
          {section !== "attendance" && <label className="form-field form-field-wide"><span>{section === "memberships" ? "مدة الاشتراك" : section === "payments" ? "تفاصيل الدفعة" : section === "expenses" ? "التصنيف" : "الدور / التخصص"}</span><input value={details} onChange={(event) => setDetails(event.target.value)} placeholder="اختياري" /></label>}
          {section !== "attendance" && <label className="form-field form-field-wide"><span>{section === "memberships" ? "السعر (ج.م)" : section === "trainers" ? "الراتب الشهري (ج.م)" : "المبلغ (ج.م)"}</span><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>}
          {error && <p className="form-error form-field-wide">{error}</p>}
          <div className="form-actions form-field-wide"><Button variant="secondary" type="button" onClick={() => setShowForm(false)}>إلغاء</Button><Button type="submit">حفظ</Button></div>
        </form>
      </Modal>
    </div>
  );
}

function MembershipPlanCards({ rows, onAdd, onSettings }: { rows: string[][]; onAdd: () => void; onSettings: () => void }) {
  const planNotes = ["الاختيار الأكثر مرونة", "قيمة أفضل على المدى المتوسط", "للملتزمين بالتدريب", "أفضل قيمة سنوية"];
  const planAccents = ["plan-card-lime", "plan-card-cream", "plan-card-dark", "plan-card-orange"];

  return (
    <section className="plan-library">
      <div className="plan-library-heading">
        <div>
          <span className="section-index">MEMBERSHIP STUDIO <i /> {String(rows.length).padStart(2, "0")} PLANS</span>
          <h2>كل خطة، لها إيقاعها.</h2>
        </div>
        <button className="plan-library-link" onClick={onSettings}>تعديل الأسعار من الإعدادات <ArrowUpLeft size={14} /></button>
      </div>
      <div className="plan-card-grid">
        {rows.map((row, index) => (
          <article className={`plan-card ${planAccents[index % planAccents.length]}`} key={`${row[0]}-${index}`}>
            <div className="plan-card-top"><span className="plan-card-number">PLAN / {String(index + 1).padStart(2, "0")}</span><StatusBadge>{row[4]}</StatusBadge></div>
            <div className="plan-card-content">
              <span className="plan-card-note">{planNotes[index % planNotes.length]}</span>
              <h3>{row[0]}</h3>
              <div className="plan-duration">{row[1]} <span>·</span> وصول كامل لمرافق النادي</div>
              <div className="plan-price">{row[2].replace(" ج.م", "")}<small> ج.م <i>/ للفترة</i></small></div>
            </div>
            <div className="plan-card-bottom">
              <div className="plan-usage"><div className="plan-usage-label"><span>الأعضاء على الخطة</span><strong>{row[3]}</strong></div><div className="plan-usage-track"><i style={{ width: `${[78, 51, 35, 24][index % 4]}%` }} /></div></div>
              <button onClick={onAdd}>تعديل الخطة <ArrowUpLeft size={14} /></button>
            </div>
            {index === 0 && <span className="plan-card-stamp">الأكثر<br />استخدامًا</span>}
          </article>
        ))}
        <button className="plan-create-card" onClick={onAdd}><span><Plus size={21} /></span><strong>مساحة لخطة جديدة</strong><small>صمّم باقة جديدة لأعضائك</small></button>
      </div>
    </section>
  );
}

function ReportsView({ notify }: { notify: (message: string) => void }) {
  const reportRows = [
    ["نمو الأعضاء", "+١٨ عضو", "↑ ١٢٪", "هذا الشهر"],
    ["تجديد الاشتراكات", "٣٤ اشتراك", "↑ ٨٪", "هذا الشهر"],
    ["معدل الحضور", "٧٢٪", "↑ ٤٪", "هذا الشهر"],
    ["صافي الإيرادات", "١٠٦٬٤٢٠ ج.م", "↑ ١٤٪", "هذا الشهر"],
  ];

  function exportCsv() {
    const csv = ["التقرير,النتيجة,التغير,الفترة", ...reportRows.map((row) => row.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    link.download = "gymflow-reports.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    notify("تم تنزيل التقرير بصيغة CSV.");
  }

  return <div className="page-stack">
    <PageHeading eyebrow="تحليلات النادي" title="التقارير" description="صورة أوضح لأداء ناديك واتجاهاته." action={<Button variant="secondary" icon={<Download size={16} />} onClick={exportCsv}>تصدير CSV</Button>} />
    <div className="report-filters"><button className="select-button">هذا الشهر <ChevronDown size={14} /></button><span>١ يونيو — ٣٠ يونيو ٢٠٢٥</span></div>
    <div className="report-kpis">{reportRows.map((row) => <article className="stat-card report-kpi" key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><div><span className="trend-positive">{row[2]}</span><span>{row[3]}</span></div></article>)}</div>
    <section className="panel report-panel"><div className="panel-heading"><div><h2>أداء النادي</h2><p>مؤشرات مختارة لهذا الشهر</p></div><span className="report-period">مقارنة بالشهر السابق</span></div><div className="report-bars">{reportRows.map((row, index) => <div key={row[0]}><span>{row[0]}</span><div className="report-track"><i style={{ width: `${[78, 62, 72, 88][index]}%` }} /></div><strong>{row[1]}</strong></div>)}</div></section>
    <div className="data-note"><CircleHelp size={15} /> بعض الأرقام في هذه النسخة تجريبية ويمكن تعديلها من خلال بيانات النظام.</div>
  </div>;
}

function SettingsView({
  notify,
  planPrices,
  updatePlanPrices,
}: {
  notify: (message: string) => void;
  planPrices: Record<string, number>;
  updatePlanPrices: (prices: Record<string, number>) => void;
}) {
  const [gymName, setGymName] = useState("باور هاوس جيم");
  const [phone, setPhone] = useState("010 5555 1212");
  const [address, setAddress] = useState("شارع التسعين، القاهرة الجديدة");
  const [currency, setCurrency] = useState("الجنيه المصري (ج.م)");
  const [saved, setSaved] = useState(false);
  const [expirationAlerts, setExpirationAlerts] = useState(true);
  const [draftPrices, setDraftPrices] = useState(planPrices);

  return <div className="page-stack">
    <PageHeading eyebrow="إعدادات النادي" title="الإعدادات" description="خصص بيانات النادي وتفضيلات حسابك." />
    <div className="settings-layout">
      <aside className="settings-nav"><button className="settings-nav-active"><Building2 size={16} /> بيانات النادي</button><button><ShieldCheck size={16} /> الأدوار والصلاحيات</button><button><SlidersHorizontal size={16} /> التفضيلات</button></aside>
      <section className="panel settings-panel">
        <div className="panel-heading"><div><h2>معلومات النادي</h2><p>تظهر هذه البيانات في ملفات الأعضاء والتقارير.</p></div><span className="settings-logo">PH</span></div>
        <form className="settings-form" onSubmit={(event) => {
          event.preventDefault();
          if (Object.values(draftPrices).some((price) => !Number.isFinite(price) || price <= 0)) return;
          updatePlanPrices(draftPrices);
          setSaved(true);
          notify("تم حفظ إعدادات النادي وأسعار الاشتراكات.");
        }}>
          <label className="form-field"><span>اسم النادي</span><input value={gymName} onChange={(event) => setGymName(event.target.value)} /></label>
          <label className="form-field"><span>رقم الهاتف</span><input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label className="form-field form-field-wide"><span>العنوان</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label className="form-field"><span>العملة الافتراضية</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>الجنيه المصري (ج.م)</option><option>الريال السعودي (ر.س)</option><option>الدولار الأمريكي ($)</option></select></label>
          <div className="pricing-editor-heading form-field-wide"><div><h3>أسعار خطط الاشتراك</h3><p>الأسعار هنا هي المقترحة عند تسجيل عضو أو تجديد اشتراكه.</p></div><span>EGP / ج.م</span></div>
          {Object.entries(draftPrices).map(([planName, price]) => <label className="form-field" key={planName}>
            <span>{planName}</span>
            <div className="price-input-wrap"><input type="number" min="1" step="1" required value={price} onChange={(event) => {
              const nextPrice = Number(event.target.value);
              setDraftPrices((current) => ({ ...current, [planName]: nextPrice }));
            }} /><span>ج.م</span></div>
          </label>)}
          <div className="settings-toggle form-field-wide"><div><strong>تنبيهات قرب انتهاء الاشتراك</strong><span>أظهر تنبيهًا قبل ٧ أيام من انتهاء الاشتراك.</span></div><button type="button" className={`toggle-switch ${expirationAlerts ? "" : "toggle-off"}`} aria-label="تفعيل التنبيهات" aria-pressed={expirationAlerts} onClick={() => setExpirationAlerts((enabled) => !enabled)}><i /></button></div>
          <div className="form-actions form-field-wide"><span>{saved ? "تم حفظ التغييرات" : "آخر تحديث: اليوم"}</span><Button type="submit">حفظ التغييرات</Button></div>
        </form>
      </section>
    </div>
  </div>;
}

function PlatformView({ notify }: { notify: (message: string) => void }) {
  const [gyms, setGyms] = useState(initialGyms);
  const active = gyms.filter((gym) => gym.status === "نشط").length + 23;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");

  function addGym(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !owner.trim()) return;
    setGyms((current) => [{ name, owner, plan: "تجريبي", end: "١٤ يومًا", status: "تجريبي" }, ...current]);
    setShowForm(false);
    setName("");
    setOwner("");
    notify("تم إنشاء حساب النادي التجريبي.");
  }

  return <div className="page-stack">
    <PageHeading eyebrow="مساحة المالك" title="إدارة المنصة" description="إدارة حسابات الأندية واشتراكات GymFlow." action={<Button icon={<Plus size={17} />} onClick={() => setShowForm(true)}>إضافة نادي</Button>} />
    <div className="owner-banner"><span className="owner-shield"><ShieldCheck size={18} /></span><div><strong>لوحة مالك المنصة</strong><span>التحكم في اشتراكات GymFlow منفصل تمامًا عن عضويات أعضاء النادي.</span></div><span className="owner-only">للمالك فقط</span></div>
    <div className="stats-grid owner-stats"><article className="stat-card"><span className="stat-label">إجمالي الأندية</span><strong className="stat-value">٢٨</strong><span className="stat-foot">+٣ هذا الشهر</span></article><article className="stat-card"><span className="stat-label">حسابات نشطة</span><strong className="stat-value">{formatMoney(active)}</strong><span className="stat-foot">اشتراكات فعالة</span></article><article className="stat-card"><span className="stat-label">حسابات تجريبية</span><strong className="stat-value">٣</strong><span className="stat-foot">فترة تجريبية</span></article><article className="stat-card"><span className="stat-label">اشتراكات منتهية</span><strong className="stat-value">٢</strong><span className="stat-foot">تحتاج إلى مراجعة</span></article></div>
    <section className="panel member-table-panel">
      <div className="table-toolbar"><div className="table-title"><div><h2>حسابات الأندية</h2><span className="panel-subtitle">تحكم يدوي في حالة الاشتراك وتاريخ الانتهاء.</span></div></div><button className="filter-select"><SlidersHorizontal size={15} /> تصفية</button></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>النادي</th><th>المالك</th><th>الخطة الحالية</th><th>تاريخ الانتهاء</th><th>حالة الحساب</th><th>إجراءات</th></tr></thead><tbody>
        {gyms.map((gym) => <tr key={gym.name}><td><div className="member-cell"><span className="gym-avatar"><Building2 size={16} /></span><strong>{gym.name}</strong></div></td><td>{gym.owner}</td><td>{gym.plan}</td><td>{gym.end}</td><td><StatusBadge>{gym.status}</StatusBadge></td><td><button className="owner-action" onClick={() => { setGyms((current) => current.map((item) => item.name === gym.name ? { ...item, status: item.status === "موقوف" ? "نشط" : "موقوف" } : item)); notify(gym.status === "موقوف" ? "تمت إعادة تفعيل الحساب." : "تم إيقاف الحساب."); }}>{gym.status === "موقوف" ? "إعادة التفعيل" : "إيقاف الحساب"}</button></td></tr>)}
      </tbody></table></div>
      <div className="owner-table-note"><Wallet size={15} /> لا توجد مدفوعات تلقائية. تفعيل الاشتراك وتجديده يتم يدويًا بواسطة مالك المنصة.</div>
    </section>
    <Modal open={showForm} title="إضافة نادي جديد" description="سيُنشأ الحساب بحالة تجريبية لحين مراجعة الاشتراك." onClose={() => setShowForm(false)}><form className="form-grid" onSubmit={addGym}><label className="form-field form-field-wide"><span>اسم النادي</span><input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-field form-field-wide"><span>اسم المالك</span><input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><div className="form-actions form-field-wide"><Button variant="secondary" type="button" onClick={() => setShowForm(false)}>إلغاء</Button><Button type="submit">إنشاء الحساب</Button></div></form></Modal>
  </div>;
}
