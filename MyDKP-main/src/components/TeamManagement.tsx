'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Edit2, Trash2 } from 'lucide-react';
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
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      setTeams(data);
    } catch (error) {
      toast.error('获取团队列表失败');
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
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('团队创建成功！');
        setName('');
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Plus className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">创建新团队</h3>
          </div>

          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <Label>团队名称 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 乌龟公会"
                required
              />
            </div>

            <div>
              <Label>团队描述</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如: 主力团队，专注开荒"
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '创建中...' : '创建团队'}
            </Button>
          </form>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              💡 提示：每个团队的DKP数据完全独立。
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">现有团队</h3>
          
          {teams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无团队
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{team.name}</div>
                    <div className="text-sm text-gray-500">
                      {team.description || '暂无描述'} • {team._count?.players || 0} 名玩家
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingTeam(team)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除团队？</AlertDialogTitle>
                          <AlertDialogDescription>
                            此操作将删除团队 <strong>{team.name}</strong> 及其所有玩家数据和DKP记录。此操作无法撤销！
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
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