'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BatchDkpImportDialogProps {
  teamId: string;
  onSuccess: () => void;
}

export function BatchDkpImportDialog({ teamId, onSuccess }: BatchDkpImportDialogProps) {
  const [importData, setImportData] = useState('');
  const [operationType, setOperationType] = useState('earn');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!importData.trim()) {
      toast.error('请输入变动数据');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/dkp/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          importData: importData.trim(),
          operationType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          `批量导入成功！成功: ${data.success}，失败: ${data.failed}`
        );
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((error: string) => {
            toast.warning(error);
          });
        }
        setImportData('');
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
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">批量DKP变动导入</h3>
          </div>

          <div>
            <Label className="text-gray-700">操作类型</Label>
            <Select value={operationType} onValueChange={setOperationType}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="earn">获得DKP</SelectItem>
                <SelectItem value="spend">消耗DKP</SelectItem>
                <SelectItem value="penalty">扣分</SelectItem>
                <SelectItem value="attendance">出席奖励</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-700">变动数据</Label>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="支持以下格式：&#10;&#10;格式1 - 单人单行：&#10;角色名,分数,原因&#10;无敌战士,50,击杀奈法利安&#10;&#10;格式2 - 多人单行：&#10;角色名1,角色名2,角色名3,分数,原因&#10;无敌战士,神圣奶妈,狂暴猎人,50,团队击杀Boss&#10;&#10;格式3 - 混合多行：&#10;无敌战士,50,个人奖励&#10;神圣奶妈,狂暴猎人,30,双人奖励"
              rows={12}
              className="font-mono text-sm bg-white"
            />
          </div>

          <div className="bg-blue-100 border border-blue-300 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-2">📋 格式说明：</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>单人单行</strong>：角色名,分数,原因</li>
                  <li><strong>多人单行</strong>：角色名1,角色名2,...,分数,原因</li>
                  <li>分数前的所有字段均视为角色名</li>
                  <li>分数必须是数字（可以是小数）</li>
                  <li>最后一个字段是原因（可选）</li>
                  <li>每行独立处理，失败不影响其他行</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-300 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-2">⚠️ 注意事项：</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>角色名必须精确匹配（区分大小写）</li>
                  <li>消耗/扣分类型会自动转为负数</li>
                  <li>不存在的角色会被跳过</li>
                  <li>操作会记录到DKP日志</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            onClick={handleImport}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={loading}
          >
            {loading ? '导入中...' : '开始批量导入'}
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800">示例数据</h3>
          </div>

          <div className="bg-white p-4 rounded-lg border border-green-200">
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
{`# 单人奖励
无敌战士,50,击杀奈法利安
神圣奶妈,45,击杀奈法利安

# 多人统一奖励
狂暴猎人,暗影刺客,暗牧大佬,30,团队击杀Boss

# 混合格式
元素萨满,奥术法神,25,法系DPS奖励
痛苦术士,20,个人贡献奖励`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}