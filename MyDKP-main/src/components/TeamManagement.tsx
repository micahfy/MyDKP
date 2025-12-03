'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Edit2, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { Team } from '@/types';
import { TeamEditDialog } from './TeamEditDialog';
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

interface TeamManagementProps {
  onUpdate: () => void;
}

export function TeamManagement({ onUpdate }: TeamManagementProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setFetchLoading(true);
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        // 确保 data 是数组
        setTeams(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch teams');
        setTeams([]);
        toast.error('获取团队列表失败');
      }
    } catch (error) {
      console.error('Fetch teams error:', error);
      setTeams([]);
      toast.error('获取团队列表失败');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('请输入团队名称');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, slug }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('团队创建成功！');
        setName('');
        setSlug('');
        setDescription('');
        fetchTeams();
        onUpdate();
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || `团队 ${teamName} 已删除`);
        fetchTeams();
        onUpdate();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败，请重试');
    }
  };

  const handleEditSuccess = () => {
    fetchTeams();
    onUpdate();
  };

  const moveTeam = async (index: number, direction: 'up' | 'down') => {
    const newTeams = [...teams];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newTeams.length) return;
    
    [newTeams[index], newTeams[targetIndex]] = [newTeams[targetIndex], newTeams[index]];
    
    setTeams(newTeams);
    
    try {
      const res = await fetch('/api/teams/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teamIds: newTeams.map(t => t.id) 
        }),
      });

      if (res.ok) {
        toast.success('排序已更新');
        onUpdate();
      } else {
        toast.error('排序更新失败');
        fetchTeams();
      }
    } catch (error) {
      toast.error('排序更新失败');
      fetchTeams();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700/50">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-green-400" />
            <h3 className="text-lg font-semibold text-gray-100">创建新团队</h3>
          </div>

          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <Label className="text-gray-200">团队名称 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 乌龟公会"
                required
                className="bg-slate-800/80 border-slate-600 text-gray-200"
              />
            </div>

            <div>
              <Label className="text-gray-200">短链接（可选）</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例如: a 或 group-2，留空则自动生成"
                className="bg-slate-800/80 border-slate-600 text-gray-200"
              />
            </div>

            <div>
              <Label className="text-gray-200">团队描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如: 主力团队，专注开荒"
                rows={3}
                className="bg-slate-800/80 border-slate-600 text-gray-200"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" 
              disabled={loading}
            >
              {loading ? '创建中...' : '创建团队'}
            </Button>
          </form>

          <div className="bg-green-900/30 border border-green-700/50 p-4 rounded-lg">
            <p className="text-sm text-gray-300">
              💡 提示：每个团队的DKP数据完全独立。
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-100">现有团队</h3>
            <div className="text-sm text-gray-400">
              使用 ↑↓ 调整团队显示顺序
            </div>
          </div>
          
          {fetchLoading ? (
            <div className="text-center py-8 text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-4">加载中...</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              暂无团队
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-4 border border-blue-700/50 rounded-lg hover:bg-blue-900/20 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <GripVertical className="h-5 w-5 text-gray-500" />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-100">{team.name}</div>
                      <div className="text-sm text-gray-400">
                        {team.description || '暂无描述'} • {team._count?.players || 0} 名玩家
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveTeam(index, 'up')}
                      disabled={index === 0}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-950"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveTeam(index, 'down')}
                      disabled={index === teams.length - 1}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-950"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTeam(team)}
                      className="border-blue-700 text-blue-400 hover:bg-blue-950"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-800 border-red-900">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-gray-100">确认删除团队？</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-400">
                            此操作将删除团队 <strong className="text-red-400">{team.name}</strong> 及其所有玩家数据和DKP记录。此操作无法撤销！
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-700 border-slate-600 text-gray-300">取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {editingTeam && (
        <TeamEditDialog
          team={editingTeam}
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
