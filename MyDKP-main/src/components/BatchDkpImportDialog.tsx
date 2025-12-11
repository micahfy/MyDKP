'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BatchDkpImportDialogProps {
  teamId: string;
  teams?: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicate: number;
  successList: string[];
  errorList: Array<{ line: string; error: string }>;
}

export function BatchDkpImportDialog({ teamId, teams = [], onSuccess }: BatchDkpImportDialogProps) {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [importData, setImportData] = useState('');
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const availableTeams = teams.length > 0 ? teams : teamId ? [{ id: teamId, name: '当前团队' }] : [];
  const selectedTeamName = availableTeams.find((t) => t.id === selectedTeamId)?.name || '未选择团队';
  const recordCount = useMemo(
    () => importData.split('\n').filter((line) => line.trim() && !line.trim().startsWith('#')).length,
    [importData],
  );

  const handleImport = async () => {
    if (!importData.trim()) {
      toast.error('请输入变动数据');
      setConfirmOpen(false);
      return;
    }
    if (!selectedTeamId) {
      toast.error('请选择要导入的团队');
      setConfirmOpen(false);
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/dkp/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          importData: importData.trim(),
          ignoreDuplicates,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult({
          success: data.success,
          failed: data.failed,
          duplicate: data.duplicate || 0,
          successList: data.successList || [],
          errorList: data.errors || [],
        });

        if (data.failed === 0 && (data.duplicate || 0) === 0) {
          toast.success(`批量导入成功！共处理 ${data.success} 条记录`);
          setImportData('');
        } else {
          toast.warning(
            `导入完成：成功 ${data.success} 条，失败 ${data.failed} 条${
              data.duplicate ? `，重复 ${data.duplicate} 条` : ''
            }`,
          );
        }

        onSuccess();
      } else {
        toast.error(data.error || '导入失败');
      }
    } catch (error) {
      toast.error('导入失败，请重试');
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const openConfirm = () => {
    if (!importData.trim()) {
      toast.error('请输入变动数据');
      return;
    }
    if (!selectedTeamId) {
      toast.error('请选择要导入的团队');
      return;
    }
    setConfirmOpen(true);
  };

  const generateExampleData = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}:${second}`;

    const example = `# 推荐完整格式：角色名,分数,原因,日期,时间,职业
Aviere,3,孟菲斯托斯 替补,${dateStr},${timeStr},战士
莱耶,5,团队首杀奖励,${dateStr},${timeStr},法师

# 日期时间缺失时将使用当前时间
怒风,10,补记奖励,,,

# 简化格式（不含职业，缺省日期时间）
无敌战士,50,击杀奈法利安`;

    setImportData(example);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Upload className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-100">批量DKP变动导入</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateExampleData}
              className="border-blue-700 text-blue-400 hover:bg-blue-950"
            >
              <Copy className="h-4 w-4 mr-2" />
              填充示例
            </Button>
          </div>

          <div>
            <Label className="text-gray-200">选择导入团队</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="bg-slate-900/70 border-blue-800 text-gray-100">
                <SelectValue placeholder="未选择团队" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-blue-800 text-gray-100">
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="ignoreDuplicates"
              checked={ignoreDuplicates}
              onChange={(e) => setIgnoreDuplicates(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="ignoreDuplicates" className="text-gray-200 cursor-pointer">
              自动跳过重复记录（同一玩家、分数、原因、日期、时间）
            </Label>
          </div>

          <div>
            <Label className="text-gray-200">变动数据</Label>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={`每行格式：角色名,分数,原因,日期,时间,职业
示例：
\"Aviere\",3,\"孟菲斯托斯 替补\",\"2025-12-08\",\"14:15:07\",\"战士\"
\"无敌战士\",50,\"击杀奈法利安\"（省略日期时间时将使用当前时间）`}
              rows={12}
              className="font-mono text-sm bg-slate-800/80 border-slate-600 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="bg-blue-900/30 border border-blue-700/50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-200">
                <p className="font-semibold mb-2 text-blue-300">📋 格式说明</p>
                <ul className="space-y-1 list-disc list-inside text-gray-300">
                  <li>
                    <strong>标准格式</strong>：角色名,分数,原因,日期,时间,职业
                  </li>
                  <li>
                    <strong>支持双引号</strong>：可以使用 <code>"字段值"</code> 包裹，便于原因或名字里包含逗号
                  </li>
                  <li>日期支持 2024-12-20 / 2024/12/20，时间支持 20:30:45 / 20:30</li>
                  <li>省略日期或时间时，会使用当前时间；省略职业且需新建角色时，职业将使用“待指派”</li>
                  <li>每行独立处理，失败不会影响其他行；# 开头的行会被忽略</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-200">
                <p className="font-semibold mb-2 text-amber-300">⚠️ 注意事项</p>
                <ul className="space-y-1 list-disc list-inside text-gray-300">
                  <li>必须先选择导入团队，默认“未选择团队”</li>
                  <li>角色不存在时会在该团队自动创建，缺失职业将标记为“待指派”</li>
                  <li>操作会记录到 DKP 日志，时间会使用指定的日期时间</li>
                </ul>
              </div>
            </div>
          </div>

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认执行批量导入？</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 text-gray-300">
                  <p>
                    将把 <strong>{recordCount}</strong> 条记录导入到团队
                    <strong className="text-blue-300"> {selectedTeamName} </strong>
                    ，并写入指定的日期时间。
                  </p>
                  <p>重复记录处理：{ignoreDuplicates ? '自动跳过' : '允许重复写入'}</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleImport} disabled={loading}>
                  {loading ? '导入中...' : '确认导入'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>

            <Button
              onClick={openConfirm}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={loading || !importData.trim() || !selectedTeamId}
            >
              {loading ? '导入中...' : '开始批量导入'}
            </Button>
          </AlertDialog>
        </div>
      </Card>

      {importResult && (
        <Card className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-100 flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-400" />
              <span>导入结果</span>
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-900/20 border border-green-700/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-gray-300">成功</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{importResult.success}</div>
              </div>

              <div className="bg-red-900/20 border border-red-700/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span className="text-sm text-gray-300">失败</span>
                </div>
                <div className="text-3xl font-bold text-red-400">{importResult.failed}</div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">重复</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400">{importResult.duplicate}</div>
              </div>
            </div>

            {importResult.successList.length > 0 && (
              <div className="bg-green-900/10 border border-green-700/30 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-green-400 mb-2">✅ 成功导入的记录：</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {importResult.successList.map((item, index) => (
                    <div key={index} className="text-sm text-gray-300 font-mono">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.errorList.length > 0 && (
              <div className="bg-red-900/10 border border-red-700/30 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-red-400 mb-2">❌ 失败的记录：</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {importResult.errorList.map((item, index) => (
                    <div key={index} className="bg-slate-900/50 p-2 rounded">
                      <div className="text-sm text-gray-400 font-mono mb-1">原始数据: {item.line}</div>
                      <div className="text-sm text-red-400">错误: {item.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700/50">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-green-400" />
            <h3 className="text-lg font-semibold text-gray-100">示例数据</h3>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-green-700/50">
            <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap">
{`# 完整格式（推荐：包含职业）
无敌战士,50,击杀奈法利安,2025-12-20,20:30:45,战士
神圣奶妈,45,击杀奈法利安,2025-12-20,20:30:45,牧师

# 简化格式（秒数可选）
狂暴猎人,-30,购买装备,2025-12-20,20:30
暗影刺客,-25,购买装备,2025-12-20,20:30

# 可使用双引号避免逗号冲突
"Aviere",3,"孟菲斯托斯 替补","2025-12-08","14:15:07","战士"

# 补录历史数据
痛苦术士,100,补发奖励,2024-11-01,18:00:00,术士
野性德鲁伊,80,补发奖励,2024-11-01,18:00:00,德鲁伊`}
            </pre>
          </div>

          <div className="bg-green-900/30 border border-green-700/50 p-3 rounded-lg">
            <p className="text-xs text-gray-300">
              💡 提示：可以混合使用完整格式和简化格式，系统会自动处理。缺失日期时间的记录将使用当前时间。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
