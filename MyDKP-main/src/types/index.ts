export interface Team {
  id: string;
  name: string;
  slug?: string | null;
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
  totalDecay: number;
  attendance: number;
  isArchived?: boolean;
  archivedAt?: string | null;
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
  decayHistoryId?: string | null;
  player?: {
    name: string;
  };
}

export interface DkpEventLog {
  id: string;
  teamId: string;
  teamName: string;
  type: string;
  change: number;
  reason?: string | null;
  item?: string | null;
  boss?: string | null;
  operator: string;
  eventTime: string;
  players: Array<{
    id: string;
    playerId: string;
    playerName: string;
    playerClass?: string | null;
    isDeleted: boolean;
    change: number;
    reason?: string | null;
    operator: string;
  }>;
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
