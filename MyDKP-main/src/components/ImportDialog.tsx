'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ImportDialogProps {
  teamId: string;
  onSuccess: () => void;
}

export function ImportDialog({ teamId, onSuccess }: ImportDialogProps) {
  const [playerData, setPlayerData] = useState('');
  const [loading, setLoading] = useState(false);
  const [talentData, setTalentData] = useState('');
  const [talentLoading, setTalentLoading] = useState(false);

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

  const handleImportTalents = async () => {
    if (!talentData.trim()) {
      toast.error('请输入天赋数据');
      return;
    }

    setTalentLoading(true);
    try {
      const res = await fetch('/api/players/import-talents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: talentData,
          teamId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          `导入完成：更新 ${data.updated}，失败 ${data.failed}`
        );
        setTalentData('');
        onSuccess();
      } else {
        toast.error(data.error || '导入失败');
      }
    } catch (error) {
      toast.error('导入失败，请重试');
    } finally {
      setTalentLoading(false);
    }
  };

  return (
    <Tabs defaultValue="players" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
        <TabsTrigger value="players" className="data-[state=active]:bg-blue-950">
          批量导入玩家
        </TabsTrigger>
        <TabsTrigger value="talents" className="data-[state=active]:bg-emerald-950">
          批量导入天赋
        </TabsTrigger>
      </TabsList>
      <TabsContent value="players" className="mt-6">
      <Card className="p-6 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-100">批量导入玩家</h3>
          </div>

          <div>
            <Label className="text-gray-200">CSV 数据</Label>
            <Textarea
              value={playerData}
              onChange={(e) => setPlayerData(e.target.value)}
              placeholder="格式示例：&#10;角色名,职业,初始DKP&#10;无敌战士,战士,100&#10;治疗圣骑,圣骑士,150"
              rows={8}
              className="font-mono text-sm bg-slate-800/80 border-slate-600 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="bg-blue-900/30 border border-blue-700/50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FileText className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-200">
                <p className="font-semibold mb-2 text-blue-300">格式说明：</p>
                <ul className="space-y-1 list-disc list-inside text-gray-300">
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
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={loading}
          >
            {loading ? '导入中...' : '开始导入'}
          </Button>
        </div>
      </Card>

      </TabsContent>

      <TabsContent value="talents" className="mt-6">
        <Card className="p-6 bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border-emerald-700/50">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-gray-100">批量导入天赋</h3>
          </div>

          <div>
            <Label className="text-gray-200">CSV 数据</Label>
            <Textarea
              value={talentData}
              onChange={(e) => setTalentData(e.target.value)}
              placeholder="格式示例：&#10;角色名,字母编号&#10;无敌战士,a&#10;治疗圣骑,b"
              rows={6}
              className="font-mono text-sm bg-slate-800/80 border-slate-600 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="bg-emerald-900/30 border border-emerald-700/50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FileText className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-200">
                <p className="font-semibold mb-2 text-emerald-300">格式说明：</p>
                <ul className="space-y-1 list-disc list-inside text-gray-300">
                  <li>每行一个玩家，使用逗号分隔</li>
                  <li>格式：角色名,字母编号（不区分大小写）</li>
                  <li>天赋编号需与玩家职业顺序匹配，不匹配会跳过</li>
                  <li>天赋留空将清空为“待指派”</li>
                  <li>战士：a防护 / b狂怒 / c武器</li>
                  <li>圣骑士：a防护 / b神圣 / c惩戒</li>
                  <li>猎人：a野兽掌握 / b射击 / c生存</li>
                  <li>盗贼：a刺杀 / b战斗 / c敏锐</li>
                  <li>牧师：a戒律 / b神圣 / c暗影</li>
                  <li>萨满祭司：a坦-增强 / b恢复 / c增强 / d元素</li>
                  <li>法师：a奥术 / b火焰 / c冰霜</li>
                  <li>术士：a痛苦 / b恶魔学识 / c毁灭</li>
                  <li>德鲁伊：a熊-野性战斗 / b恢复 / c平衡 / d猫-野性战斗</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleImportTalents}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            disabled={talentLoading}
          >
            {talentLoading ? '导入中...' : '开始导入天赋'}
          </Button>
        </div>
      </Card>
      </TabsContent>
    </Tabs>
  );
}
