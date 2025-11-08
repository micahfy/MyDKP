'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { PlayerTable } from '@/components/PlayerTable';
import { AdminPanel } from '@/components/AdminPanel';
import { Toaster } from 'sonner';

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string>('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    fetchTeams();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      setIsAdmin(data.isAdmin === true);
      setAdminRole(data.role || '');
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAdmin(false);
    }
  };

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0].id);
      }
    } catch (error) {
      console.error('Fetch teams failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthChange = (newIsAdmin: boolean) => {
    setIsAdmin(newIsAdmin);
    if (newIsAdmin) {
      checkAuth(); // 重新验证
    }
  };

  const handleUpdate = () => {
    fetchTeams();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-600">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        isAdmin={isAdmin}
        onAuthChange={handleAuthChange}
      />
      
      <main className="container mx-auto px-4 py-8">
        {isAdmin && (
          <AdminPanel teamId={selectedTeam} onUpdate={handleUpdate} />
        )}
        
        {teams.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 text-lg mb-4">
              {isAdmin ? '暂无团队，请先创建一个团队' : '暂无团队数据'}
            </div>
            {isAdmin && (
              <div className="text-sm text-gray-500">
                请在上方管理面板的"团队管理"标签中创建团队
              </div>
            )}
          </div>
        ) : (
          <PlayerTable teamId={selectedTeam} isAdmin={isAdmin} />
        )}
      </main>

      <Toaster position="top-right" richColors />
    </div>
  );
}