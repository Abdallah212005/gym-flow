"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GymSection, Member } from "@/lib/gym-data";

type GymAppContextValue = {
  members: Member[];
  planPrices: Record<string, number>;
  updatePlanPrices: (prices: Record<string, number>) => void;
  addMember: (member: Omit<Member, "id" | "membershipHistory" | "activityHistory">) => void;
  deleteMember: (id: number) => void;
  renewMember: (id: number, plan: string, paidAmount: number, paymentMethod: string) => void;
  recordAttendance: (id: number) => void;
  recordPayment: (id: number, amount: number, detail: string, paymentMethod: string) => void;
  notify: (message: string) => void;
  addMemberOpen: boolean;
  setAddMemberOpen: (open: boolean) => void;
  memberSearchQuery: string;
  setMemberSearchQuery: (query: string) => void;
  navigate: (section: GymSection) => void;
  openMemberForm: () => void;
};

const GymAppContext = createContext<GymAppContextValue | null>(null);

export function GymAppProvider({
  value,
  children,
}: {
  value: GymAppContextValue;
  children: ReactNode;
}) {
  return <GymAppContext.Provider value={value}>{children}</GymAppContext.Provider>;
}

export function useGymApp() {
  const context = useContext(GymAppContext);
  if (!context) throw new Error("useGymApp must be used inside GymAppProvider.");
  return context;
}
