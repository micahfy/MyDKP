'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { LootChartDialog } from '@/components/LootChartDialog';
import { LootHistoryItem } from '@/types/loot';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LootHistoryDialogProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LootHistoryDialog({
  teamId,
  open,
  onOpenChange,
}: LootHistoryDialogProps) {
  const [items, setItems] = useState<LootHistoryItem[]>([]);
  const [teamSlug, setTeamSlug] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<LootHistoryItem | null>(null);

  useEffect(() => {
    if (open) {
      fetchTeamInfo();
    }
  }, [open, teamId]);

  const fetchTeamInfo = async () => {
    try {
      const res = await fetch(`/api/teams`);
      const teams = await res.json();
      const currentTeam = teams.find((t: any) => t.id === teamId);
      if (currentTeam) {
        setTeamSlug(currentTeam.slug || '');
        setTeamName(currentTeam.name);
      }
    } catch (error) {
      console.error('Failed to fetch team info:', error);
    }
  };

  useEffect(() => {
    if (open && teamSlug) {
      fetchItems();
    }
  }, [open, teamSlug]);

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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              <span>装备掉落历史{teamName ? ` - ${teamName}` : ''}</span>
            </DialogTitle>
            <p className="text-sm text-gray-400">展示最近8周的装备消费记录（按平均价格排序）</p>
          </DialogHeader>

          {/* 搜索框 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="搜索装备名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-900/40 border-purple-800/60 text-gray-100 placeholder:text-gray-500 h-9"
              />
            </div>
            <span className="text-sm text-gray-400">
              找到 {filteredItems.length} 件装备
            </span>
          </div>

          {/* 装备列表 */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
                <p className="text-gray-400 mt-4">加载中...</p>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="mx-auto h-16 w-16 text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">暂无装备消费记录</p>
                <p className="text-gray-500 text-sm mt-2">8周内没有任何装备消费记录</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 text-lg">未找到相关装备</p>
                <p className="text-gray-500 text-sm mt-2">请尝试其他搜索关键词</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto border border-purple-800/60 rounded-lg bg-slate-900/40">
              <Table>
                <TableHeader className="bg-slate-800/60 sticky top-0">
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
          )}
        </DialogContent>
      </Dialog>

      {/* 图表弹窗 */}
      {selectedItem && (
        <LootChartDialog
          item={selectedItem}
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
