'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { PlayerTable } from '@/components/PlayerTable';
import { AdminPanel } from '@/components/AdminPanel';
import { Toaster } from 'sonner';

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const res = await fetch('/api/teams');
    const data = await res.json();
    setTeams(data);
    if (data.length > 0 && !selectedTeam) {
      setSelectedTeam(data[0].id);
    }
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
        {isAdmin && (
          <AdminPanel teamId={selectedTeam} onUpdate={fetchTeams} />
        )}
        
        <PlayerTable teamId={selectedTeam} />
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
