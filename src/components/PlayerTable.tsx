'use client';

import { useState, useEffect } from 'react';
import { Player } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Download } from 'lucide-react';
import { PlayerDetail } from './PlayerDetail';
import { toast } from 'sonner';

interface PlayerTableProps {
  teamId: string;
}

const WOW_CLASSES = [
  '全部',
  '战士',
  '圣骑士',
  '猎人',
  '盗贼',
  '牧师',
  '萨满祭司',
  '法师',
  '术士',
  '德鲁伊',
];

const CLASS_COLORS: Record<string, string> = {
  战士: 'text-amber-700',
  圣骑士: 'text-pink-500',
  猎人: 'text-green-600',
  盗贼: 'text-yellow-500',
  牧师: 'text-gray-100',
  萨满祭司: 'text-blue-500',
  法师: 'text-cyan-400',
  术士: 'text-purple-500',
  德鲁伊: 'text-orange-500',
};

export function PlayerTable({ teamId }: PlayerTableProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('全部');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchPlayers();
    }
  }, [teamId]);

  useEffect(() => {
    filterPlayers();
  }, [players, search, classFilter]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players?teamId=${teamId}`);
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      toast.error('获取玩家列表失败');
    } finally {
      setLoading(false);
    }
  };

  const filterPlayers = () => {
    let filtered = [...players];

    if (search) {
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (classFilter !== '全部') {
      filtered = filtered.filter((p) => p.class === classFilter);
    }

    setFilteredPlayers(filtered);
  };

  const handleExport = () => {
    const csv = [
      'name,class,current_dkp,total_earned,total_spent,attendance',
      ...filteredPlayers.map(
        (p) =>
          `${p.name},${p.class},${p.currentDkp},${p.totalEarned},${p.totalSpent},${p.attendance}`
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `players-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('导出成功！');
  };

  if (!teamId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">
          请先选择一个团队
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>DKP 排行榜</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索玩家名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WOW_CLASSES.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500">加载中...</div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              暂无玩家数据
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">排名</TableHead>
                    <TableHead>角色名</TableHead>
                    <TableHead>职业</TableHead>
                    <TableHead className="text-right">当前DKP</TableHead>
                    <TableHead className="text-right">总获得</TableHead>
                    <TableHead className="text-right">总消耗</TableHead>
                    <TableHead className="text-right">出席率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((player, index) => (
                    <TableRow
                      key={player.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <TableCell className="font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {player.name}
                      </TableCell>
                      <TableCell>
                        <span className={CLASS_COLORS[player.class] || ''}>
                          {player.class}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {player.currentDkp.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        +{player.totalEarned.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        -{player.totalSpent.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(player.attendance * 100).toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedPlayer && (
        <PlayerDetail
          player={selectedPlayer}
          open={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  );
}