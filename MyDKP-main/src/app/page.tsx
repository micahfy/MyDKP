'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { JoinRequestDialog } from '@/components/JoinRequestDialog';
import { Toaster } from 'sonner';
import { resolveTeamSlug } from '@/lib/teamSlug';

type TeamItem = {
  id: string;
  name: string;
  serverName: string;
  guildName: string;
  slug?: string | null;
};

const ENTRY_STORAGE_KEY = 'mydkp:entrySelection';

export default function Home() {
  const router = useRouter();

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState('');
  const [selectedGuild, setSelectedGuild] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const serverOptions = useMemo(() => {
    return Array.from(new Set(teams.map((team) => team.serverName).filter(Boolean)));
  }, [teams]);

  const guildOptions = useMemo(() => {
    if (!selectedServer) return [];
    return Array.from(
      new Set(
        teams
          .filter((team) => team.serverName === selectedServer)
          .map((team) => team.guildName)
          .filter(Boolean),
      ),
    );
  }, [teams, selectedServer]);

  const teamOptions = useMemo(() => {
    if (!selectedServer || !selectedGuild) return [];
    return teams.filter((team) => team.serverName === selectedServer && team.guildName === selectedGuild);
  }, [teams, selectedServer, selectedGuild]);

  useEffect(() => {
    initializePage();
  }, []);

  useEffect(() => {
    if (serverOptions.length === 0) return;
    if (!selectedServer || !serverOptions.includes(selectedServer)) {
      setSelectedServer(serverOptions[0]);
    }
  }, [serverOptions, selectedServer]);

  useEffect(() => {
    if (guildOptions.length === 0) {
      setSelectedGuild('');
      return;
    }
    if (!selectedGuild || !guildOptions.includes(selectedGuild)) {
      setSelectedGuild(guildOptions[0]);
    }
  }, [guildOptions, selectedGuild]);

  useEffect(() => {
    if (teamOptions.length === 0) {
      setSelectedTeamId('');
      return;
    }
    if (!selectedTeamId || !teamOptions.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(teamOptions[0].id);
    }
  }, [teamOptions, selectedTeamId]);

  const initializePage = async () => {
    await Promise.all([checkAdminAndRedirect(), fetchBasicTeams()]);
  };

  const checkAdminAndRedirect = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.isAdmin === true) {
        await redirectToFirstAdminTeam();
      }
    } catch (error) {
      console.error('check auth on entry page failed:', error);
    }
  };

  const fetchBasicTeams = async () => {
    setLoading(true);
    try {
      const [res, defaultRes] = await Promise.all([
        fetch('/api/teams/basic'),
        fetch('/api/entry/default-team'),
      ]);
      const data = await res.json();
      const defaultData = defaultRes.ok ? await defaultRes.json() : { team: null };
      const teamList = Array.isArray(data) ? data : [];
      setTeams(teamList);

      let hasStoredSelection = false;
      try {
        const raw = localStorage.getItem(ENTRY_STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          if (stored.serverName) setSelectedServer(stored.serverName);
          if (stored.guildName) setSelectedGuild(stored.guildName);
          if (stored.teamId) setSelectedTeamId(stored.teamId);
          hasStoredSelection = true;
        }
      } catch (error) {
        console.error('read entry selection failed:', error);
      }

      if (!hasStoredSelection && defaultData?.team?.id) {
        const defaultTeam = teamList.find((item) => item.id === defaultData.team.id);
        if (defaultTeam) {
          setSelectedServer(defaultTeam.serverName || '');
          setSelectedGuild(defaultTeam.guildName || '');
          setSelectedTeamId(defaultTeam.id);
        }
      }
    } catch (error) {
      console.error('Fetch basic teams failed:', error);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  const redirectToFirstAdminTeam = async () => {
    const res = await fetch('/api/auth/default-team');
    if (!res.ok) return;

    const data = await res.json();
    const slug = String(data?.teamSlug || '').trim();
    if (!slug) return;
    router.replace(`/${encodeURIComponent(slug)}`);
  };

  const handleEnterTeam = () => {
    const selectedTeam = teamOptions.find((team) => team.id === selectedTeamId);
    if (!selectedTeam) return;

    try {
      localStorage.setItem(
        ENTRY_STORAGE_KEY,
        JSON.stringify({
          serverName: selectedServer,
          guildName: selectedGuild,
          teamId: selectedTeam.id,
        }),
      );
    } catch (error) {
      console.error('save entry selection failed:', error);
    }

    const slug = resolveTeamSlug(selectedTeam);
    router.push(`/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navbar
        teams={[]}
        selectedTeam=""
        onTeamChange={() => undefined}
        isAdmin={false}
        onAuthChange={() => undefined}
        onLoginSuccess={redirectToFirstAdminTeam}
      />

      <main className="container mx-auto px-4 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-gray-100">进入团队 DKP 页面</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-gray-400">加载中...</div>
              ) : teams.length === 0 ? (
                <div className="text-gray-400">暂无可用团队</div>
              ) : (
                <>
                  <div>
                    <div className="text-sm text-gray-300 mb-1">选择服务器</div>
                    <Select value={selectedServer} onValueChange={setSelectedServer}>
                      <SelectTrigger className="bg-slate-800/60 border-slate-600 text-gray-200">
                        <SelectValue placeholder="请选择服务器" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {serverOptions.map((item) => (
                          <SelectItem key={item} value={item} className="text-gray-200">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-sm text-gray-300 mb-1">选择工会</div>
                    <Select value={selectedGuild} onValueChange={setSelectedGuild}>
                      <SelectTrigger className="bg-slate-800/60 border-slate-600 text-gray-200">
                        <SelectValue placeholder="请选择工会" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {guildOptions.map((item) => (
                          <SelectItem key={item} value={item} className="text-gray-200">
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="text-sm text-gray-300 mb-1">选择团队</div>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger className="bg-slate-800/60 border-slate-600 text-gray-200">
                        <SelectValue placeholder="请选择团队" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {teamOptions.map((team) => (
                          <SelectItem key={team.id} value={team.id} className="text-gray-200">
                            {team.name} ({resolveTeamSlug(team)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" onClick={handleEnterTeam} disabled={!selectedTeamId}>
                    进入团队页面
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 border-slate-700">
            <CardHeader>
              <CardTitle className="text-gray-100">申请加入</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-400">提交申请后将通知超级管理员审批，审批通过后自动创建账号与团队。</p>
              <JoinRequestDialog />
            </CardContent>
          </Card>
        </div>
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}
