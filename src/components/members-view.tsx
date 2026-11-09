"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Activity, CalendarDays, Check, ChevronDown, CreditCard, Eye, Plus, Search, Trash2, UserRound } from "lucide-react";
import type { Member, MemberActivity } from "@/lib/gym-data";
import { formatHistoryDate, formatHistoryTimestamp } from "@/lib/gym-data";
import { Avatar, Button, EmptyState, Modal, PageHeading, StatusBadge } from "@/components/ui";

type NewMember = Omit<Member, "id" | "membershipHistory" | "activityHistory" | "joinedAt" | "expiresAt" | "status" | "paid" | "initials" | "color">;

export function MembersView({
  members,
  planPrices,
  canWriteMembers,
  canRenewMembers,
  onAdd,
  onDelete,
  onRenew,
  addOpen,
  onAddOpenChange,
  initialQuery,
}: {
  members: Member[];
  planPrices: Record<string, number>;
  canWriteMembers: boolean;
  canRenewMembers: boolean;
  onAdd: (member: NewMember) => Promise<boolean>;
  onDelete: (id: string) => void;
  onRenew: (id: string, plan: string, paidAmount: number, paymentMethod: string) => Promise<boolean>;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("الكل");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = members.find((member) => member.id === selectedId) ?? null;
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalPlan, setRenewalPlan] = useState("");
  const [renewalAmount, setRenewalAmount] = useState("");
  const [renewalMethod, setRenewalMethod] = useState("نقدي");
  const [historyFilter, setHistoryFilter] = useState<"all" | "membership" | "payment" | "attendance">("all");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState("");
  const [formError, setFormError] = useState("");
  const availablePlans = Object.keys(planPrices);
  const selectedPlan = availablePlans.includes(plan) ? plan : availablePlans[0] ?? "";
  const selectedRenewalPlan = availablePlans.includes(renewalPlan) ? renewalPlan : availablePlans[0] ?? "";
  const selectedRenewalAmount = renewalAmount || String(planPrices[selectedRenewalPlan] ?? 0);

  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesQuery = `${member.name} ${member.phone}`.includes(query.trim());
    const matchesFilter = filter === "الكل" || member.status === filter;
    return matchesQuery && matchesFilter;
  }), [filter, members, query]);

  async function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 3) {
      setFormError("اكتب اسمًا كاملًا (٣ أحرف على الأقل).");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setFormError("رقم الهاتف غير مكتمل.");
      return;
    }

    const saved = await onAdd({
      name: name.trim(),
      phone: phone.trim(),
      plan: selectedPlan,
    });
    if (!saved) return;
    setName("");
    setPhone("");
    setPlan(availablePlans[0] ?? "");
    setFormError("");
    onAddOpenChange(false);
  }

  function openRenewal(member: Member) {
    setSelectedId(member.id);
    const selectedPlan = planPrices[member.plan] !== undefined ? member.plan : availablePlans[0] ?? "";
    setRenewalPlan(selectedPlan);
    setRenewalAmount(String(planPrices[selectedPlan] ?? 0));
    setRenewalMethod("نقدي");
    setRenewalOpen(true);
  }

  async function submitRenewal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const paidAmount = Number(selectedRenewalAmount);
    if (!selected || !Number.isFinite(paidAmount) || paidAmount <= 0) return;
    if (await onRenew(selected.id, selectedRenewalPlan, paidAmount, renewalMethod)) setRenewalOpen(false);
  }

  function openMember(member: Member) {
    setSelectedId(member.id);
    setHistoryFilter("all");
  }

  const visibleHistory = selected?.activityHistory
    .filter((entry) => historyFilter === "all" || entry.type === historyFilter)
    .sort((a, b) => b.date.localeCompare(a.date)) ?? [];

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="إدارة النادي"
        title="الأعضاء"
        description="تابع بيانات أعضائك واشتراكاتهم في مكان واحد."
        action={canWriteMembers ? <Button icon={<Plus size={17} />} onClick={() => onAddOpenChange(true)}>إضافة عضو</Button> : undefined}
      />
      <div className="members-summary">
        <div><span className="summary-dot summary-dot-active" /><strong>{members.filter((m) => m.status === "نشط").length}</strong><span>عضو نشط</span></div>
        <i />
        <div><span className="summary-dot summary-dot-warning" /><strong>{members.filter((m) => m.status === "قارب على الانتهاء").length}</strong><span>قرب انتهاء اشتراكه</span></div>
        <i />
        <div><span className="summary-dot summary-dot-muted" /><strong>{members.filter((m) => m.status === "منتهي").length}</strong><span>اشتراك منتهي</span></div>
      </div>

      <section className="panel member-table-panel">
        <div className="table-toolbar">
          <div className="table-title"><h2>كل الأعضاء</h2><span className="count-pill">{filteredMembers.length}</span></div>
          <div className="table-controls">
            <label className="search-field">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو رقم الهاتف" />
            </label>
            <label className="filter-select"><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="فلترة حسب الحالة"><option>الكل</option><option>نشط</option><option>قارب على الانتهاء</option><option>منتهي</option></select><ChevronDown size={14} /></label>
          </div>
        </div>
        {filteredMembers.length ? (
          <div className="table-scroll">
            <table className="data-table members-table">
              <thead><tr><th>العضو</th><th>رقم الهاتف</th><th>نوع الاشتراك</th><th>تاريخ الانضمام</th><th>حالة الاشتراك</th><th>حالة الدفع</th><th><span className="sr-only">الإجراءات</span></th></tr></thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="member-click-row" onClick={() => openMember(member)} onKeyDown={(event) => { if (event.key === "Enter") openMember(member); }} tabIndex={0} aria-label={`فتح سجل ${member.name}`}>
                    <td><div className="member-cell"><Avatar initials={member.initials} color={member.color} /><div><button className="member-name-link" onClick={(event) => { event.stopPropagation(); openMember(member); }}><strong>{member.name}</strong></button><span>رقم العضو #{member.id.slice(0, 8)}</span></div></div></td>
                    <td className="phone-cell" dir="ltr">{member.phone}</td>
                    <td>{member.plan}</td>
                    <td>{member.joinedAt}</td>
                    <td><StatusBadge>{member.status}</StatusBadge></td>
                    <td><span className={`payment-status ${member.paid ? "payment-paid" : "payment-due"}`}><i />{member.paid ? "تم الدفع" : "مستحق"}</span></td>
                    <td><div className="row-actions">
                      <button aria-label={`عرض ${member.name}`} title="عرض الملف والسجل" onClick={(event) => { event.stopPropagation(); openMember(member); }}><Eye size={16} /></button>
                      {canRenewMembers && availablePlans.length > 0 && <button aria-label={`تجديد ${member.name}`} title="تجديد الاشتراك" onClick={(event) => { event.stopPropagation(); openRenewal(member); }}><Check size={16} /></button>}
                      {canWriteMembers && <button aria-label={`حذف ${member.name}`} title="حذف العضو" onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`هل تريد حذف العضو ${member.name}؟`)) onDelete(member.id);
                      }}><Trash2 size={16} /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="لا توجد نتائج" description="جرّب تغيير كلمات البحث أو الفلتر المحدد." />}
        <div className="table-footer"><span>عرض {filteredMembers.length} من {members.length} عضو</span><div><button disabled>السابق</button><button className="current-page">١</button><button disabled>التالي</button></div></div>
      </section>

      <Modal open={addOpen && canWriteMembers} title="إضافة عضو جديد" description="أدخل البيانات الأساسية لبدء ملف العضو." onClose={() => onAddOpenChange(false)}>
        <form className="form-grid" onSubmit={submitMember}>
          <label className="form-field form-field-wide"><span>الاسم بالكامل</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: أحمد محمد علي" /></label>
          <label className="form-field form-field-wide"><span>رقم الهاتف</span><input dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01X XXXX XXXX" /></label>
          <label className="form-field form-field-wide"><span>نوع الاشتراك</span><select required disabled={!availablePlans.length} value={selectedPlan} onChange={(event) => setPlan(event.target.value)}>{availablePlans.map((planName) => <option key={planName}>{planName}</option>)}</select><small className="field-hint">{availablePlans.length ? `السعر الحالي للخطة: ${planPrices[selectedPlan]?.toLocaleString("ar-EG") ?? "—"} ج.م` : "أضف خطة اشتراك أولًا."}</small></label>
          {formError && <p className="form-error form-field-wide">{formError}</p>}
          <div className="form-actions form-field-wide"><Button variant="secondary" type="button" onClick={() => onAddOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={!availablePlans.length}>حفظ العضو</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title="سجل العضو الكامل" description="الاشتراكات والتجديدات والمدفوعات والحضور في ملف واحد." className="member-history-modal" onClose={() => setSelectedId(null)}>
        {selected && <div className="member-profile">
          <div className="profile-identity"><Avatar initials={selected.initials} color={selected.color} /><div><strong>{selected.name}</strong><span>عضو منذ {selected.joinedAt} · #{selected.id.slice(0, 8)}</span></div><StatusBadge>{selected.status}</StatusBadge></div>
          <div className="profile-details">
            <div><span>رقم الهاتف</span><strong dir="ltr">{selected.phone}</strong></div>
            <div><span>الاشتراك الحالي</span><strong>{selected.plan}</strong></div>
            <div><span>تاريخ نهاية الفترة الحالية</span><strong>{selected.expiresAt}</strong></div>
            <div><span>حالة السداد</span><strong>{selected.paid ? "تم الدفع" : "مستحق"}</strong></div>
          </div>
          <div className="history-section-heading"><div><span className="section-index">MEMBER RECORD <i /> {selected.activityHistory.length} EVENTS</span><h3>رحلة {selected.name.split(" ")[0]} في النادي</h3></div><Button icon={<Plus size={15} />} onClick={() => openRenewal(selected)}>تجديد الاشتراك</Button></div>
          <div className="history-filters" role="group" aria-label="تصفية سجل العضو">
            <button className={historyFilter === "all" ? "history-filter-active" : ""} onClick={() => setHistoryFilter("all")}>كل السجل</button>
            <button className={historyFilter === "membership" ? "history-filter-active" : ""} onClick={() => setHistoryFilter("membership")}>الاشتراكات</button>
            <button className={historyFilter === "payment" ? "history-filter-active" : ""} onClick={() => setHistoryFilter("payment")}>المدفوعات</button>
            <button className={historyFilter === "attendance" ? "history-filter-active" : ""} onClick={() => setHistoryFilter("attendance")}>الحضور</button>
          </div>
          <div className="history-timeline">
            {visibleHistory.map((entry) => <HistoryEntry key={entry.id} entry={entry} />)}
            {!visibleHistory.length && <EmptyState title="لا توجد سجلات هنا" description="ستظهر الأحداث الجديدة في هذا القسم." />}
          </div>
          <div className="membership-history">
            <div className="history-section-heading history-section-heading-small"><div><span className="section-index">SUBSCRIPTION LOG <i /> {selected.membershipHistory.length} TERMS</span><h3>فترات الاشتراك السابقة</h3></div></div>
            <div className="membership-terms">
              {[...selected.membershipHistory].reverse().map((period, index) => <div className="membership-term" key={period.id}>
                <span className="term-number">{String(selected.membershipHistory.length - index).padStart(2, "0")}</span>
                <div><strong>{period.plan}</strong><span>{formatHistoryDate(period.startDate)} — {formatHistoryDate(period.endDate)}</span></div>
                <div className="term-amount"><strong>{period.price.toLocaleString("ar-EG")} ج.م</strong><span>المسدد {period.paidAmount.toLocaleString("ar-EG")} ج.م</span></div>
                <StatusBadge>{period.paidAmount >= period.price ? "تم الدفع" : "مستحق"}</StatusBadge>
              </div>)}
            </div>
          </div>
        </div>}
      </Modal>

      <Modal open={renewalOpen && canRenewMembers && Boolean(selected)} title="تجديد اشتراك العضو" description="التجديد يضيف فترة جديدة لنفس ملف العضو ويحافظ على سجل الفترات السابقة." className="renewal-modal" onClose={() => setRenewalOpen(false)}>
        {selected && <form className="form-grid" onSubmit={submitRenewal}>
          <div className="renewal-member form-field-wide"><Avatar initials={selected.initials} color={selected.color} /><div><strong>{selected.name}</strong><span>آخر اشتراك: {selected.plan} · ينتهي {selected.expiresAt}</span></div></div>
          <label className="form-field form-field-wide"><span>الخطة الجديدة</span><select required disabled={!availablePlans.length} value={selectedRenewalPlan} onChange={(event) => { setRenewalPlan(event.target.value); setRenewalAmount(String(planPrices[event.target.value] ?? 0)); }}>{availablePlans.map((planName) => <option key={planName}>{planName}</option>)}</select><small className="field-hint">{availablePlans.length ? "الأسعار قابلة للتعديل من إعدادات النادي." : "أضف خطة اشتراك أولًا."}</small></label>
          <div className="renewal-date-preview form-field-wide"><span><CalendarDays size={15} /> بداية الفترة الجديدة</span><strong>{getNextPeriodStart(selected)}</strong><small>تبدأ بعد انتهاء الفترة الحالية إذا كان الاشتراك ساريًا.</small></div>
          <label className="form-field"><span>المبلغ المدفوع (ج.م)</span><input type="number" min="1" step="1" required value={selectedRenewalAmount} onChange={(event) => setRenewalAmount(event.target.value)} /></label>
          <label className="form-field"><span>طريقة الدفع</span><select value={renewalMethod} onChange={(event) => setRenewalMethod(event.target.value)}><option>نقدي</option><option>بطاقة داخل النادي</option><option>تحويل بنكي</option></select></label>
          <div className="form-actions form-field-wide"><Button variant="secondary" type="button" onClick={() => setRenewalOpen(false)}>إلغاء</Button><Button type="submit">تأكيد التجديد</Button></div>
        </form>}
      </Modal>
    </div>
  );
}

function getNextPeriodStart(member: Member) {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const lastEnd = member.membershipHistory.at(-1)?.endDate;
  if (!lastEnd || lastEnd < todayIso) return formatHistoryDate(todayIso);
  const [year, month, day] = lastEnd.split("-").map(Number);
  return formatHistoryDate(`${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`);
}

function HistoryEntry({ entry }: { entry: MemberActivity }) {
  const Icon = entry.type === "membership"
    ? CalendarDays
    : entry.type === "payment"
      ? CreditCard
      : entry.type === "attendance"
        ? Activity
        : UserRound;
  return (
    <article className={`history-entry history-entry-${entry.type}`}>
      <span className="history-entry-icon"><Icon size={15} /></span>
      <div className="history-entry-copy"><strong>{entry.title}</strong><span>{entry.detail}</span></div>
      <time>{formatHistoryTimestamp(entry.date)}</time>
      {entry.amount !== undefined && <strong className="history-entry-amount">{entry.amount.toLocaleString("ar-EG")} ج.م</strong>}
    </article>
  );
}
