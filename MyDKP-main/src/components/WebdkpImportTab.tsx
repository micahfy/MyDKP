'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

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

type ViewMode = 'flat' | 'grouped';

function rowContains(row: LogRow, term: string) {
  const value = term.toLowerCase();
  return (
    row.player.toLowerCase().includes(value) ||
    row.reason.toLowerCase().includes(value) ||
    row.date.toLowerCase().includes(value) ||
    row.time.toLowerCase().includes(value)
  );
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
  const [filterText, setFilterText] = useState('');
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkReplace, setBulkReplace] = useState('');
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [groupAddInputs, setGroupAddInputs] = useState<Record<string, string>>({});
  const [exportTeamId, setExportTeamId] = useState<string>('all');

  const filteredRows = useMemo(() => {
    const term = filterText.trim();
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => (term ? rowContains(row, term) : true));
  }, [rows, filterText]);

  const groupedRows = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; reason: string; date: string; time: string; change: number; items: { row: LogRow; index: number }[] }
    >();
    filteredRows.forEach(({ row, index }) => {
      const key = `${row.reason}||${row.date}||${row.time}||${row.change}`;
      if (!groups.has(key)) {
        groups.set(key, { key, reason: row.reason, date: row.date, time: row.time, change: row.change, items: [] });
      }
      groups.get(key)!.items.push({ row, index });
    });
    return Array.from(groups.values());
  }, [filteredRows]);

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every(({ index }) => selectedIndices.has(index));

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
      setViewMode('grouped');
      setSelectedIndices(new Set());
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
        [field]: field === 'change' ? Number(value) : value,
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
      setRows([]);
      setSelectedIndices(new Set());
      toast.success('导入完成');
    } catch (error: any) {
      toast.error(error?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleBulkReplace = () => {
    if (!bulkSearch.trim()) {
      toast.error('请输入要搜索的关键字');
      return;
    }
    setRows((prev) =>
      prev.map((row) => {
        if (!rowContains(row, bulkSearch)) return row;
        return {
          ...row,
          player: row.player.replaceAll(bulkSearch, bulkReplace),
          reason: row.reason.replaceAll(bulkSearch, bulkReplace),
          date: row.date.replaceAll(bulkSearch, bulkReplace),
          time: row.time.replaceAll(bulkSearch, bulkReplace),
        };
      }),
    );
    toast.success('已替换匹配内容');
  };

  const handleBulkDelete = () => {
    if (!bulkSearch.trim()) {
      toast.error('请输入要搜索的关键字');
      return;
    }
    setRows((prev) => {
      const filtered = prev.filter((row) => !rowContains(row, bulkSearch));
      const nextSelected = new Set<number>();
      setSelectedIndices(nextSelected);
      return filtered;
    });
    toast.success('已删除匹配记录');
  };

  const toggleRowSelection = (index: number, checked: boolean) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIndices.size === 0) {
      toast.error('请先勾选要删除的记录');
      return;
    }
    setRows((prev) => prev.filter((_, index) => !selectedIndices.has(index)));
    setSelectedIndices(new Set());
    toast.success('已删除所选记录');
  };

  const selectAllFiltered = (checked: boolean) => {
    if (!checked) {
      setSelectedIndices(new Set());
      return;
    }
    const next = new Set<number>();
    filteredRows.forEach(({ index }) => next.add(index));
    setSelectedIndices(next);
  };

  const toggleGroupSelection = (indices: number[], checked: boolean) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => {
        if (checked) {
          next.add(i);
        } else {
          next.delete(i);
        }
      });
      return next;
    });
  };

  const deleteGroup = (indices: number[]) => {
    if (indices.length === 0) return;
    setRows((prev) => prev.filter((_, idx) => !indices.includes(idx)));
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => next.delete(i));
      return next;
    });
    toast.success(`已删除分组内 ${indices.length} 条记录`);
  };

  const cloneRow = (index: number) => {
    setRows((prev) => {
      const next = [...prev];
      const source = prev[index];
      next.splice(index + 1, 0, { ...source });
      return next;
    });
  };

  const cloneGroup = (group: { reason: string; date: string; time: string; change: number; items: { row: LogRow; index: number }[] }) => {
    const suffix = ' - 克隆';
    const nextReason = group.reason.includes(suffix) ? group.reason : `${group.reason}${suffix}`;
    const clones = group.items.map(({ row }) => ({
      ...row,
      reason: nextReason,
    }));
    setRows((prev) => [...prev, ...clones]);
  };

  const addPlayersToGroup = (groupKey: string, group: { reason: string; date: string; time: string; change: number }) => {
    const raw = groupAddInputs[groupKey] || '';
    const names = raw
      .split(/[\n,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (names.length === 0) {
      toast.error('请输入要添加的玩家名称');
      return;
    }

    const newRows = names.map<LogRow>((player) => ({
      player,
      change: Number(group.change) || 0,
      reason: group.reason,
      date: group.date,
      time: group.time,
    }));

    setRows((prev) => [...prev, ...newRows]);
    setGroupAddInputs((prev) => ({ ...prev, [groupKey]: '' }));
    toast.success(`已添加 ${names.length} 名玩家到该分组`);
  };

  const updateGroupField = (indices: number[], field: keyof LogRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      indices.forEach((i) => {
        next[i] = {
          ...next[i],
          [field]: field === 'change' ? Number(value) || 0 : value,
        } as LogRow;
      });
      return next;
    });
  };

  const handleDownload = () => {
    if (!sessionId) return;
    window.open(`/api/webdkp/session/${sessionId}/download`, '_blank');
  };

  const handleExportLatest = () => {
    const params = new URLSearchParams();
    if (exportTeamId && exportTeamId !== 'all') {
      params.set('teamId', exportTeamId);
    }
    const url = params.toString() ? `/api/export/webdkp?${params.toString()}` : '/api/export/webdkp';
    window.open(url, '_blank');
  };

  return (
    <Card className="card-bg card-glow">
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="text-sm text-gray-300">上传 WebDKP.lua</label>
            <Input type="file" accept=".lua" onChange={handleUpload} disabled={uploading} />
            <p className="text-xs text-gray-500">系统会解析 WebDKP_Log 并生成可编辑的数据表。</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 rounded-md bg-slate-900/70 border border-slate-700 px-3 py-2 text-gray-100"
                  value={exportTeamId}
                  onChange={(e) => setExportTeamId(e.target.value)}
                >
                  <option value="all">导出全部团队</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      导出 {team.name}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={handleExportLatest}>
                  <Download className="h-4 w-4 mr-1" />
                  导出 WebDKP.lua
                </Button>
              </div>
            </div>
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
            <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-gray-300">
                  已解析 {rows.length} 条记录，当前显示 {filteredRows.length} 条
                </h3>
                <span className="text-xs text-gray-500">滚动区域可浏览全部记录</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">搜索并过滤显示</label>
                  <Input
                    placeholder="输入关键字过滤记录"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-gray-400">批量替换 / 删除匹配项</label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <Input
                      placeholder="搜索关键字"
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                    />
                    <Input
                      placeholder="替换为（可选）"
                      value={bulkReplace}
                      onChange={(e) => setBulkReplace(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleBulkReplace}>
                      替换匹配
                    </Button>
                    <Button variant="destructive" onClick={handleBulkDelete}>
                      删除匹配
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteSelected}
                      disabled={selectedIndices.size === 0}
                    >
                      删除勾选
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">预览模式</span>
                <div className="rounded-md border border-slate-700 p-1 flex gap-1">
                  <Button size="sm" variant={viewMode === 'flat' ? 'default' : 'ghost'} onClick={() => setViewMode('flat')}>
                    原始列表
                  </Button>
                  <Button size="sm" variant={viewMode === 'grouped' ? 'default' : 'ghost'} onClick={() => setViewMode('grouped')}>
                    合并预览
                  </Button>
                </div>
              </div>
            </div>

            {viewMode === 'flat' ? (
              <div className="max-h-[480px] overflow-auto border border-slate-700 rounded-lg">
                <table className="min-w-full text-sm text-gray-200">
                  <thead className="bg-slate-900/60 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={(e) => selectAllFiltered(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">玩家</th>
                      <th className="px-3 py-2 text-left">分数</th>
                      <th className="px-3 py-2 text-left">原因</th>
                      <th className="px-3 py-2 text-left">日期</th>
                      <th className="px-3 py-2 text-left">时间</th>
                      <th className="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(({ row, index }) => (
                      <tr key={`${row.player}-${index}`} className="odd:bg-slate-900/30">
                        <td className="px-3 py-1">
                          <input
                            type="checkbox"
                            checked={selectedIndices.has(index)}
                            onChange={(e) => toggleRowSelection(index, e.target.checked)}
                          />
                        </td>
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
                        <td className="px-3 py-1 w-28">
                          <Button size="sm" variant="secondary" onClick={() => cloneRow(index)}>
                            克隆
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto border border-slate-700 rounded-lg">
                <table className="min-w-full text-sm text-gray-200">
                  <thead className="bg-slate-900/60 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">原因</th>
                      <th className="px-3 py-2 text-left">时间</th>
                      <th className="px-3 py-2 text-left">分数</th>
                      <th className="px-3 py-2 text-left">人数</th>
                      <th className="px-3 py-2 text-left">玩家列表</th>
                      <th className="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.map((group, idx) => {
                      const indices = group.items.map((item) => item.index);
                      const allGroupSelected = indices.every((i) => selectedIndices.has(i));
                      const groupKey = group.key;
                      return (
                        <tr key={`${group.reason}-${group.date}-${group.time}-${group.change}-${idx}`} className="odd:bg-slate-900/30">
                          <td className="px-3 py-2 max-w-sm">
                            <Textarea
                              value={group.reason}
                              onChange={(e) => updateGroupField(indices, 'reason', e.target.value)}
                              rows={2}
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <Input
                                value={group.date}
                                onChange={(e) => updateGroupField(indices, 'date', e.target.value)}
                              />
                              <Input
                                value={group.time}
                                onChange={(e) => updateGroupField(indices, 'time', e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 w-28">
                            <Input
                              type="number"
                              value={group.change}
                              onChange={(e) => updateGroupField(indices, 'change', e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">{group.items.length}</td>
                          <td className="px-3 py-2 max-w-xl">
                            <div className="flex flex-wrap gap-2 mb-2">
                              {group.items.map(({ row, index: rowIndex }) => (
                                <span
                                  key={row.player + row.time + rowIndex}
                                  className="px-2 py-1 bg-slate-800 rounded text-xs flex items-center gap-1"
                                >
                                  <span>{row.player}</span>
                                  <button
                                    className="text-red-300 hover:text-red-200"
                                    onClick={() => {
                                      setRows((prev) => prev.filter((_, idx) => idx !== rowIndex));
                                    }}
                                    title="移除该玩家"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                placeholder="输入玩家名，支持逗号/换行分隔"
                                value={groupAddInputs[groupKey] || ''}
                                onChange={(e) =>
                                  setGroupAddInputs((prev) => ({ ...prev, [groupKey]: e.target.value }))
                                }
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  addPlayersToGroup(groupKey, {
                                    reason: group.reason,
                                    date: group.date,
                                    time: group.time,
                                    change: group.change,
                                  })
                                }
                              >
                                添加玩家
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2 space-x-2">
                            <input
                              type="checkbox"
                              checked={allGroupSelected}
                              onChange={(e) => toggleGroupSelection(indices, e.target.checked)}
                            />
                            <Button size="sm" variant="secondary" onClick={() => cloneGroup(group)}>
                              克隆分组
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteGroup(indices)}>
                              删除分组
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
              <div className="text-sm text-red-300 mb-1">
                错误明细（最多显示 {importResult.errors.length} 条）：
              </div>
              <ul className="text-xs text-gray-400 space-y-1 max-h-48 overflow-auto bg-slate-900/60 border border-slate-700/60 rounded p-2">
                {importResult.errors.map((item: any, idx: number) => (
                  <li key={idx} className="leading-snug">
                    <span className="text-red-300 mr-1">[第 {idx + 1} 条]</span>
                    <span className="text-gray-200">{item.line}</span>
                    <span className="text-gray-500"> → </span>
                    <span className="text-orange-300">{item.error}</span>
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
