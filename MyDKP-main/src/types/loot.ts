export interface LootPricePoint {
  timestamp: string;
  price: number;
  player: string;
  date: string;
}

export interface LootHistoryItem {
  itemName: string;
  dropCount: number;
  priceHistory: LootPricePoint[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

export interface LootHistoryResponse {
  items: LootHistoryItem[];
  teamName: string;
  timeRange: {
    start: string;
    end: string;
  };
}
