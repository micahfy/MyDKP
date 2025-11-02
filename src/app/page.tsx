'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { PlayerTable } from '@/components/PlayerTable';
import { AdminPanel } from '@/components/AdminPanel';
import { DkpLogTable } from '@/components/DkpLogTable';
import { Toaster } from 'sonner';
import { Team } from '@/types';

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchTeams();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const res = await fetch('/api/auth/check');
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.isAdmin);
      }
    } catch (error) {
      // Session check failed, user is not admin
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch teams');
    }
  };

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
    fetchTeams();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        isAdmin={isAdmin}
        onAuthChange={setIsAdmin}
      />

      <main className="container mx-auto px-4 py-8">
        {isAdmin && <AdminPanel teamId={selectedTeam} onUpdate={handleUpdate} />}

        <PlayerTable key={`players-${refreshKey}`} teamId={selectedTeam} />

        <DkpLogTable key={`logs-${refreshKey}`} teamId={selectedTeam} />
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-600">
          <p>
            ⚔️ WoW DKP Manager - 开源魔兽世界DKP管理系统
          </p>
          <p className="mt-2">
            使用 Next.js + Prisma + SQLite 构建
          </p>
        </div>
      </footer>

      <Toaster position="top-right" richColors />
    </div>
  );
}