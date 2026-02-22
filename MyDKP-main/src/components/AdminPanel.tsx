'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportDialog } from './ImportDialog';
import { DecayDialog } from './DecayDialog';
import { TeamManagement } from './TeamManagement';
import { BatchDkpImportDialog } from './BatchDkpImportDialog';
import { AdminManagement } from './AdminManagement';
import { DkpLogManager } from './DkpLogManager';
import { Shield, Lock } from 'lucide-react';
import { LootLibrary } from './LootLibrary';
import { WebdkpImportTab } from './WebdkpImportTab';

interface AdminPanelProps {
  teamId: string;
  teams: any[];
  adminRole: string;
  onUpdate: () => void;
}

export function AdminPanel({ teamId, teams, adminRole, onUpdate }: AdminPanelProps) {
  const isSuperAdmin = adminRole === 'super_admin';
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [activeTab, setActiveTab] = useState('batch-import');
  const [permittedTeamIds, setPermittedTeamIds] = useState<string[] | null>(null);
  const availableTabs = useMemo(
    () =>
      isSuperAdmin
        ? ['batch-import', 'import', 'decay', 'logs', 'webdkp', 'team', 'admins', 'loot']
        : ['batch-import', 'import', 'decay', 'logs', 'webdkp'],
    [isSuperAdmin],
  );

  const permittedTeams = useMemo(() => {
    if (isSuperAdmin) {
      return teams;
    }
    if (!permittedTeamIds) {
      return [];
    }
    const allowed = new Set(permittedTeamIds);
    return teams.filter((team) => allowed.has(team.id));
  }, [isSuperAdmin, permittedTeamIds, teams]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('admin_panel_active_tab') : null;
    const nextTab = stored && availableTabs.includes(stored) ? stored : availableTabs[0];
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin_panel_active_tab', nextTab);
    }
  }, [availableTabs]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin_panel_active_tab', value);
    }
  };

  useEffect(() => {
    checkTeamPermission();
  }, [teamId, adminRole]);

  useEffect(() => {
    if (isSuperAdmin) {
      setPermittedTeamIds(null);
      return;
    }

    let cancelled = false;

    const fetchPermittedTeams = async () => {
      try {
        const res = await fetch('/api/auth/admin-teams');
        if (!res.ok) {
          throw new Error('Failed to load admin teams');
        }
        const data = await res.json();
        if (!cancelled) {
          const teamIds = Array.isArray(data?.teamIds) ? data.teamIds : [];
          setPermittedTeamIds(teamIds);
        }
      } catch (error) {
        console.error('Fetch admin teams error:', error);
        if (!cancelled) {
          setPermittedTeamIds([]);
        }
      }
    };

    fetchPermittedTeams();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const checkTeamPermission = async () => {
    if (!teamId) {
      setHasPermission(false);
      setCheckingPermission(false);
      return;
    }

    // 超级管理员总是有权限
    if (isSuperAdmin) {
      setHasPermission(true);
      setCheckingPermission(false);
      return;
    }

    setCheckingPermission(true);
    try {
      const res = await fetch(`/api/auth/check-team-permission?teamId=${teamId}`);
      const data = await res.json();
      setHasPermission(data.hasPermission === true);
    } catch (error) {
      console.error('Check permission error:', error);
      setHasPermission(false);
    } finally {
      setCheckingPermission(false);
    }
  };

  // 如果正在检查权限
  if (checkingPermission) {
    return (
      <Card className="mb-6 card-bg card-glow">
        <CardContent className="py-10 text-center text-gray-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p>检查权限中...</p>
        </CardContent>
      </Card>
    );
  }

  // 如果没有权限且不是超管
  if (!hasPermission && !isSuperAdmin) {
    return (
      <Card className="mb-6 card-bg card-glow border-red-900/50">
        <CardContent className="py-10 text-center">
          <Lock className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <p className="text-xl text-red-400 mb-2">您没有权限管理当前团队</p>
          <p className="text-gray-400">请联系超级管理员为您分配权限，或切换到您有权限的团队</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6 card-bg card-glow">
      <CardHeader className="bg-gradient-to-r from-purple-900/50 to-blue-900/50">
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-purple-400" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            管理面板
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-8' : 'grid-cols-5'} bg-slate-800/50`}>
            <TabsTrigger value="batch-import" className="data-[state=active]:bg-blue-950">
              批量变动
            </TabsTrigger>
            <TabsTrigger value="import" className="data-[state=active]:bg-blue-950">
              导入玩家
            </TabsTrigger>
            <TabsTrigger value="decay" className="data-[state=active]:bg-blue-950">
              衰减管理
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-blue-950">
              日志管理
            </TabsTrigger>
            <TabsTrigger value="webdkp" className="data-[state=active]:bg-blue-950">
              WebDKP导入
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="team" className="data-[state=active]:bg-blue-950">
                团队管理
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="admins" className="data-[state=active]:bg-purple-950">
                管理员
              </TabsTrigger>
            )}
            {isSuperAdmin && (
              <TabsTrigger value="loot" className="data-[state=active]:bg-purple-950">
                装备库
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="batch-import" className="space-y-4">
            <BatchDkpImportDialog teamId={teamId} teams={permittedTeams} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <ImportDialog teamId={teamId} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="decay" className="space-y-4">
            <DecayDialog teamId={teamId} teams={permittedTeams} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <DkpLogManager teams={permittedTeams} currentTeamId={teamId} onChange={onUpdate} />
          </TabsContent>

          <TabsContent value="webdkp" className="space-y-4">
            <WebdkpImportTab teams={permittedTeams} />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="team" className="space-y-4">
              <TeamManagement onUpdate={onUpdate} />
            </TabsContent>
          )}

          {isSuperAdmin && (
            <TabsContent value="admins" className="space-y-4">
              <AdminManagement teams={teams} currentAdminRole={adminRole} />
            </TabsContent>
          )}
          {isSuperAdmin && (
            <TabsContent value="loot" className="space-y-4">
              <LootLibrary />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
