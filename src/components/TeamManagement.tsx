'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface TeamManagementProps {
  onUpdate: () => void;
}

export function TeamManagement({ onUpdate }: TeamManagementProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

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

      if (res.ok) {
        toast.success('团队创建成功！');
        setName('');
        setDescription('');
        onUpdate();
      } else {
        const data = await res.json();
        toast.error(data.error || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Plus className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold">创建新团队</h3>
        </div>

        <form onSubmit={handleCreateTeam} className="space-y-4">
          <div>
            <Label>团队名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 荣耀公会"
              required
            />
          </div>

          <div>
            <Label>团队描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如: 主力团队，专注黑翼之巢和安其拉"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '创建中...' : '创建团队'}
          </Button>
        </form>

        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">
            💡 提示：每个团队的DKP数据完全独立，方便管理多个Raid团队。
          </p>
        </div>
      </div>
    </Card>
  );
}