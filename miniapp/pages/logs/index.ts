import { request } from '../../utils/request';
import { getTeam } from '../../stores/session';

Page({
  data: { list: [] as any[], page: 1, totalPages: 1, view: 'events' as 'events'|'entries', viewIndex: 0 },
  async onLoad() { this.fetch(); },
  async fetch() {
    const teamId = getTeam(); if (!teamId) return wx.redirectTo({ url: '/pages/teams/index' });
    const { page, view } = this.data;
    const data = await request<any>({ url: /api/dkp/logs/manage?view=&page=&pageSize=20&teamId= });
    this.setData({
      list: page === 1 ? (view === 'events' ? data.events || [] : data.logs || []) :
        this.data.list.concat(view === 'events' ? (data.events || []) : (data.logs || [])),
      totalPages: data.totalPages || 1,
    });
  },
  onViewChange(e: any) {
    const idx = Number(e.detail.value);
    this.setData({ viewIndex: idx, view: idx === 0 ? 'events' : 'entries', page: 1, list: [] }, () => this.fetch());
  },
  onReachBottom() {
    if (this.data.page < this.data.totalPages) {
      this.setData({ page: this.data.page + 1 }, () => this.fetch());
    }
  }
});
