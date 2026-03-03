'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type MailTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  subject: string;
  bodyText: string;
  updatedAt: string;
};

const PLACEHOLDERS_BY_KEY: Record<string, string[]> = {
  admin_password_reset: ['{{username}}', '{{resetLink}}', '{{expiresMinutes}}', '{{requestTime}}'],
  sensitive_alert_summary: ['{{batchCount}}', '{{teamCount}}', '{{timeRange}}', '{{sourceTypes}}', '{{records}}'],
};

export function EmailTemplateManagement() {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedKey, setSelectedKey] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.key === selectedKey) || null,
    [templates, selectedKey],
  );

  const placeholders = useMemo(
    () => PLACEHOLDERS_BY_KEY[selectedKey] || [],
    [selectedKey],
  );

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mail-templates');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取模板失败');
      }
      const list = Array.isArray(data.templates) ? data.templates : [];
      setTemplates(list);
      if (list.length > 0) {
        const key = selectedKey && list.some((item: MailTemplate) => item.key === selectedKey)
          ? selectedKey
          : list[0].key;
        setSelectedKey(key);
        const current = list.find((item: MailTemplate) => item.key === key);
        setSubject(current?.subject || '');
        setBodyText(current?.bodyText || '');
      }
    } catch (error: any) {
      toast.error(error?.message || '获取模板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject || '');
    setBodyText(selectedTemplate.bodyText || '');
  }, [selectedTemplate?.id]);

  const handleSave = async () => {
    if (!selectedTemplate) return;
    if (!subject.trim() || !bodyText.trim()) {
      toast.error('主题和正文不能为空');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/mail-templates/${selectedTemplate.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          bodyText,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存失败');
      }
      toast.success('模板已保存');
      await loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/mail-templates/${selectedTemplate.key}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '重置失败');
      }
      toast.success('模板已恢复默认');
      await loadTemplates();
    } catch (error: any) {
      toast.error(error?.message || '重置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-slate-900/60 to-slate-800/50 border-slate-700/50">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-100">邮件模板管理</h3>

        {loading ? (
          <div className="text-gray-400">加载中...</div>
        ) : templates.length === 0 ? (
          <div className="text-gray-400">暂无模板</div>
        ) : (
          <>
            <div>
              <Label className="text-gray-200">选择模板</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {templates.map((item) => (
                    <SelectItem key={item.key} value={item.key} className="text-gray-200">
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate?.description && (
                <p className="mt-1 text-xs text-gray-400">{selectedTemplate.description}</p>
              )}
            </div>

            <div>
              <Label className="text-gray-200">邮件主题</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-slate-900/50 border-slate-600 text-gray-200"
              />
            </div>

            <div>
              <Label className="text-gray-200">邮件正文（纯文本）</Label>
              <Textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="min-h-[260px] bg-slate-900/50 border-slate-600 text-gray-200"
              />
            </div>

            <div className="rounded border border-slate-700 bg-slate-900/40 p-3 text-xs text-gray-400">
              <p className="mb-1 text-gray-300">可用变量：</p>
              <div className="flex flex-wrap gap-2">
                {placeholders.length > 0 ? (
                  placeholders.map((item) => (
                    <span key={item} className="rounded bg-slate-800 px-2 py-1 text-gray-300">
                      {item}
                    </span>
                  ))
                ) : (
                  <span>无</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存模板'}
              </Button>
              <Button variant="outline" onClick={handleResetDefault} disabled={saving}>
                恢复默认
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
