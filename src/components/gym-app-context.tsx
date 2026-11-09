"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { GymAccount, GymAppData, GymAppUser, GymSection, Member } from "@/lib/gym-data";

type GymAppContextValue = {
  user: GymAppUser;
  gym: GymAccount | null;
  members: Member[];
  data: GymAppData;
  planPrices: Record<string, number>;
  updatePlanPrices: (prices: Record<string, number>) => Promise<void>;
  refreshData: () => Promise<void>;
  addRecord: (collection: keyof GymAppData, record: Record<string, unknown>) => Promise<void>;
  addMember: (member: Omit<Member, "id" | "membershipHistory" | "activityHistory" | "joinedAt" | "expiresAt" | "status" | "paid" | "initials" | "color">) => Promise<boolean>;
  deleteMember: (id: string) => Promise<void>;
  renewMember: (id: string, plan: string, paidAmount: number, paymentMethod: string) => Promise<boolean>;
  recordAttendance: (id: string) => Promise<boolean>;
  recordPayment: (id: string, amount: number, detail: string, paymentMethod: string) => Promise<boolean>;
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
