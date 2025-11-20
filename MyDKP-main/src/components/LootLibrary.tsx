'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

interface LootItem {
  id: string;
  name: string;
  createdAt: string;
}

export function LootLibrary() {
  const [items, setItems] = useState<LootItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/loot-items');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '获取失败');
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Fetch loot items error:', error);
      toast.error(error?.message || '获取装备库失败');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const submitNames = async (payload: any, successMsg: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/loot-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '操作失败');
      }
      toast.success(successMsg.replace('{count}', String(data.created || 0)));
      setBulkText('');
      setNewName('');
      fetchItems();
    } catch (error: any) {
      toast.error(error?.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSingle = async () => {
    if (!newName.trim()) {
      toast.error('请输入装备名称');
      return;
    }
    await submitNames({ name: newName.trim() }, '已添加 1 个装备名称');
  };

  const handleBulkImport = async () => {
    const text = bulkText.trim();
    if (!text) {
      toast.error('请输入要导入的装备名称，一行一个');
      return;
    }
    await submitNames({ text }, '已新建 {count} 个装备名称');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除装备「${name}」吗？`)) {
      return;
    }
    try {
      const res = await fetch(`/api/loot-items/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '删除失败');
      }
      toast.success(`已删除 ${name}`);
      fetchItems();
    } catch (error: any) {
      toast.error(error?.message || '删除失败');
    }
  };

  return (
    <Card className="card-bg border-purple-800/60">
      <CardHeader>
        <CardTitle className="text-purple-200">装备名称库</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-300 block mb-2">新增单个装备</label>
              <div className="flex space-x-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如：堕落天启四件套"
                  className="bg-slate-900/50 border-slate-700 text-gray-100"
                />
                <Button onClick={handleAddSingle} disabled={submitting}>
                  添加
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-2">
                批量导入（每行一个装备名称）
              </label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                className="bg-slate-900/50 border-slate-700 text-gray-100"
                placeholder="示例：&#10;堕落十字军腰带&#10;世界坠饰"
              />
              <Button
                onClick={handleBulkImport}
                className="mt-2 w-full bg-purple-700 hover:bg-purple-800"
                disabled={submitting}
              >
                批量导入
              </Button>
            </div>
            <p className="text-sm text-gray-400">
              说明：在装备名称库中的词条会在DKP日志导入/记分时自动转成 [名称] 格式，并在前端显示史诗色。
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-gray-100 font-semibold">当前装备（{items.length}）</h3>
              <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
                刷新
              </Button>
            </div>
            <div className="max-h-80 overflow-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-center text-gray-400 py-10">加载中...</div>
              ) : items.length === 0 ? (
                <div className="text-center text-gray-400 py-10">尚未录入装备</div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border border-purple-800/60 rounded-lg px-3 py-2 bg-slate-900/40"
                  >
                    <div>
                      <div className="text-gray-100 font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(item.id, item.name)}
                      className="text-red-400 hover:text-red-200 hover:bg-red-900/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
