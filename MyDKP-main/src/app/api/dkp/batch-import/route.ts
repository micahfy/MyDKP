'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface BatchDkpImportDialogProps {
  teamId: string;
  onSuccess: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  duplicate: number;
  successList: string[];
  errorList: Array<{ line: string; error: string }>;
}

export function BatchDkpImportDialog({ teamId, onSuccess }: BatchDkpImportDialogProps) {
  const [importData, setImportData] = useState('');
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handleImport = async () => {
    if (!importData.trim()) {
      toast.error('请输入变动数据');
      return;
    }

    setLoading(true);
    setImportResult(null);
    
    try {
      const res = await fetch('/api/dkp/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
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
            `导入完成：成功 ${data.success} 条，失败 ${data.failed} 条${data.duplicate ? `，重复 ${data.duplicate} 条` : ''}`
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
    }
  };

  const generateExampleData = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN');
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    const example = `# 单人奖励（正分）
无敌战士,50,击杀奈法利安,${dateStr},${timeStr}
神圣奶妈,45,击杀奈法利安,${dateStr},${timeStr}

# 单人扣分（负分）
狂暴猎人,-30,购买装备,${dateStr},${timeStr}

# 指定历史日期
暗影刺客,20,补发奖励,2024/12/01,20:30
元素萨满,25,副本奖励,2024年12月15日,19时00分`;

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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="ignoreDuplicates"
              checked={ignoreDuplicates}
              onChange={(e) => setIgnoreDuplicates(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="ignoreDuplicates" className="text-gray-200 cursor-pointer">
              自动跳过重复记录（相同玩家、分数、原因、日期、时间）
            </Label>
          </div>

          <div>
            <Label className="text-gray-200">变动数据</Label>
            <Textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="每行格式：角色名,分数,原因,日期,时间&#10;&#10;示例：&#10;无敌战士,50,击杀奈法利安,2024/12/20,20:30&#10;神圣奶妈,-30,购买装备,2024/12/20,20:30&#10;&#10;注意：&#10;- 正数表示获得，负数表示消耗&#10;- 日期格式支持：2024/12/20 或 2024-12-20 或 2024年12月20日&#10;- 时间格式支持：20:30 或 20时30分&#10;- 如果省略日期时间，将使用当前时间"
              rows={12}
              className="font-mono text-sm bg-slate-800/80 border-slate-600 text-gray-200 placeholder:text-gray-500"
            />
          </div>

          <div className="bg-blue-900/30 border border-blue-700/50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-200">
                <p className="font-semibold mb-2 text-blue-300">📋 格式说明：</p>
                <ul className="space-y-1 list-disc list-inside text-gray-300">
                  <li><strong>标准格式</strong>：角色名,分数,原因,日期,时间</li>
                  <li><strong>简化格式</strong>：角色名,分数,原因（自动使用当前日期时间）</li>
                  <li>分数为<strong className="text-green-400">正数</strong>表示获得DKP，<strong className="text-red-400">负数</strong>表示扣除DKP</li>
                  <li>日期支持：<code className="bg-slate-700 px-1 rounded">2024/12/20</code> 或 <code className="bg-slate-700 px-1 rounded">2024-12-20</code> 或 <code className="bg-slate-700 px-1 rounded">2024年12月20日</code></li>
                  <li>时间支持：<code className="bg-slate-700 px-1 rounded">20:30</code> 或 <code className="bg-slate-700 px-1 rounded">20时30分</code></li>
                  <li>每行独立处理，失败不影响其他行</li>
                  <li>以 <code className="bg-slate-700 px-1 rounded">#</code> 开头的行会被忽略（可用于注释）</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-200">
                <p className="font-semibold mb-2 text-amber-300">⚠️ 注意事项：</p>
                <ul className="space-y-1 list-disc list-inside text-gray-300">
                  <li>角色名必须精确匹配（区分大小写）</li>
                  <li>分数可以是小数（如 10.5）</li>
                  <li>不存在的角色会被跳过并在结果中显示</li>
                  <li>操作会记录到DKP日志，时间会使用您指定的日期时间</li>
                  <li>启用"跳过重复记录"后，相同的记录只会导入一次</li>
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
                <div className="text-3xl font-bold text-green-400">
                  {importResult.success}
                </div>
              </div>

              <div className="bg-red-900/20 border border-red-700/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span className="text-sm text-gray-300">失败</span>
                </div>
                <div className="text-3xl font-bold text-red-400">
                  {importResult.failed}
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm text-gray-300">重复</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400">
                  {importResult.duplicate}
                </div>
              </div>
            </div>

            {importResult.successList.length > 0 && (
              <div className="bg-green-900/10 border border-green-700/30 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-green-400 mb-2">
                  ✅ 成功导入的记录：
                </h4>
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
                <h4 className="text-sm font-semibold text-red-400 mb-2">
                  ❌ 失败的记录：
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {importResult.errorList.map((item, index) => (
                    <div key={index} className="bg-slate-900/50 p-2 rounded">
                      <div className="text-sm text-gray-400 font-mono mb-1">
                        原始数据: {item.line}
                      </div>
                      <div className="text-sm text-red-400">
                        错误: {item.error}
                      </div>
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
{`# 完整格式（包含日期时间）
无敌战士,50,击杀奈法利安,2024/12/20,20:30
神圣奶妈,45,击杀奈法利安,2024/12/20,20:30

# 简化格式（使用当前时间）
狂暴猎人,-30,购买装备
暗影刺客,-25,购买装备

# 不同的日期时间格式
元素萨满,30,副本奖励,2024-12-15,19:00
奥术法神,30,副本奖励,2024年12月15日,19时00分

# 补录历史数据
痛苦术士,100,补发奖励,2024/11/01,18:00
野性德鲁伊,80,补发奖励,2024/11/01,18:00`}
            </pre>
          </div>

          <div className="bg-green-900/30 border border-green-700/50 p-3 rounded-lg">
            <p className="text-xs text-gray-300">
              💡 <strong className="text-green-400">提示</strong>：可以混合使用完整格式和简化格式，系统会自动处理。省略日期时间的记录将使用当前时间。
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}