import { request } from '../../utils/request';
import { getTeam } from '../../stores/session';

Page({
  data: { teamId: '', stats: { players: 0, events: 0, last: '' } },
  async onLoad() { await this.fetch(); },
  async fetch() {
    const teamId = getTeam();
    if (!teamId) return wx.redirectTo({ url: '/pages/teams/index' });
    try {
      // 需后端提供 /api/dkp/summary?teamId=...
      const data = await request<any>({ url: /api/dkp/summary?teamId=, method: 'GET' });
      this.setData({ teamId, stats: data || this.data.stats });
    } catch (e) { wx.showToast({ title: '获取概览失败', icon: 'none' }); }
  }
});
