"use client";

import type { GymSection } from "@/lib/gym-data";
import { DashboardView } from "@/components/dashboard-view";
import { MembersView } from "@/components/members-view";
import { SectionView } from "@/components/section-view";
import { useGymApp } from "@/components/gym-app-context";

export function OverviewPage() {
  const { members, data, user, navigate, openMemberForm } = useGymApp();
  return <DashboardView
    members={members}
    data={data}
    onNavigate={navigate}
    onAddMember={openMemberForm}
    canAddMember={user.role === "owner" || user.permissions.includes("write:members")}
    canReadMembers={user.role === "owner" || user.permissions.includes("read:members")}
    canReadMemberships={user.role === "owner" || user.permissions.includes("read:plans")}
    canReadPayments={user.role === "owner" || user.permissions.includes("read:payments")}
    canReadAttendance={user.role === "owner" || user.permissions.includes("read:attendance")}
    canReadReports={user.role === "owner" || (user.permissions.includes("read:reports") && ["members", "attendance", "payments", "expenses"].every((name) => user.permissions.includes(`read:${name}`)))}
  />;
}

export function MembersPage() {
  const {
    members,
    user,
    planPrices,
    addMember,
    deleteMember,
    renewMember,
    addMemberOpen,
    setAddMemberOpen,
    memberSearchQuery,
    recordPayment,
    notify,
  } = useGymApp();

  return (
    <MembersView
      key={memberSearchQuery}
      members={members}
      canWriteMembers={user.role === "owner" || user.permissions.includes("write:members")}
      canWritePayments={user.role === "owner" || user.permissions.includes("write:payments")}
      canRenewMembers={user.role === "owner" || (user.permissions.includes("write:members") && user.permissions.includes("write:payments"))}
      planPrices={planPrices}
      onAdd={addMember}
      onDelete={deleteMember}
      onRenew={renewMember}
      onRecordPayment={recordPayment}
      notify={notify}
      addOpen={addMemberOpen}
      onAddOpenChange={setAddMemberOpen}
      initialQuery={memberSearchQuery}
    />
  );
}

export function GymSectionPage({ section }: { section: GymSection }) {
  const { members, data, user, planPrices, updatePlanPrices, addRecord, refreshData, navigate, notify, recordAttendance, recordPayment } = useGymApp();
  return <SectionView section={section} data={data} user={user} planPrices={planPrices} updatePlanPrices={updatePlanPrices} addRecord={addRecord} refreshData={refreshData} navigate={navigate} notify={notify} members={members} recordAttendance={recordAttendance} recordPayment={recordPayment} />;
}
