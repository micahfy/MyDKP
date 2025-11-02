'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportDialog } from './ImportDialog';
import { DecayDialog } from './DecayDialog';
import { DkpOperationForm } from './DkpOperationForm';
import { TeamManagement } from './TeamManagement';

interface AdminPanelProps {
  teamId: string;
  onUpdate: () => void;
}

export function AdminPanel({ teamId, onUpdate }: AdminPanelProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>🛠️ 管理面板</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="operation" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="operation">DKP操作</TabsTrigger>
            <TabsTrigger value="import">导入数据</TabsTrigger>
            <TabsTrigger value="decay">衰减管理</TabsTrigger>
            <TabsTrigger value="team">团队管理</TabsTrigger>
          </TabsList>

          <TabsContent value="operation" className="space-y-4">
            <DkpOperationForm teamId={teamId} onSuccess={onUpdate} />
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
        </Tabs>
      </CardContent>
    </Card>
  );
}