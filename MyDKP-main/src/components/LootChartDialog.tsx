'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LootHistoryItem } from '@/types/loot';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LootChartDialogProps {
  item: LootHistoryItem;
  open: boolean;
  onClose: () => void;
}

export function LootChartDialog({ item, open, onClose }: LootChartDialogProps) {
  // 准备图表数据
  const chartData = item.priceHistory.map((point, index) => ({
    index: index + 1,
    time: new Date(point.timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    price: point.price,
    player: point.player,
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-900 border-purple-800/60">
        <DialogHeader>
          <DialogTitle className="text-2xl text-purple-400">
            {item.itemName}
          </DialogTitle>
        </DialogHeader>

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-slate-800/60 rounded-lg border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">掉落次数</div>
            <div className="text-3xl font-bold text-blue-400">{item.dropCount}</div>
          </div>
          <div className="text-center p-4 bg-slate-800/60 rounded-lg border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">平均价格</div>
            <div className="text-3xl font-bold text-purple-400">
              {item.avgPrice.toFixed(1)}
            </div>
          </div>
          <div className="text-center p-4 bg-slate-800/60 rounded-lg border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">最低价格</div>
            <div className="text-3xl font-bold text-green-400">{item.minPrice}</div>
          </div>
          <div className="text-center p-4 bg-slate-800/60 rounded-lg border border-slate-700">
            <div className="text-sm text-gray-400 mb-1">最高价格</div>
            <div className="text-3xl font-bold text-red-400">{item.maxPrice}</div>
          </div>
        </div>

        {/* 折线图 */}
        <div className="h-96 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9ca3af"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
                fontSize={12}
              />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                formatter={(value: number | undefined) => [
                  `${value || 0} DKP`,
                  '价格',
                ]}
                labelFormatter={(label) => {
                  const dataPoint = chartData.find((d) => d.time === label);
                  return dataPoint ? `玩家: ${dataPoint.player}` : label;
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ fill: '#a855f7', r: 4 }}
                activeDot={{ r: 6, stroke: '#a855f7', strokeWidth: 2 }}
                name="DKP价格"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 详细记录表格 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-200 mb-3">详细记录</h3>
          <div className="max-h-60 overflow-auto border border-slate-700 rounded-lg">
            <Table>
              <TableHeader className="bg-slate-800/60 sticky top-0">
                <TableRow>
                  <TableHead className="text-gray-300">序号</TableHead>
                  <TableHead className="text-gray-300">时间</TableHead>
                  <TableHead className="text-gray-300">玩家</TableHead>
                  <TableHead className="text-gray-300 text-right">价格</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.priceHistory.map((point, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-800/30">
                    <TableCell className="text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="text-gray-300">
                      {new Date(point.timestamp).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-gray-300">{point.player}</TableCell>
                    <TableCell className="text-right font-semibold text-purple-400">
                      {point.price}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
