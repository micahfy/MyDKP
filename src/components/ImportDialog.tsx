'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ImportDialogProps {
  teamId: string;
  onSuccess: () => void;
}

export function ImportDialog({ teamId, onSuccess }: ImportDialogProps) {
  const [playerData, setPlayerData] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImportPlayers = async () => {
    if (!playerData.trim()) {
      toast.error('请输入玩家数据');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/players/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: playerData,
          teamId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          `导入成功！成功: ${data.imported}，失败: ${data.failed}`
        );
        setPlayerData('');
        onSuccess();
      } else {
        toast.error(data.error || '导入失败');
      }
    } catch (error) {
      toast.error('导入失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">批量导入玩家</h3>
          </div>

          <div>
            <Label>CSV 数据</Label>
            <Textarea
              value={playerData}
              onChange={(e) => setPlayerData(e.target.value)}
              placeholder="格式示例：&#10;角色名,职业,初始DKP&#10;无敌战士,战士,100&#10;治疗圣骑,圣骑士,150"
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">格式说明：</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>每行一个玩家，使用逗号分隔</li>
                  <li>格式：角色名,职业,初始DKP</li>
                  <li>初始DKP可选，默认为0</li>
                  <li>职业需与魔兽世界职业名称一致</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleImportPlayers}
            className="w-full"
            disabled={loading}
          >
            {loading ? '导入中...' : '开始导入'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">支持的职业列表</h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['战士', '圣骑士', '猎人', '盗贼', '牧师', '萨满祭司', '法师', '术士', '德鲁伊'].map(
              (cls) => (
                <div
                  key={cls}
                  className="bg-gray-100 px-3 py-2 rounded text-sm text-center"
                >
                  {cls}
                </div>
              )
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}