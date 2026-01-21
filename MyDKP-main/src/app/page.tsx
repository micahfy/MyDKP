'use client';

import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/Navbar';
import { PlayerTable } from '@/components/PlayerTable';
import { Toaster } from 'sonner';
import { useSearchParams } from 'next/navigation';
import { usePathname } from 'next/navigation';

const AdminPanel = dynamic(() => import('@/components/AdminPanel').then((mod) => mod.AdminPanel), {
  ssr: false,
});

function HomeContent() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string>('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playerRefreshKey, setPlayerRefreshKey] = useState(0);
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const slugParam = (() => {
    const fromQuery = searchParams?.get('teamSlug');
    if (fromQuery) return fromQuery;
    const path = pathname || '';
    const segments = path.split('/').filter(Boolean);
    const reserved = ['api', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml', 'assets', 'public'];
    if (segments.length === 1 && !reserved.includes(segments[0])) {
      return segments[0];
    }
    return null;
  })();

  useEffect(() => {
    checkAuth();
  }, []);

  // 只在管理员登录后才加载完整团队信息
  useEffect(() => {
    if (isAdmin) {
      fetchFullTeams();
    } else {
      fetchBasicTeams();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    
    // 降低检查频率到30秒，减少服务器负载（仅管理员）
    const authCheckInterval = setInterval(() => {
      checkAuth();
    }, 30000); // 30秒
    
    return () => clearInterval(authCheckInterval);
  }, [isAdmin]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      
      // 如果角色发生变化，不再强制刷新页面，直接更新状态即可，避免正在查看的导入结果被刷掉
      if (data.isAdmin && data.role && adminRole && data.role !== adminRole) {
        console.log('Role changed from', adminRole, 'to', data.role, '- updating state');
      }

      setIsAdmin(data.isAdmin === true);
      setAdminRole(data.role || '');
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAdmin(false);
    }
  };

  // 访客用户：只加载基本团队信息（不含玩家数量等统计数据）
  const fetchBasicTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams/basic');
      const data = await res.json();
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        const matched = slugParam ? data.find((t: any) => t.slug === slugParam) : null;
        setSelectedTeam((matched || data[0]).id);
      }
    } catch (error) {
      console.error('Fetch basic teams failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 管理员用户：加载完整团队信息
  const fetchFullTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        const matched = slugParam ? data.find((t: any) => t.slug === slugParam) : null;
        setSelectedTeam((matched || data[0]).id);
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
      checkAuth();
      fetchFullTeams(); // 登录后立即加载完整数据
    } else {
      setAdminRole('');
      fetchBasicTeams(); // 登出后只加载基本数据
    }
  };

  const handleUpdate = () => {
    if (isAdmin) {
      fetchFullTeams();
    } else {
      fetchBasicTeams();
    }
    checkAuth(); // 同时检查权限
    setPlayerRefreshKey((key) => key + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <div className="text-xl text-gray-300">加载中...</div>
          </div>
        </div>
        <footer className="border-t border-slate-700/50">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-400">
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
              京ICP备12345678号
            </a>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Navbar
        teams={teams}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
        isAdmin={isAdmin}
        onAuthChange={handleAuthChange}
      />
      
      <main className="container mx-auto px-4 py-8">
        {isAdmin && (
          <Suspense fallback={null}>
            <AdminPanel 
              teamId={selectedTeam} 
              teams={teams} 
              adminRole={adminRole} 
              onUpdate={handleUpdate} 
            />
          </Suspense>
        )}
        
        {teams.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 text-lg mb-4">
              {isAdmin ? '暂无团队，请先创建一个团队' : '暂无团队数据'}
            </div>
            {isAdmin && adminRole === 'super_admin' && (
              <div className="text-sm text-gray-500">
                请在上方管理面板的"团队管理"标签中创建团队
              </div>
            )}
          </div>
        ) : (
          <PlayerTable teamId={selectedTeam} isAdmin={isAdmin} refreshKey={playerRefreshKey} />
        )}
      </main>

      <Toaster position="top-right" richColors />

      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-400">
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
            京ICP备12345678号
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
              <div className="text-xl text-gray-300">加载中...</div>
            </div>
          </div>
          <footer className="border-t border-slate-700/50">
            <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-400">
              <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">
                京ICP备12345678号
              </a>
            </div>
          </footer>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
