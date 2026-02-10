'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { LootChartDialog } from '@/components/LootChartDialog';
import { LootHistoryItem, LootHistoryResponse } from '@/types/loot';
import { toast } from 'sonner';
import { Search, TrendingUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
          {teamName} - 展示最近8周的装备消费记录（按平均价格排序）
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
        <div className="bg-slate-900/40 border border-purple-800/60 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-800/60">
                <TableRow>
                  <TableHead className="text-gray-300">排名</TableHead>
                  <TableHead className="text-gray-300">装备名称</TableHead>
                  <TableHead className="text-gray-300 text-right">平均价格</TableHead>
                  <TableHead className="text-gray-300 text-right">最高价格</TableHead>
                  <TableHead className="text-gray-300 text-right">最低价格</TableHead>
                  <TableHead className="text-gray-300 text-right">掉落次数</TableHead>
                  <TableHead className="text-gray-300 text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item, index) => (
                  <TableRow
                    key={item.itemName}
                    className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedItem(item)}
                  >
                    <TableCell className="text-gray-400 font-medium">#{index + 1}</TableCell>
                    <TableCell className="text-purple-300 font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-purple-400 font-bold text-lg">
                        {item.avgPrice.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-red-400">{item.maxPrice}</TableCell>
                    <TableCell className="text-right text-green-400">{item.minPrice}</TableCell>
                    <TableCell className="text-right">
                      <span className="px-2 py-1 rounded bg-blue-900/30 text-blue-300 text-sm">
                        {item.dropCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                        查看详情
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
