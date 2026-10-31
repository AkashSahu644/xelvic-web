import type { UserCard } from "@/types/api";

export interface WalletEntry {
  id: string;
  kind: string;
  amount: number;
  thread_id?: string | null;
  day?: string | null;
  label?: string;
  other?: UserCard | null;
  created_at?: string;
}

export interface WalletPerson {
  thread_id: string;
  days: number;
  first?: string | null;
  last?: string | null;
  other?: UserCard | null;
}

export interface WalletData {
  balance: number;
  earned: number;
  spent: number;
  owned: string[];
  owned_logos?: string[];
  people: WalletPerson[];
  entries: WalletEntry[];
}
