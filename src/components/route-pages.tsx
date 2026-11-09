"use client";

import type { GymSection } from "@/lib/gym-data";
import { DashboardView } from "@/components/dashboard-view";
import { MembersView } from "@/components/members-view";
import { SectionView } from "@/components/section-view";
import { useGymApp } from "@/components/gym-app-context";

export function OverviewPage() {
  const { members, navigate, openMemberForm } = useGymApp();
  return <DashboardView members={members} onNavigate={navigate} onAddMember={openMemberForm} />;
}

export function MembersPage() {
  const {
    members,
    planPrices,
    addMember,
    deleteMember,
    renewMember,
    addMemberOpen,
    setAddMemberOpen,
    memberSearchQuery,
  } = useGymApp();

  return (
    <MembersView
      key={memberSearchQuery}
      members={members}
      planPrices={planPrices}
      onAdd={addMember}
      onDelete={deleteMember}
      onRenew={renewMember}
      addOpen={addMemberOpen}
      onAddOpenChange={setAddMemberOpen}
      initialQuery={memberSearchQuery}
    />
  );
}

export function GymSectionPage({ section }: { section: GymSection }) {
  const { members, planPrices, updatePlanPrices, navigate, notify, recordAttendance, recordPayment } = useGymApp();
  return <SectionView section={section} planPrices={planPrices} updatePlanPrices={updatePlanPrices} navigate={navigate} notify={notify} members={members} recordAttendance={recordAttendance} recordPayment={recordPayment} />;
}
