import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LootHistoryItem } from '@/types/loot';
import { TrendingUp } from 'lucide-react';

interface LootHistoryCardProps {
  item: LootHistoryItem;
  onClick: () => void;
}

export function LootHistoryCard({ item, onClick }: LootHistoryCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg hover:shadow-purple-900/20 transition-all duration-200 bg-slate-900/40 border-purple-800/60 hover:border-purple-600"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-purple-400 line-clamp-2 leading-tight">
          {item.itemName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-400">掉落次数</span>
            <Badge variant="secondary" className="mt-1 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 w-fit">
              {item.dropCount}
            </Badge>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">平均价格</span>
            <span className="text-purple-300 font-semibold mt-1">
              {item.avgPrice.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">最低</span>
            <span className="text-green-400 font-semibold mt-1">
              {item.minPrice}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-400">最高</span>
            <span className="text-red-400 font-semibold mt-1">
              {item.maxPrice}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full bg-purple-900/20 border-purple-700/50 hover:bg-purple-900/40 hover:border-purple-600 text-purple-200"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          查看价格趋势
        </Button>
      </CardContent>
    </Card>
  );
}
