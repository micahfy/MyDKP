'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { PlayerTable } from '@/components/PlayerTable';
import { Toaster } from 'sonner';
import { resolveTeamSlug } from '@/lib/teamSlug';

const AdminPanel = dynamic(() => import('@/components/AdminPanel').then((mod) => mod.AdminPanel), {
  ssr: false,
});

const TEAM_STORAGE_KEY = 'mydkp:selectedTeamId';

type TeamItem = {
  id: string;
  name: string;
  serverName: string;
  guildName: string;
  slug?: string | null;
  description?: string | null;
  _count?: { players: number };
};

interface TeamDashboardProps {
  teamSlug: string;
}

export function TeamDashboard({ teamSlug }: TeamDashboardProps) {
  const router = useRouter();

  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState('');
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerRefreshKey, setPlayerRefreshKey] = useState(0);

  const selectedTeamSlug = useMemo(() => {
    const found = teams.find((team) => team.id === selectedTeam);
    return found ? resolveTeamSlug(found) : '';
  }, [selectedTeam, teams]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    try {
      localStorage.setItem(TEAM_STORAGE_KEY, selectedTeam);
    } catch (error) {
      console.error('Persist selected team failed:', error);
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminTeams();
    } else {
      fetchBasicTeams();
    }
  }, [isAdmin, teamSlug]);

  useEffect(() => {
    if (!isAdmin) return;
    const authCheckInterval = setInterval(() => {
      checkAuth();
    }, 30000);
    return () => clearInterval(authCheckInterval);
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedTeam || !selectedTeamSlug) return;
    if (selectedTeamSlug !== teamSlug) {
      router.replace(`/team/${encodeURIComponent(selectedTeamSlug)}`);
    }
  }, [selectedTeam, selectedTeamSlug, teamSlug, router]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setIsAdmin(data.isAdmin === true);
      setAdminRole(data.role || '');
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAdmin(false);
      setAdminRole('');
    }
  };

  const resolvePreferredTeamId = (teamList: TeamItem[]) => {
    if (!Array.isArray(teamList) || teamList.length === 0) return '';

    const slugMatched = teamList.find((team) => resolveTeamSlug(team) === teamSlug);
    if (slugMatched) return slugMatched.id;

    try {
      const storedTeamId = localStorage.getItem(TEAM_STORAGE_KEY) || '';
      if (storedTeamId && teamList.some((team) => team.id === storedTeamId)) {
        return storedTeamId;
      }
    } catch (error) {
      console.error('Read selected team from storage failed:', error);
    }

    return teamList[0].id;
  };

  const applyTeamList = (teamList: TeamItem[]) => {
    setTeams(teamList);
    if (teamList.length === 0) {
      setSelectedTeam('');
      return;
    }

    const nextTeamId = resolvePreferredTeamId(teamList);
    setSelectedTeam(nextTeamId);

    const matched = teamList.find((team) => team.id === nextTeamId);
    if (matched) {
      const nextSlug = resolveTeamSlug(matched);
      if (nextSlug && nextSlug !== teamSlug) {
        router.replace(`/team/${encodeURIComponent(nextSlug)}`);
      }
    }
  };

  const fetchBasicTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams/basic');
      const data = await res.json();
      applyTeamList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fetch basic teams failed:', error);
      setTeams([]);
      setSelectedTeam('');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) {
        throw new Error('fetch admin teams failed');
      }
      const data = await res.json();
      applyTeamList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fetch admin teams failed:', error);
      setTeams([]);
      setSelectedTeam('');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthChange = (newIsAdmin: boolean) => {
    setIsAdmin(newIsAdmin);
    if (newIsAdmin) {
      checkAuth();
      fetchAdminTeams();
    } else {
      setAdminRole('');
      fetchBasicTeams();
    }
  };

  const handleUpdate = () => {
    if (isAdmin) {
      fetchAdminTeams();
    } else {
      fetchBasicTeams();
    }
    checkAuth();
    setPlayerRefreshKey((key) => key + 1);
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    const target = teams.find((team) => team.id === teamId);
    if (target) {
      const slug = resolveTeamSlug(target);
      router.push(`/team/${encodeURIComponent(slug)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <div className="text-xl text-gray-300">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Navbar
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={handleTeamChange}
        isAdmin={isAdmin}
        onAuthChange={handleAuthChange}
      />

      <main className="container mx-auto px-4 py-8">
        {isAdmin && selectedTeam && (
          <AdminPanel teamId={selectedTeam} teams={teams} adminRole={adminRole} onUpdate={handleUpdate} />
        )}

        {teams.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 text-lg mb-4">
              {isAdmin ? '暂无团队，请先创建一个团队' : '暂无团队数据'}
            </div>
          </div>
        ) : (
          <PlayerTable teamId={selectedTeam} isAdmin={isAdmin} refreshKey={playerRefreshKey} />
        )}
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}
