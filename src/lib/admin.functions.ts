import { callRpc } from "./rpc-client";

export type AdminStats = {
  totalUsers: number;
  signupsPerDay: { date: string; count: number }[];
  recentSignups: {
    username: string | null;
    displayName: string | null;
    date: string;
    location: string | null;
  }[];
  activeSubscriptions: number;
  subscriptionPlans: { plan: string; count: number }[];
  sources: { source: string; count: number }[];
};

export const getAdminStats = () => callRpc<AdminStats>("adminStats");
