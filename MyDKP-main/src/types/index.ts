export interface Team {
  id: string;
  name: string;
  description?: string;
  _count?: {
    players: number;
  };
}

export interface Player {
  id: string;
  name: string;
  class: string;
  currentDkp: number;
  totalEarned: number;
  totalSpent: number;
  attendance: number;
  teamId: string;
  team?: {
    name: string;
  };
}

export interface DkpLog {
  id: string;
  playerId: string;
  teamId: string;
  type: string;
  change: number;
  reason?: string;
  item?: string;
  boss?: string;
  operator: string;
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedByAdmin?: {
    username: string;
  } | null;
  player?: {
    name: string;
  };
}

export interface DecayHistory {
  id: string;
  teamId: string;
  rate: number;
  executedAt: string;
  status: string;
  operator: string;
  affectedCount: number;
}
