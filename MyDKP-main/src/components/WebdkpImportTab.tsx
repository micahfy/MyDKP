'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface TeamOption {
  id: string;
  name: string;
}

interface WebdkpImportTabProps {
  teams: TeamOption[];
}

interface LogRow {
  player: string;
  change: number;
  reason: string;
  date: string;
  time: string;
}

export function WebdkpImportTab({ teams }: WebdkpImportTabProps) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [downloadReady, setDownloadReady] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setDownloadReady(false);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/webdkp/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '上传失败');
      }

      setSessionId(data.sessionId);
      setRows(data.rows || []);
      toast.success(`上传成功，共解析 ${data.rowCount} 条记录`);
    } catch (error: any) {
      toast.error(error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const updateRow = (index: number, field: keyof LogRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]:
          field === 'change'
            ? Number(value)
            : value,
      } as LogRow;
      return next;
    });
  };

  const handleSaveRows = async () => {
    if (!sessionId) {
      toast.error('请先上传 WebDKP.lua');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/webdkp/session/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }
      toast.success('已保存修改');
    } catch (error: any) {
      toast.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!sessionId) {
      toast.error('请先上传 WebDKP.lua');
      return;
    }
    if (!selectedTeam) {
      toast.error('请选择要导入的团队');
      return;
    }

    setImporting(true);
    setDownloadReady(false);
    try {
      const res = await fetch(`/api/webdkp/session/${sessionId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeam }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '导入失败');
      }
      setImportResult(data.result);
      setDownloadReady(true);
      toast.success('导入完成');
    } catch (error: any) {
      toast.error(error?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = () => {
    if (!sessionId) return;
    window.open(`/api/webdkp/session/${sessionId}/download`, '_blank');
  };

  return (
    <Card className="card-bg card-glow">
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="text-sm text-gray-300">上传 WebDKP.lua</label>
            <Input type="file" accept=".lua" onChange={handleUpload} disabled={uploading} />
            <p className="text-xs text-gray-500">系统会解析 WebDKP_Log 并生成可编辑的数据表。</p>
          </div>
          <div className="space-y-3">
            <label className="text-sm text-gray-300">选择导入团队</label>
            <select
              className="w-full rounded-md bg-slate-900/70 border border-slate-700 px-3 py-2 text-gray-100"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
            >
              <option value="">请选择团队</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <div className="flex space-x-2">
              <Button onClick={handleSaveRows} disabled={!sessionId || saving}>
                保存修改
              </Button>
              <Button
                onClick={handleImport}
                disabled={!sessionId || importing || !selectedTeam}
                className="bg-purple-700 hover:bg-purple-800"
              >
                导入到团队
              </Button>
              {downloadReady && (
                <Button variant="outline" onClick={handleDownload}>
                  下载更新后的 WebDKP.lua
                </Button>
              )}
            </div>
          </div>
        </div>

        {rows.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-gray-300">
                已解析 {rows.length} 条记录，可直接在下方表格中编辑
              </h3>
              <span className="text-xs text-gray-500">滚动区域可浏览全部记录</span>
            </div>
            <div className="max-h-[480px] overflow-auto border border-slate-700 rounded-lg">
              <table className="min-w-full text-sm text-gray-200">
                <thead className="bg-slate-900/60 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">玩家</th>
                    <th className="px-3 py-2 text-left">分数</th>
                    <th className="px-3 py-2 text-left">原因</th>
                    <th className="px-3 py-2 text-left">日期</th>
                    <th className="px-3 py-2 text-left">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.player}-${index}`} className="odd:bg-slate-900/30">
                      <td className="px-3 py-1">
                        <Input
                          value={row.player}
                          onChange={(e) => updateRow(index, 'player', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1 w-24">
                        <Input
                          type="number"
                          value={row.change}
                          onChange={(e) => updateRow(index, 'change', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1">
                        <Textarea
                          value={row.reason}
                          onChange={(e) => updateRow(index, 'reason', e.target.value)}
                          rows={2}
                        />
                      </td>
                      <td className="px-3 py-1 w-32">
                        <Input
                          value={row.date}
                          onChange={(e) => updateRow(index, 'date', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-1 w-32">
                        <Input
                          value={row.time}
                          onChange={(e) => updateRow(index, 'time', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-10 border border-dashed border-slate-700 rounded-lg">
            请先上传 WebDKP.lua 文件
          </div>
        )}

        {importResult && (
          <div className="border border-slate-600 rounded-lg p-4 bg-slate-900/50">
            <h4 className="text-gray-100 font-semibold mb-2">导入结果</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>成功：{importResult.success}</li>
              <li>重复：{importResult.duplicate}</li>
              <li>失败：{importResult.failed}</li>
            </ul>
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-3">
                <div className="text-sm text-red-300 mb-1">错误示例：</div>
                <ul className="text-xs text-gray-400 space-y-1 max-h-32 overflow-auto">
                  {importResult.errors.slice(0, 5).map((item: any, idx: number) => (
                    <li key={idx}>
                      {item.line} → {item.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
