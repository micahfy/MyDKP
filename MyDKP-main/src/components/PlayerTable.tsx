'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Download, Edit2, Trash2, Crown, Skull, TrendingUp } from 'lucide-react';
import { PlayerDetail } from './PlayerDetail';
import { PlayerEditDialog } from './PlayerEditDialog';
import { LootHistoryDialog } from './LootHistoryDialog';
import { TalentIcon } from './TalentIcon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  refreshKey?: number;
}

interface ShameRankEntry {
  playerId: string;
  playerName: string;
  playerClass: string;
  totalCount: number;
  totalScore: number;
  weeks: {
    current: { count: number; score: number };
    last: { count: number; score: number };
    prev: { count: number; score: number };
  };
}

interface FaultKeywordItem {
  id: string;
  name: string;
  createdAt: string;
}

const formatDkp = (value: number) => Number(value.toFixed(2)).toString();
const formatDkpFixed = (value: number) => value.toFixed(2);
const formatPenalty = (value: number) =>
  value === 0 ? '0' : `-${formatDkp(Math.abs(value))}`;

const CHAMPION_SLOGANS = [
  '帅冠全服',
  '帅到极致',
  '分高帅炸',
  '帅霸榜一',
  '颜值顶尖',
  '帅得嚣张',
  '帅到出圈',
  '帅压群雄',
  '颜值爆表',
  '帅稳榜一',
  '帅得耀眼',
  '帅破天际',
  '帅领全团',
  '分霸榜首',
  '帅得夺目',
  '颜值碾压',
  '帅居榜一',
  '帅到出众',
  '帅冠全团',
  '颜值登顶',
  '分压群雄',
  '分高颜绝,独领风骚',
  '帅碾全服,分稳榜首',
  '颜霸全场,分冠群雄',
  '帅到极致,分无对手',
  '高分帅佬,实至名归',
  '颜分双冠,无人能及',
  '帅领全团,分霸巅峰',
  '颜值拉满,DKP登顶',
  '帅绝群雄,分稳第一',
  '高分顶配,帅到极致',
  '颜压众生,分冠全服',
  '帅冠榜首,分耀全团',
  '颜值顶尖,分霸全场',
  '帅分双优,独占鳌头',
  '这个男人他最帅',
  '帅气值爆表，服务器报警',
  '颜值碾压，DKP 也碾压',
  '风度与分数并存的男人',
  '帅是一种习惯，榜一是一种态度',
  '帅得坦克都嘲讽不动',
  '帅出新高度，分高有道理',
  '帅哥，请收下我的膝盖',
  '帅得让奈法都献上皇冠',
  '帅得离谱，分也离谱',
  '帅到把衰减当保养',
  '帅得装备都主动绑定',
  '帅得暴击率100%',
  '帅得像橙杖一样唯一',
  '帅得连拍卖行都打折',
];

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

