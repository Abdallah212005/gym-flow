"use client";

import {
  ArrowDownLeft,
  ArrowUpLeft,
  CalendarDays,
  ChevronLeft,
  Clock3,
  CreditCard,
  Ellipsis,
  Plus,
  ScanLine,
  UsersRound,
} from "lucide-react";
import type { GymAppData, Member, GymSection } from "@/lib/gym-data";
import { formatMoney } from "@/lib/gym-data";
import { Avatar, Button, EmptyState, StatusBadge } from "@/components/ui";

export function DashboardView({
  members,
  data,
  onNavigate,
  onAddMember,
  canAddMember,
  canReadMembers,
  canReadPayments,
  canReadAttendance,
}: {
  members: Member[];
  data: GymAppData;
  onNavigate: (section: GymSection) => void;
  onAddMember: () => void;
  canAddMember: boolean;
  canReadMembers: boolean;
  canReadPayments: boolean;
  canReadAttendance: boolean;
}) {
  const activeCount = members.filter((member) => member.status === "نشط").length;
  const pendingAmount = members.reduce((total, member) => {
    const period = member.membershipHistory.at(-1);
    return total + Math.max((period?.price ?? 0) - (period?.paidAmount ?? 0), 0);
  }, 0);
  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
  const todayAttendance = data.attendance.filter((entry) => String(entry.createdAt ?? "").startsWith(today));
  const todayPayments = data.payments.filter((entry) => String(entry.createdAt ?? "").startsWith(today));
  const todayRevenue = todayPayments.reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const value = data.payments
      .filter((payment) => String(payment.createdAt ?? "").startsWith(key))
      .reduce((total, payment) => total + Number(payment.amount ?? 0), 0);
    return {
      label: new Intl.DateTimeFormat("ar-EG", { month: "short" }).format(date),
      value,
    };
  });
  const maxMonthlyRevenue = Math.max(1, ...monthlyRevenue.map((month) => month.value));
  const recentPayments = data.payments.slice(0, 3);

  return (
    <div className="page-stack">
      <div className="demo-banner">
        <span className="demo-indicator" />
        <span>ملخص بيانات النادي المسجلة</span>
      </div>

      <section className="dashboard-hero">
        <div className="hero-copy">
          <h1>نظرة عامة</h1>
          <p>ملخص سريع لأداء النادي اليوم.</p>
          <div className="hero-actions">
            {canAddMember && <Button icon={<Plus size={16} />} onClick={onAddMember}>عضو جديد</Button>}
            {canReadAttendance && <button className="hero-link" onClick={() => onNavigate("attendance")}><ScanLine size={16} /> سجل الحضور <ArrowUpLeft size={14} /></button>}
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="ملخص النادي">
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-green"><UsersRound size={18} /></span><span className="stat-label">الأعضاء النشطون</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(activeCount)}<span className="stat-unit">عضو</span></div>
          <div className="stat-foot"><span>إجمالي الأعضاء المسجلين</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-blue"><CalendarDays size={18} /></span><span className="stat-label">حضور اليوم</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(todayAttendance.length)}<span className="stat-unit">عضو</span></div>
          <div className="stat-foot"><span>حالات الحضور المسجلة اليوم</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-sand"><CreditCard size={18} /></span><span className="stat-label">إيرادات اليوم</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(todayRevenue)}<span className="stat-unit">ج.م</span></div>
          <div className="stat-foot"><span>المدفوعات المسجلة اليوم</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-rose"><Clock3 size={18} /></span><span className="stat-label">مستحقات معلّقة</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(pendingAmount)}<span className="stat-unit">ج.م</span></div>
          <div className="stat-foot"><span className="stat-foot-alert">{members.filter((member) => !member.paid).length} أعضاء</span><span>بحاجة إلى متابعة</span></div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel revenue-panel">
          <div className="panel-heading">
            <div><h2>نظرة على الإيرادات</h2><p>المدفوعات المسجلة خلال آخر ٦ أشهر</p></div>
            <button className="select-button">هذا العام <ChevronLeft size={14} /></button>
          </div>
          <div className="revenue-summary"><strong>{formatMoney(monthlyRevenue.reduce((total, month) => total + month.value, 0))} <small>ج.م</small></strong><span className="summary-caption">آخر ٦ أشهر</span></div>
          <div className="chart" role="img" aria-label="رسم بياني للإيرادات خلال آخر ستة أشهر">
            <div className="chart-scale"><span>{formatMoney(maxMonthlyRevenue)} ج.م</span><span>{formatMoney(Math.round(maxMonthlyRevenue * 2 / 3))}</span><span>{formatMoney(Math.round(maxMonthlyRevenue / 3))}</span><span>٠</span></div>
            <div className="chart-area">
              <div className="chart-lines"><i /><i /><i /><i /></div>
              <div className="chart-bars">
                {monthlyRevenue.map((month, index) => (
                  <div className="chart-column" key={month.label}>
                    <span className={`chart-bar ${index === 5 ? "chart-bar-current" : ""}`} style={{ height: `${Math.max(month.value ? (month.value / maxMonthlyRevenue) * 100 : 0, month.value ? 8 : 0)}%` }} />
                    <span className="chart-label">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {!data.payments.length && <p className="dashboard-empty-note">ستظهر الإيرادات بعد تسجيل أول دفعة.</p>}
        </article>

        {canReadAttendance && <article className="panel attendance-panel">
          <div className="panel-heading">
            <div><h2>حضور اليوم</h2><p>{new Intl.DateTimeFormat("ar-EG", { dateStyle: "long" }).format(new Date())}</p></div>
            <button className="icon-quiet" aria-label="خيارات"><Ellipsis size={19} /></button>
          </div>
          <div className="attendance-total"><strong>{formatMoney(todayAttendance.length)}</strong><span>عضو سجّلوا حضورهم اليوم</span></div>
          <div className="attendance-progress"><span style={{ width: `${activeCount ? Math.min((todayAttendance.length / activeCount) * 100, 100) : 0}%` }} /></div>
          <div className="attendance-meta"><span>من أصل {formatMoney(activeCount)} عضو نشط</span><strong>{activeCount ? `${Math.round((todayAttendance.length / activeCount) * 100)}٪` : "٠٪"}</strong></div>
          <div className="mini-divider" />
          <div className="attendance-split">
            <div><span className="dot dot-green" /><span>دخول يدوي</span><strong>{formatMoney(todayAttendance.filter((entry) => entry.method === "يدوي").length)}</strong></div>
            <div><span className="dot dot-blue" /><span>إجمالي الحضور</span><strong>{formatMoney(todayAttendance.length)}</strong></div>
          </div>
          <Button variant="secondary" className="full-button" onClick={() => onNavigate("attendance")}>عرض سجل الحضور <ArrowUpLeft size={15} /></Button>
        </article>}
      </section>

      <section className="dashboard-grid lower-grid">
        {canReadMembers && <article className="panel table-panel">
          <div className="panel-heading">
            <div><h2>أحدث الأعضاء</h2><p>الأعضاء الذين انضموا مؤخرًا</p></div>
            <button className="text-link" onClick={() => onNavigate("members")}>عرض الكل <ChevronLeft size={14} /></button>
          </div>
          <div className="compact-list">
            {members.slice(0, 4).map((member) => (
              <div className="compact-row" key={member.id}>
                <Avatar initials={member.initials} color={member.color} />
                <div className="compact-person"><strong>{member.name}</strong><span>{member.plan}</span></div>
                <span className="compact-date">{member.joinedAt}</span>
                <StatusBadge>{member.status}</StatusBadge>
              </div>
            ))}
            {!members.length && <EmptyState title="لا يوجد أعضاء بعد" description="أضف أول عضو لبدء استخدام النظام." />}
          </div>
          {canAddMember && <button className="compact-add" onClick={onAddMember}><Plus size={15} /> إضافة عضو جديد</button>}
        </article>
        }
        {canReadPayments && <article className="panel table-panel transaction-panel">
          <div className="panel-heading">
            <div><h2>آخر المعاملات</h2><p>المدفوعات المسجلة مؤخرًا</p></div>
            <button className="text-link" onClick={() => onNavigate("payments")}>كل المعاملات <ChevronLeft size={14} /></button>
          </div>
          <div className="transaction-list">
            {recentPayments.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <span className="transaction-icon"><ArrowDownLeft size={16} /></span>
                <div className="transaction-person"><strong>{String(transaction.memberName ?? "دفعة")}</strong><span>{String(transaction.detail ?? "")} · {new Intl.DateTimeFormat("ar-EG", { dateStyle: "short" }).format(new Date(String(transaction.createdAt)))}</span></div>
                <div className="transaction-amount"><strong>+{formatMoney(Number(transaction.amount ?? 0))}</strong><span>ج.م</span></div>
              </div>
            ))}
            {!recentPayments.length && <EmptyState title="لا توجد معاملات بعد" description="ستظهر الدفعات هنا بعد تسجيلها." />}
          </div>
          <button className="compact-add" onClick={() => onNavigate("payments")}><Plus size={15} /> تسجيل دفعة جديدة</button>
        </article>}
      </section>
    </div>
  );
}
