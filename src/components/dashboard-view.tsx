"use client";

import {
  ArrowDownLeft,
  ArrowUpLeft,
  BadgeCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  CreditCard,
  Plus,
  ScanLine,
  Trophy,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import type { GymAppData, Member, GymSection } from "@/lib/gym-data";
import { formatMoney } from "@/lib/gym-data";
import { Avatar, EmptyState, StatusBadge } from "@/components/ui";

export function DashboardView({
  members,
  data,
  onNavigate,
  onAddMember,
  canAddMember,
  canReadMembers,
  canReadMemberships,
  canReadPayments,
  canReadAttendance,
  canReadReports,
}: {
  members: Member[];
  data: GymAppData;
  onNavigate: (section: GymSection) => void;
  onAddMember: () => void;
  canAddMember: boolean;
  canReadMembers: boolean;
  canReadMemberships: boolean;
  canReadPayments: boolean;
  canReadAttendance: boolean;
  canReadReports: boolean;
}) {
  const activeCount = members.filter((member) => member.status === "نشط").length;
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
  const totalRevenue = monthlyRevenue.reduce((total, month) => total + month.value, 0);
  const pendingAmount = members.reduce((total, member) => {
    const period = member.membershipHistory.at(-1);
    return total + Math.max((period?.price ?? 0) - (period?.paidAmount ?? 0), 0);
  }, 0);
  const chartPoints = monthlyRevenue.map((month, index) => ({
    x: monthlyRevenue.length > 1 ? 18 + index * (564 / (monthlyRevenue.length - 1)) : 300,
    y: 170 - (month.value / maxMonthlyRevenue) * 132,
  }));
  const chartLine = chartPoints.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = chartPoints[index - 1];
    const midpoint = (previous.x + point.x) / 2;
    return `${path} C ${midpoint} ${previous.y}, ${midpoint} ${point.y}, ${point.x} ${point.y}`;
  }, "");
  const firstChartPoint = chartPoints[0];
  const lastChartPoint = chartPoints[chartPoints.length - 1];
  const chartArea = firstChartPoint && lastChartPoint ? `${chartLine} L ${lastChartPoint.x} 190 L ${firstChartPoint.x} 190 Z` : "";
  const memberActivities = members.flatMap((member) =>
    member.activityHistory
      .filter((activity) =>
        activity.type === "registration" ? canReadMembers
          : activity.type === "membership" ? canReadMemberships
            : activity.type === "payment" ? canReadPayments
              : canReadAttendance,
      )
      .map((activity) => ({ ...activity, memberName: member.name })),
  );
  const collectionActivities = !canReadMembers
    ? [
        ...(canReadPayments ? data.payments.map((payment) => ({
          id: String(payment.id ?? payment.createdAt ?? ""),
          type: "payment" as const,
          date: String(payment.createdAt ?? ""),
          title: "تسجيل دفعة",
          detail: String(payment.detail ?? ""),
          memberName: String(payment.memberName ?? "عضو"),
        })) : []),
        ...(canReadAttendance ? data.attendance.map((entry) => ({
          id: String(entry.id ?? entry.createdAt ?? ""),
          type: "attendance" as const,
          date: String(entry.createdAt ?? ""),
          title: "تسجيل حضور",
          detail: String(entry.method ?? ""),
          memberName: String(entry.memberName ?? "عضو"),
        })) : []),
      ]
    : [];
  const recentActivities = [...memberActivities, ...collectionActivities]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 4);
  const recentPayments = data.payments.slice(0, 3);

  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero-photo" aria-hidden="true" />
        <div className="hero-copy">
          <span className="hero-kicker">أهلاً بك في</span>
          <h1><span>GymFlow</span></h1>
          <p>إدارة أذكى .. لنمو أكبر لناديك</p>
        </div>
      </section>

      <section className="stats-grid" aria-label="ملخص النادي">
        <article className="stat-card">
          <div className="stat-icon stat-icon-green"><CreditCard size={21} /></div>
          <div className="stat-value">{formatMoney(todayRevenue)}<span className="stat-unit">ج.م</span></div>
          <div className="stat-label">مبيعات اليوم</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon stat-icon-blue"><ScanLine size={21} /></div>
          <div className="stat-value">{formatMoney(todayAttendance.length)}<span className="stat-unit">عضو</span></div>
          <div className="stat-label">حضور اليوم</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon stat-icon-sand"><BadgeCheck size={21} /></div>
          <div className="stat-value">{formatMoney(activeCount)}<span className="stat-unit">عضو</span></div>
          <div className="stat-label">الأعضاء النشطون</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon stat-icon-rose"><Wallet size={21} /></div>
          <div className="stat-value">{formatMoney(pendingAmount)}<span className="stat-unit">ج.م</span></div>
          <div className="stat-label">مستحقات معلّقة</div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-overview-grid">
        {canReadMembers || canReadMemberships || canReadPayments || canReadAttendance ? <article className="panel activity-panel">
          <div className="panel-heading">
            <div><h2>أحدث الأنشطة</h2><p>آخر التحديثات في ناديك</p></div>
            <Zap size={19} className="activity-heading-icon" />
          </div>
          <div className="activity-list">
            {recentActivities.map((activity) => {
              const ActivityIcon = activity.type === "registration" ? UserRound
                : activity.type === "membership" ? CalendarDays
                  : activity.type === "payment" ? CreditCard
                    : ScanLine;
              return (
                <div className="activity-row" key={activity.id}>
                  <span className={`activity-icon activity-icon-${activity.type}`}><ActivityIcon size={16} /></span>
                  <div className="activity-copy"><strong>{activity.title}</strong><span>{activity.memberName}</span></div>
                  <time dateTime={activity.date}>{new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(activity.date))}</time>
                </div>
              );
            })}
            {!recentActivities.length && <EmptyState title="لا توجد أنشطة بعد" description="ستظهر هنا أحدث تحديثات النادي." />}
          </div>
        </article> : null}

        <article className="panel revenue-panel">
          <div className="panel-heading">
            <div><h2><ChartNoAxesCombined size={17} /> الإيرادات خلال آخر ٦ أشهر</h2></div>
            <span className="chart-period">آخر ٦ أشهر <ChevronLeft size={14} /></span>
          </div>
          <div className="revenue-summary"><strong>{formatMoney(totalRevenue)} <small>ج.م</small></strong></div>
          <div className="chart" role="img" aria-label="رسم بياني للإيرادات خلال آخر ستة أشهر">
            <svg className="revenue-chart-svg" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--ds-lime-400)" stopOpacity=".38" />
                  <stop offset="100%" stopColor="var(--ds-lime-400)" stopOpacity=".03" />
                </linearGradient>
              </defs>
              {[36, 78, 120, 162, 190].map((y) => <line key={y} x1="16" x2="584" y1={y} y2={y} className="revenue-chart-gridline" />)}
              {chartArea && <path d={chartArea} fill="url(#revenue-fill)" />}
              {chartLine && <path d={chartLine} className="revenue-chart-line" />}
              {chartPoints.map((point, index) => <circle key={monthlyRevenue[index].label} cx={point.x} cy={point.y} r="5" className={`revenue-chart-point ${index === chartPoints.length - 1 ? "revenue-chart-point-current" : ""}`} />)}
            </svg>
            <div className="chart-labels" aria-hidden="true">
              {monthlyRevenue.map((month) => <span key={month.label}>{month.label}</span>)}
            </div>
          </div>
          {!data.payments.length && <p className="dashboard-empty-note">ستظهر الإيرادات بعد تسجيل أول دفعة.</p>}
        </article>

        <article className="promo-card">
          <div className="promo-card-copy">
            <Trophy size={29} />
            <h2>نادي أقوى<br />بإدارة أذكى</h2>
            <div className="promo-card-actions">
              {canReadReports && <button onClick={() => onNavigate("reports")}>عرض التقارير <ArrowUpLeft size={14} /></button>}
              {!canReadReports && canAddMember && <button onClick={onAddMember}>إضافة عضو <Plus size={14} /></button>}
            </div>
          </div>
        </article>
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
