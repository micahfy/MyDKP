'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type JoinRequest = {
  id: string;
  serverName: string;
  guildName: string;
  teamName: string;
  requestedUsername: string;
  email: string;
  status: string;
  approvalNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  reviewedByAdmin?: {
    id: string;
    username: string;
  } | null;
};

export function JoinRequestManagement() {
  const [loading, setLoading] = useState(true);
  const [savingSetting, setSavingSetting] = useState(false);
  const [reviewingId, setReviewingId] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const [joinRequestNotifyEmail, setJoinRequestNotifyEmail] = useState('');
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === 'pending').length,
    [requests],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingRes, requestsRes] = await Promise.all([
        fetch('/api/system-settings'),
        fetch(`/api/join-requests?status=${encodeURIComponent(statusFilter === 'all' ? '' : statusFilter)}`),
      ]);

      const settingData = await settingRes.json();
      const requestsData = await requestsRes.json();

      if (!settingRes.ok) {
        throw new Error(settingData.error || '加载系统设置失败');
      }
      if (!requestsRes.ok) {
        throw new Error(requestsData.error || '加载申请列表失败');
      }

      setJoinRequestNotifyEmail(String(settingData.joinRequestNotifyEmail || ''));
      setRequests(Array.isArray(requestsData.requests) ? requestsData.requests : []);
    } catch (error: any) {
      toast.error(error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSaveNotifyEmail = async () => {
    setSavingSetting(true);
    try {
      const res = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinRequestNotifyEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '保存通知邮箱失败');
      }
      setJoinRequestNotifyEmail(String(data.joinRequestNotifyEmail || ''));
      toast.success('通知邮箱已保存');
    } catch (error: any) {
      toast.error(error?.message || '保存通知邮箱失败');
    } finally {
      setSavingSetting(false);
    }
  };

  const reviewRequest = async (id: string, action: 'approve' | 'reject') => {
    setReviewingId(id);
    try {
      const res = await fetch(`/api/join-requests/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: notesById[id] || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '审批失败');
      }
      toast.success(action === 'approve' ? '申请已通过' : '申请已拒绝');
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || '审批失败');
    } finally {
      setReviewingId('');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/60 border-slate-700/60">
        <CardHeader>
          <CardTitle className="text-gray-100">申请通知邮箱</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-gray-300">超级管理员通知邮箱（单个）</Label>
            <Input
              value={joinRequestNotifyEmail}
              onChange={(e) => setJoinRequestNotifyEmail(e.target.value)}
              placeholder="super-admin@example.com"
              className="bg-slate-900/60 border-slate-600 text-gray-200"
            />
          </div>
          <Button onClick={handleSaveNotifyEmail} disabled={savingSetting}>
            {savingSetting ? '保存中...' : '保存通知邮箱'}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-slate-700/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-100">入驻申请审批（待审：{pendingCount}）</CardTitle>
          <div className="w-[180px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-900/60 border-slate-600 text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="pending" className="text-gray-200">仅待审批</SelectItem>
                <SelectItem value="approved" className="text-gray-200">仅已通过</SelectItem>
                <SelectItem value="rejected" className="text-gray-200">仅已拒绝</SelectItem>
                <SelectItem value="all" className="text-gray-200">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-400">加载中...</div>
          ) : requests.length === 0 ? (
            <div className="text-gray-400">暂无申请记录</div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="rounded border border-slate-700 bg-slate-900/50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-gray-100 font-semibold">
                        {request.serverName} / {request.guildName} / {request.teamName}
                      </div>
                      <div className="text-sm text-gray-400">
                        操作员: {request.requestedUsername} · 邮箱: {request.email}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        申请时间: {new Date(request.createdAt).toLocaleString('zh-CN')}
                        {request.reviewedAt ? ` · 审核时间: ${new Date(request.reviewedAt).toLocaleString('zh-CN')}` : ''}
                        {request.reviewedByAdmin?.username ? ` · 审核人: ${request.reviewedByAdmin.username}` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs border ${
                        request.status === 'pending'
                          ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
                          : request.status === 'approved'
                            ? 'bg-green-900/40 text-green-300 border-green-700'
                            : 'bg-red-900/40 text-red-300 border-red-700'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div>
                    <Label className="text-gray-300">审批备注</Label>
                    <Textarea
                      value={notesById[request.id] ?? request.approvalNote ?? ''}
                      onChange={(e) =>
                        setNotesById((prev) => ({
                          ...prev,
                          [request.id]: e.target.value,
                        }))
                      }
                      className="bg-slate-900/60 border-slate-600 text-gray-200 min-h-[90px]"
                    />
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        className="bg-green-700 hover:bg-green-800"
                        onClick={() => reviewRequest(request.id, 'approve')}
                        disabled={reviewingId === request.id}
                      >
                        {reviewingId === request.id ? '处理中...' : '通过'}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => reviewRequest(request.id, 'reject')}
                        disabled={reviewingId === request.id}
                      >
                        {reviewingId === request.id ? '处理中...' : '拒绝'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
