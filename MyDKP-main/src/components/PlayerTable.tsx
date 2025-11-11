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
import { Search, Download, Edit2, Trash2, Crown } from 'lucide-react';
import { PlayerDetail } from '@/components/PlayerDetail';
import { PlayerEditDialog } from '@/components/PlayerEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getClassColor } from '@/lib/utils';

interface PlayerTableProps {
  teamId: string;
  isAdmin?: boolean;
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

export function PlayerTable({ teamId, isAdmin = false }: PlayerTableProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('全部');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
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

  const handleDeletePlayer = async (playerId: string, playerName: string) => {
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success(`玩家 ${playerName} 已删除`);
        fetchPlayers();
      } else {
        const data = await res.json();
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败，请重试');
    }
  };

  if (!teamId) {
    return (
      <Card className="card-bg card-glow">
        <CardContent className="py-10 text-center text-gray-400">
          请先选择一个团队
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="card-bg card-glow">
        <CardHeader className="table-header">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Crown className="h-6 w-6 text-yellow-400" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                DKP 排行榜
              </span>
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              className="btn-glow border-blue-500 text-blue-400 hover:bg-blue-950"
            >
              <Download className="h-4 w-4 mr-2" />
              导出 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索玩家名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800/50 border-blue-900 focus:border-blue-500"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800/50 border-blue-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-blue-900">
                {WOW_CLASSES.map((cls) => (
                  <SelectItem key={cls} value={cls} className="hover:bg-blue-950">
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-4">加载中...</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              暂无玩家数据
            </div>
          ) : (
            <div className="border border-blue-900 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="table-header border-blue-900 hover:bg-transparent">
                    <TableHead className="w-[80px] text-gray-300">排名</TableHead>
                    <TableHead className="text-gray-300">角色名</TableHead>
                    <TableHead className="text-gray-300">职业</TableHead>
                    <TableHead className="text-right text-gray-300">当前DKP</TableHead>
                    <TableHead className="text-right text-gray-300">总获得</TableHead>
                    <TableHead className="text-right text-gray-300">总消耗</TableHead>
                    <TableHead className="text-right text-gray-300">出席率</TableHead>
                    {isAdmin && (
                      <TableHead className="text-center text-gray-300">操作</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.map((player, index) => (
                    <TableRow
                      key={player.id}
                      className="table-row-hover border-blue-900/50 cursor-pointer"
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <TableCell className="font-medium text-gray-400">
                        {index === 0 && <Crown className="inline h-4 w-4 text-yellow-400 mr-1" />}
                        {index + 1}
                      </TableCell>
                      <TableCell className={`font-bold ${getClassColor(player.class)}`}>
                        {player.name}
                      </TableCell>
                      <TableCell>
                        <span className={`class-badge ${getClassColor(player.class, 'bg')} ${getClassColor(player.class)} border ${getClassColor(player.class, 'border')}`}>
                          {player.class}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="dkp-number text-blue-400">
                          {player.currentDkp.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-green-400 font-semibold">
                        +{player.totalEarned.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right text-red-400 font-semibold">
                        -{player.totalSpent.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${
                          player.attendance >= 0.8 ? 'text-green-400' :
                          player.attendance >= 0.6 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {(player.attendance * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingPlayer(player)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-950"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-950"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-slate-800 border-red-900">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-gray-100">
                                    确认删除玩家？
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-gray-400">
                                    此操作将删除 <strong className={getClassColor(player.class)}>{player.name}</strong> 的所有数据和DKP记录。此操作无法撤销！
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-slate-700 border-slate-600 text-gray-300">
                                    取消
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePlayer(player.id, player.name)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    确认删除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
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

      {editingPlayer && (
        <PlayerEditDialog
          player={editingPlayer}
          open={!!editingPlayer}
          onOpenChange={(open) => !open && setEditingPlayer(null)}
          onSuccess={fetchPlayers}
        />
      )}
    </>
  );
}
