'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportDialog } from './ImportDialog';
import { DecayDialog } from './DecayDialog';
import { DkpOperationForm } from './DkpOperationForm';
import { TeamManagement } from './TeamManagement';
import { BatchDkpImportDialog } from './BatchDkpImportDialog';
import { AdminManagement } from './AdminManagement';
import { Shield } from 'lucide-react';

interface AdminPanelProps {
  teamId: string;
  teams: any[];
  adminRole: string;
  onUpdate: () => void;
}

export function AdminPanel({ teamId, teams, adminRole, onUpdate }: AdminPanelProps) {
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
        <Tabs defaultValue="operation" className="w-full">
          <TabsList className={`grid w-full ${adminRole === 'super_admin' ? 'grid-cols-6' : 'grid-cols-5'} bg-slate-800/50`}>
            <TabsTrigger value="operation" className="data-[state=active]:bg-blue-950">
              DKP操作
            </TabsTrigger>
            <TabsTrigger value="batch-import" className="data-[state=active]:bg-blue-950">
              批量变动
            </TabsTrigger>
            <TabsTrigger value="import" className="data-[state=active]:bg-blue-950">
              导入玩家
            </TabsTrigger>
            <TabsTrigger value="decay" className="data-[state=active]:bg-blue-950">
              衰减管理
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-blue-950">
              团队管理
            </TabsTrigger>
            {adminRole === 'super_admin' && (
              <TabsTrigger value="admins" className="data-[state=active]:bg-purple-950">
                管理员
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="operation" className="space-y-4">
            <DkpOperationForm teamId={teamId} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="batch-import" className="space-y-4">
            <BatchDkpImportDialog teamId={teamId} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <ImportDialog teamId={teamId} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="decay" className="space-y-4">
            <DecayDialog teamId={teamId} onSuccess={onUpdate} />
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <TeamManagement onUpdate={onUpdate} />
          </TabsContent>

          {adminRole === 'super_admin' && (
            <TabsContent value="admins" className="space-y-4">
              <AdminManagement teams={teams} currentAdminRole={adminRole} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}