export function PlayerTable({ teamId, isAdmin = false, refreshKey = 0 }: PlayerTableProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('全部');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDecayRank, setShowDecayRank] = useState(false);
  const [showShameRank, setShowShameRank] = useState(false);
  const [showLootHistory, setShowLootHistory] = useState(false);
  const [championSlogan, setChampionSlogan] = useState('');
  const [shameRanking, setShameRanking] = useState<ShameRankEntry[]>([]);
  const [shameLoading, setShameLoading] = useState(false);
  const [faultKeywordsGlobal, setFaultKeywordsGlobal] = useState<FaultKeywordItem[]>([]);
  const [faultKeywordsTeam, setFaultKeywordsTeam] = useState<FaultKeywordItem[]>([]);
  const [faultKeywordsLoading, setFaultKeywordsLoading] = useState(false);
  const [faultKeywordName, setFaultKeywordName] = useState('');
  const [faultKeywordBulk, setFaultKeywordBulk] = useState('');
  const [globalKeywordName, setGlobalKeywordName] = useState('');
  const [globalKeywordBulk, setGlobalKeywordBulk] = useState('');
  const [faultKeywordSubmitting, setFaultKeywordSubmitting] = useState(false);
  const [showKeywordPanel, setShowKeywordPanel] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManageFaultKeywords, setCanManageFaultKeywords] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchPlayers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, refreshKey]);

  useEffect(() => {
    filterPlayers();
  }, [players, search, classFilter]);

  const decayRanking = useMemo(
    () => [...players].sort((a, b) => b.totalDecay - a.totalDecay),
    [players],
  );

  useEffect(() => {
    if (showDecayRank) {
      const pick = CHAMPION_SLOGANS[Math.floor(Math.random() * CHAMPION_SLOGANS.length)];
      setChampionSlogan(pick);
    }
  }, [showDecayRank]);

  useEffect(() => {
    if (showShameRank && teamId) {
      fetchShameRanking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShameRank, teamId]);

  useEffect(() => {
    if (showShameRank && isAdmin) {
      fetchAdminRole();
    } else {
      setIsSuperAdmin(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShameRank, isAdmin]);

  useEffect(() => {
    if (showShameRank && isAdmin) {
      checkFaultKeywordPermission();
    } else {
      setCanManageFaultKeywords(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShameRank, isAdmin, teamId, isSuperAdmin]);

  useEffect(() => {
    if (showShameRank && canManageFaultKeywords) {
      fetchFaultKeywords();
    } else {
      setFaultKeywordsGlobal([]);
      setFaultKeywordsTeam([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShameRank, canManageFaultKeywords]);

  useEffect(() => {
    if (!showShameRank) {
      setShowKeywordPanel(false);
    }
  }, [showShameRank]);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/players?teamId=${teamId}${isAdmin ? '&includeArchived=1' : ''}`);
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      toast.error('获取玩家列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchShameRanking = async () => {
    setShameLoading(true);
    try {
      const res = await fetch(`/api/rankings/shame?teamId=${teamId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '获取耻辱榜失败');
      }
      setShameRanking(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      toast.error('获取耻辱榜失败');
      setShameRanking([]);
    } finally {
      setShameLoading(false);
    }
  };

  const fetchAdminRole = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setIsSuperAdmin(data?.role === 'super_admin');
    } catch (error) {
      setIsSuperAdmin(false);
    }
  };

  const checkFaultKeywordPermission = async () => {
    if (!isAdmin || !teamId) {
      setCanManageFaultKeywords(false);
      return;
    }

    if (isSuperAdmin) {
      setCanManageFaultKeywords(true);
      return;
    }

    try {
      const res = await fetch(`/api/auth/check-team-permission?teamId=${teamId}`);
      const data = await res.json();
      setCanManageFaultKeywords(data?.hasPermission === true);
    } catch (error) {
      setCanManageFaultKeywords(false);
    }
  };

  const fetchFaultKeywords = async () => {
    if (!teamId || !canManageFaultKeywords) {
      setFaultKeywordsGlobal([]);
      setFaultKeywordsTeam([]);
      return;
    }
    setFaultKeywordsLoading(true);
    try {
      const res = await fetch(`/api/fault-keywords?teamId=${teamId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '获取关键字失败');
      }
      setFaultKeywordsGlobal(Array.isArray(data?.global) ? data.global : []);
      setFaultKeywordsTeam(Array.isArray(data?.team) ? data.team : []);
    } catch (error) {
      toast.error('获取关键字失败');
      setFaultKeywordsGlobal([]);
      setFaultKeywordsTeam([]);
    } finally {
      setFaultKeywordsLoading(false);
    }
  };

  const submitFaultKeywords = async (payload: any, successMsg: string) => {
    if (faultKeywordSubmitting) return;
    setFaultKeywordSubmitting(true);
    try {
      const res = await fetch('/api/fault-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '保存失败');
      }
      toast.success(successMsg.replace('{count}', String(data.created || 0)));
      setFaultKeywordName('');
      setFaultKeywordBulk('');
      setGlobalKeywordName('');
      setGlobalKeywordBulk('');
      fetchFaultKeywords();
      fetchShameRanking();
    } catch (error: any) {
      toast.error(error?.message || '保存失败');
    } finally {
      setFaultKeywordSubmitting(false);
    }
  };

  const handleAddFaultKeyword = async () => {
    if (!faultKeywordName.trim()) {
      toast.error('请输入关键字');
      return;
    }
    await submitFaultKeywords(
      { name: faultKeywordName.trim(), scope: 'team', teamId },
      '已新增 1 个关键字',
    );
  };

  const handleBulkFaultKeywords = async () => {
    const text = faultKeywordBulk.trim();
    if (!text) {
      toast.error('请输入要导入的关键字');
      return;
    }
    await submitFaultKeywords(
      { text, scope: 'team', teamId },
      '已新增 {count} 个关键字',
    );
  };

  const handleAddGlobalKeyword = async () => {
    if (!globalKeywordName.trim()) {
      toast.error('请输入关键字');
      return;
    }
    await submitFaultKeywords(
      { name: globalKeywordName.trim(), scope: 'global' },
      '已新增 1 个全局关键字',
    );
  };

  const handleBulkGlobalKeywords = async () => {
    const text = globalKeywordBulk.trim();
    if (!text) {
      toast.error('请输入要导入的关键字');
      return;
    }
    await submitFaultKeywords(
      { text, scope: 'global' },
      '已新增 {count} 个全局关键字',
    );
  };

  const handleDeleteFaultKeyword = async (id: string, name: string) => {
    if (!confirm(`确认删除关键字「${name}」吗？`)) {
      return;
    }
    try {
      const res = await fetch(`/api/fault-keywords/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '删除失败');
      }
      toast.success(`已删除 ${name}`);
      fetchFaultKeywords();
      fetchShameRanking();
    } catch (error: any) {
      toast.error(error?.message || '删除失败');
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

  const formatWeekStat = (week: { count: number; score: number }) =>
    `${week.count}次/${formatPenalty(week.score)}分`;

  const handleExport = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const truncateToTwoDecimals = (value: number) => {
      const factor = 100;
      const truncated = value >= 0 ? Math.floor(value * factor) : Math.ceil(value * factor);
      return (truncated / factor).toFixed(2);
    };
    const now = new Date();
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const teamName =
      players.find((p) => p.team?.name)?.team?.name ||
      filteredPlayers.find((p) => p.team?.name)?.team?.name ||
      'team';
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-');
    const fileName = `${sanitize(teamName)}_${dateStr}.csv`;

    const csv = [
      '角色名,职业,天赋,当前DKP,总获得,总消费,出勤',
      ...filteredPlayers.map(
        (p) =>
          `${p.name},${p.class},${p.talent?.trim() ? p.talent : '待定'},${truncateToTwoDecimals(p.currentDkp)},${p.totalEarned},${p.totalSpent},${truncateToTwoDecimals(p.attendance)}`
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    toast.success('导出成功！');
  };

  const handleExportTxt = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours(),
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const teamName =
      players.find((p) => p.team?.name)?.team?.name ||
      filteredPlayers.find((p) => p.team?.name)?.team?.name ||
      'team';
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-');
    const fileName = `dkp_${sanitize(teamName)}_${dateStr}.txt`;

    const lines = filteredPlayers.map(
      (p) => `${p.name},${p.class},${formatDkpFixed(p.currentDkp)}`,
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDecayRank(true)}
                className="px-3 bg-gradient-to-r from-orange-500/80 to-red-500/80 text-white border-none shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:from-orange-500 hover:to-red-500"
              >
                <Crown className="h-4 w-4" />
                帅
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowShameRank(true)}
                className="px-3 bg-gradient-to-r from-slate-700/80 to-red-800/80 text-white border-none shadow-lg shadow-red-900/30 hover:shadow-red-900/50 hover:from-slate-700 hover:to-red-800"
              >
                <Skull className="h-4 w-4" />
                耻
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLootHistory(true)}
                className="px-3 bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white border-none shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:from-purple-500 hover:to-pink-500"
              >
                <TrendingUp className="h-4 w-4" />
                趋势
              </Button>
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExport}
                  className="btn-glow border-blue-500 text-blue-400 hover:bg-blue-950"
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportTxt}
                  className="btn-glow border-slate-500 text-slate-300 hover:bg-slate-900"
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出 TXT
                </Button>
              )}
            </div>
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
                      className={`table-row-hover border-blue-900/50 cursor-pointer ${
                        player.isArchived ? 'bg-gradient-to-r from-gray-900/70 via-slate-800/60 to-gray-900/70 opacity-70 ring-1 ring-gray-500/60' : ''
                      }`}
                      onClick={() => setSelectedPlayer(player)}
                    >
                      <TableCell className="font-medium text-gray-400">
                        {index === 0 && <Crown className="inline h-4 w-4 text-yellow-400 mr-1" />}
                        {index + 1}
                      </TableCell>
                      <TableCell className={`font-bold ${getClassColor(player.class)}`}>
                        <div className="flex items-center gap-2">
                          <TalentIcon
                            talent={player.talent}
                            className={getClassColor(player.class)}
                            size={16}
                          />
                          {player.name}
                          {player.isArchived && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-100 border border-gray-400/60 shadow-inner">
                              已封存
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`class-badge ${getClassColor(player.class, 'bg')} ${getClassColor(player.class)} border ${getClassColor(player.class, 'border')}`}>
                          {player.class}
                        </span>
                      </TableCell>
                    <TableCell className="text-right">
                      <span className="dkp-number text-blue-400">
                          {formatDkp(player.currentDkp)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-green-400 font-semibold">
                        +{formatDkp(player.totalEarned)}
                    </TableCell>
                    <TableCell className="text-right text-red-400 font-semibold">
                        -{formatDkp(player.totalSpent)}
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
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingPlayer(player);
                              }}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-950"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => event.stopPropagation()}
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

      <Dialog open={showDecayRank} onOpenChange={setShowDecayRank}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 flex items-center space-x-2">
              <Crown className="h-5 w-5 text-amber-300 drop-shadow" />
              <span>帅神榜</span>
            </DialogTitle>
          </DialogHeader>
          <div className="border border-orange-900/50 rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-900/60">
                  <TableHead className="w-16 text-gray-300">名次</TableHead>
                  <TableHead className="text-gray-300">角色</TableHead>
                  <TableHead className="text-gray-300">职业</TableHead>
                  <TableHead className="text-right text-gray-300">帅气值</TableHead>
                  <TableHead className="text-right text-gray-300">当前DKP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decayRanking.map((p, idx) => {
                  const isChampion = idx === 0;
                  const championBg = [
                    'linear-gradient(120deg, rgba(255,180,80,0.35), rgba(255,120,50,0.25), rgba(255,220,120,0.35))',
                    'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.10), transparent 35%)',
                    'radial-gradient(circle at 80% 30%, rgba(255,200,120,0.20), transparent 35%)',
                  ].join(',');
                  return (
                    <TableRow
                      key={p.id}
                      className={`hover:bg-orange-950/30 ${
                        isChampion
                          ? 'relative overflow-hidden bg-gradient-to-r from-orange-900/50 via-amber-800/40 to-yellow-700/40 shadow-lg shadow-amber-500/60 ring-2 ring-amber-300/70'
                          : ''
                      }`}
                      style={
                        isChampion
                          ? {
                              backgroundImage: championBg,
                              boxShadow: '0 0 25px rgba(255,200,120,0.45)',
                            }
                          : undefined
                      }
                    >
                      <TableCell className="text-gray-400">
                        {idx === 0 && <Crown className="h-4 w-4 text-yellow-300 drop-shadow mb-1 block" />}
                        {idx + 1}
                      </TableCell>
                      <TableCell className={`font-semibold ${getClassColor(p.class)} flex flex-col gap-1`}>
                        {isChampion ? (
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              <TalentIcon
                                talent={p.talent}
                                className={getClassColor(p.class)}
                                size={16}
                              />
                              {p.name}
                            </div>
                            <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-900 font-bold shadow-md shadow-amber-400/50 animate-pulse whitespace-nowrap">
                              {championSlogan || '最帅的那一个'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <TalentIcon
                              talent={p.talent}
                              className={getClassColor(p.class)}
                              size={16}
                            />
                            {p.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`class-badge ${getClassColor(p.class, 'bg')} ${getClassColor(p.class)} border ${getClassColor(p.class, 'border')}`}>
                          {p.class}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-orange-400 font-semibold">
                        {formatDkp(p.totalDecay)}
                      </TableCell>
                      <TableCell className="text-right text-blue-300">
                        {formatDkp(p.currentDkp)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showShameRank} onOpenChange={setShowShameRank}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto shame-rank-shell">
          <DialogHeader>
            <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-orange-400 flex items-center space-x-2">
              <span>耻辱榜</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500">最近三周的犯错扣分记录排行榜</p>
          <div className="border border-red-900/40 rounded-lg overflow-hidden">
            {shameLoading ? (
              <div className="py-10 text-center text-gray-400">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
                <p className="mt-4">加载中...</p>
              </div>
            ) : shameRanking.length === 0 ? (
              <div className="py-10 text-center text-gray-400">暂无犯错记录</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-900/60">
                    <TableHead className="w-16 text-gray-300">名次</TableHead>
                    <TableHead className="text-gray-300">玩家</TableHead>
                    <TableHead className="text-center text-gray-300">总次数</TableHead>
                    <TableHead className="text-right text-gray-300">扣分</TableHead>
                    <TableHead className="text-right text-gray-300">本周</TableHead>
                    <TableHead className="text-right text-gray-300">上周</TableHead>
                    <TableHead className="text-right text-gray-300">上上周</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shameRanking.map((entry, idx) => (
                    <TableRow key={entry.playerId} className="hover:bg-red-950/20">
                      <TableCell className="text-gray-400">{idx + 1}</TableCell>
                      <TableCell>
                        <div className={`font-semibold ${getClassColor(entry.playerClass)}`}>
                          {entry.playerName || entry.playerId}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-gray-200">{entry.totalCount}</TableCell>
                      <TableCell className="text-right text-red-400 font-semibold">
                        {formatPenalty(entry.totalScore)}
                      </TableCell>
                      <TableCell className="text-right text-red-300">
                        {formatWeekStat(entry.weeks.current)}
                      </TableCell>
                      <TableCell className="text-right text-red-300">
                        {formatWeekStat(entry.weeks.last)}
                      </TableCell>
                      <TableCell className="text-right text-red-300">
                        {formatWeekStat(entry.weeks.prev)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {isAdmin && canManageFaultKeywords && (
            <div className="mt-4 border border-slate-700/60 rounded-lg p-4 space-y-3 bg-slate-900/40">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">犯错扣分关键字</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKeywordPanel((prev) => !prev)}
                >
                  {showKeywordPanel ? '收起' : '管理'}
                </Button>
              </div>
              {showKeywordPanel && (
                <div className="space-y-5">
                  <div className="space-y-3 border border-slate-700/60 rounded-lg p-3">
                    <div className="text-xs text-gray-400">全局关键字（总管理员维护）</div>
                    {isSuperAdmin && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400">新增关键字</label>
                          <div className="flex gap-2">
                            <Input
                              value={globalKeywordName}
                              onChange={(e) => setGlobalKeywordName(e.target.value)}
                              placeholder="例如：站位错误"
                              className="bg-slate-900/60 border-slate-700 text-gray-100"
                            />
                            <Button onClick={handleAddGlobalKeyword} disabled={faultKeywordSubmitting}>
                              添加
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400">批量导入（逗号/换行分隔）</label>
                          <Textarea
                            value={globalKeywordBulk}
                            onChange={(e) => setGlobalKeywordBulk(e.target.value)}
                            rows={4}
                            className="bg-slate-900/60 border-slate-700 text-gray-100"
                            placeholder="示例：踩雷\n开怪"
                          />
                          <Button
                            onClick={handleBulkGlobalKeywords}
                            className="w-full bg-red-700 hover:bg-red-800"
                            disabled={faultKeywordSubmitting}
                          >
                            批量导入
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {faultKeywordsGlobal.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-1 rounded-full bg-slate-800/70 border border-slate-700 px-3 py-1 text-xs text-gray-200"
                        >
                          <span>{item.name}</span>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFaultKeyword(item.id, item.name)}
                              className="h-5 w-5 text-red-300 hover:text-red-200 hover:bg-red-900/40"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {faultKeywordsGlobal.length === 0 && (
                        <div className="text-xs text-gray-500">暂无全局关键字</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 border border-slate-700/60 rounded-lg p-3">
                    <div className="text-xs text-gray-400">团队专用关键字</div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">新增关键字</label>
                        <div className="flex gap-2">
                          <Input
                            value={faultKeywordName}
                            onChange={(e) => setFaultKeywordName(e.target.value)}
                            placeholder="例如：站位错误"
                            className="bg-slate-900/60 border-slate-700 text-gray-100"
                          />
                          <Button onClick={handleAddFaultKeyword} disabled={faultKeywordSubmitting}>
                            添加
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">批量导入（逗号/换行分隔）</label>
                        <Textarea
                          value={faultKeywordBulk}
                          onChange={(e) => setFaultKeywordBulk(e.target.value)}
                          rows={4}
                          className="bg-slate-900/60 border-slate-700 text-gray-100"
                          placeholder="示例：踩雷\n开怪"
                        />
                        <Button
                          onClick={handleBulkFaultKeywords}
                          className="w-full bg-red-700 hover:bg-red-800"
                          disabled={faultKeywordSubmitting}
                        >
                          批量导入
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        当前团队关键字（{faultKeywordsTeam.length}）
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchFaultKeywords}
                        disabled={faultKeywordsLoading}
                      >
                        刷新
                      </Button>
                    </div>
                    {faultKeywordsLoading ? (
                      <div className="text-center text-gray-400 py-4">加载中...</div>
                    ) : faultKeywordsTeam.length === 0 ? (
                      <div className="text-center text-gray-400 py-4">暂无团队关键字</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {faultKeywordsTeam.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-1 rounded-full bg-slate-800/70 border border-slate-700 px-3 py-1 text-xs text-gray-200"
                          >
                            <span>{item.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteFaultKeyword(item.id, item.name)}
                              className="h-5 w-5 text-red-300 hover:text-red-200 hover:bg-red-900/40"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isSuperAdmin && (
                    <div className="text-xs text-gray-500">
                      全局关键字由总管理员维护，你可以在此基础上维护团队专用关键字。
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <LootHistoryDialog
        teamId={teamId}
        open={showLootHistory}
        onOpenChange={setShowLootHistory}
      />
    </>
  );
}
