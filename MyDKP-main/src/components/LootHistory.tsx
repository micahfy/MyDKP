'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LootHistoryCard } from '@/components/LootHistoryCard';
import { LootChartDialog } from '@/components/LootChartDialog';
import { LootHistoryItem, LootHistoryResponse } from '@/types/loot';
import { toast } from 'sonner';
import { Search, TrendingUp } from 'lucide-react';

interface LootHistoryProps {
  teamSlug: string;
  teamId: string;
  teamName: string;
}

export function LootHistory({ teamSlug, teamId, teamName }: LootHistoryProps) {
  const [items, setItems] = useState<LootHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<LootHistoryItem | null>(null);

  useEffect(() => {
    fetchItems();
  }, [teamSlug]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/loot-history?teamSlug=${encodeURIComponent(teamSlug)}&weeks=8`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '获取装备历史失败');
      }

      setItems(data.items || []);
    } catch (error: any) {
      console.error('Fetch loot history error:', error);
      toast.error(error?.message || '获取装备历史失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
          装备掉落历史
        </h1>
        <p className="text-gray-400 text-lg">
          {teamName} - 展示最近8周的装备消费记录
        </p>
      </div>

      {/* 搜索框 */}
      <div className="max-w-md mx-auto mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="搜索装备名称..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/40 border-purple-800/60 text-gray-100 placeholder:text-gray-500"
          />
        </div>
        <p className="text-sm text-gray-500 mt-2 text-center">
          找到 {filteredItems.length} 件装备
        </p>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <p className="text-gray-400 mt-4">加载中...</p>
        </div>
      )}

      {/* 空状态 */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12">
          <TrendingUp className="mx-auto h-16 w-16 text-gray-600 mb-4" />
          <p className="text-gray-400 text-lg">暂无装备消费记录</p>
          <p className="text-gray-500 text-sm mt-2">8周内没有任何装备消费记录</p>
        </div>
      )}

      {/* 无搜索结果 */}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">未找到相关装备</p>
          <p className="text-gray-500 text-sm mt-2">请尝试其他搜索关键词</p>
        </div>
      )}

      {/* 装备列表 */}
      {!loading && filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <LootHistoryCard
              key={item.itemName}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {/* 图表弹窗 */}
      {selectedItem && (
        <LootChartDialog
          item={selectedItem}
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
