"use client";

import {
  ArrowDownLeft,
  ArrowUpLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  Clock3,
  CreditCard,
  Ellipsis,
  Plus,
  ScanLine,
  UsersRound,
} from "lucide-react";
import type { Member, GymSection } from "@/lib/gym-data";
import { formatMoney, monthlyRevenue, recentTransactions } from "@/lib/gym-data";
import { Avatar, Button, StatusBadge } from "@/components/ui";

export function DashboardView({
  members,
  onNavigate,
  onAddMember,
}: {
  members: Member[];
  onNavigate: (section: GymSection) => void;
  onAddMember: () => void;
}) {
  const activeCount = members.filter((member) => member.status === "نشط").length + 118;
  const pendingCount = members.filter((member) => !member.paid).length + 7;

  return (
    <div className="page-stack">
      <div className="demo-banner">
        <span className="demo-indicator" />
        <span>أنت تستعرض بيانات تجريبية</span>
        <span className="demo-separator">·</span>
        <button onClick={() => onNavigate("settings")}>اعرف المزيد</button>
      </div>

      <section className="dashboard-hero">
        <div className="hero-copy">
          <h1>نظرة عامة</h1>
          <p>ملخص سريع لأداء النادي اليوم.</p>
          <div className="hero-actions">
            <Button icon={<Plus size={16} />} onClick={onAddMember}>عضو جديد</Button>
            <button className="hero-link" onClick={() => onNavigate("attendance")}><ScanLine size={16} /> تسجيل الحضور <ArrowUpLeft size={14} /></button>
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="ملخص النادي">
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-green"><UsersRound size={18} /></span><span className="stat-label">الأعضاء النشطون</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(activeCount)}<span className="stat-unit">عضو</span></div>
          <div className="stat-foot"><span className="trend-positive"><ArrowUpRight size={14} /> ٨٫٢٪</span><span>مقارنة بالشهر الماضي</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-blue"><CalendarDays size={18} /></span><span className="stat-label">حضور اليوم</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">٨٤<span className="stat-unit">عضو</span></div>
          <div className="stat-foot"><span className="trend-positive"><ArrowUpRight size={14} /> ١٢٪</span><span>من متوسط الأسبوع</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-sand"><CreditCard size={18} /></span><span className="stat-label">إيرادات اليوم</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(12850)}<span className="stat-unit">ج.م</span></div>
          <div className="stat-foot"><span className="trend-positive"><ArrowUpRight size={14} /> ٤٫٥٪</span><span>مقارنة بالأمس</span></div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span className="stat-icon stat-icon-rose"><Clock3 size={18} /></span><span className="stat-label">مستحقات معلّقة</span><button aria-label="المزيد"><Ellipsis size={18} /></button></div>
          <div className="stat-value">{formatMoney(pendingCount * 650)}<span className="stat-unit">ج.م</span></div>
          <div className="stat-foot"><span className="stat-foot-alert">{pendingCount} أعضاء</span><span>بحاجة إلى متابعة</span></div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel revenue-panel">
          <div className="panel-heading">
            <div><h2>نظرة على الإيرادات</h2><p>أداء الإيرادات خلال آخر ٦ أشهر</p></div>
            <button className="select-button">هذا العام <ChevronLeft size={14} /></button>
          </div>
          <div className="revenue-summary"><strong>١٢٤٬٨٥٠ <small>ج.م</small></strong><span className="trend-positive"><ArrowUpRight size={14} /> ١٤٫٨٪</span><span className="summary-caption">عن الفترة السابقة</span></div>
          <div className="chart" role="img" aria-label="رسم بياني للإيرادات من يناير حتى يونيو">
            <div className="chart-scale"><span>١٥ ألف</span><span>١٠ آلاف</span><span>٥ آلاف</span><span>٠</span></div>
            <div className="chart-area">
              <div className="chart-lines"><i /><i /><i /><i /></div>
              <div className="chart-bars">
                {monthlyRevenue.map((month, index) => (
                  <div className="chart-column" key={month.label}>
                    <span className={`chart-bar ${index === 5 ? "chart-bar-current" : ""}`} style={{ height: `${month.value}%` }} />
                    <span className="chart-label">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="panel attendance-panel">
          <div className="panel-heading">
            <div><h2>حضور اليوم</h2><p>الأحد، ٢٢ يونيو</p></div>
            <button className="icon-quiet" aria-label="خيارات"><Ellipsis size={19} /></button>
          </div>
          <div className="attendance-total"><strong>٨٤</strong><span>عضو سجّلوا حضورهم</span></div>
          <div className="attendance-progress"><span style={{ width: "72%" }} /></div>
          <div className="attendance-meta"><span>من أصل ١١٧ عضو نشط</span><strong>٧٢٪</strong></div>
          <div className="mini-divider" />
          <div className="attendance-split">
            <div><span className="dot dot-green" /><span>الفترة الصباحية</span><strong>٥٦</strong></div>
            <div><span className="dot dot-blue" /><span>الفترة المسائية</span><strong>٢٨</strong></div>
          </div>
          <Button variant="secondary" className="full-button" onClick={() => onNavigate("attendance")}>عرض سجل الحضور <ArrowUpLeft size={15} /></Button>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="panel table-panel">
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
          </div>
          <button className="compact-add" onClick={onAddMember}><Plus size={15} /> إضافة عضو جديد</button>
        </article>
        <article className="panel table-panel transaction-panel">
          <div className="panel-heading">
            <div><h2>آخر المعاملات</h2><p>المدفوعات المسجلة مؤخرًا</p></div>
            <button className="text-link" onClick={() => onNavigate("payments")}>كل المعاملات <ChevronLeft size={14} /></button>
          </div>
          <div className="transaction-list">
            {recentTransactions.map((transaction) => (
              <div className="transaction-row" key={`${transaction.name}-${transaction.date}`}>
                <span className="transaction-icon"><ArrowDownLeft size={16} /></span>
                <div className="transaction-person"><strong>{transaction.name}</strong><span>{transaction.detail} · {transaction.date}</span></div>
                <div className="transaction-amount"><strong>+{formatMoney(transaction.amount)}</strong><span>ج.م</span></div>
              </div>
            ))}
          </div>
          <button className="compact-add" onClick={() => onNavigate("payments")}><Plus size={15} /> تسجيل دفعة جديدة</button>
        </article>
      </section>
    </div>
  );
}
