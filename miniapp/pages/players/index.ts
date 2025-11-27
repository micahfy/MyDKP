import { request } from '../../utils/request';
import { getTeam } from '../../stores/session';

Page({
  data: { list: [] as any[], keyword: '' },
  async onLoad() { this.fetchPlayers(); },
  async fetchPlayers() {
    const teamId = getTeam(); if (!teamId) return wx.redirectTo({ url: '/pages/teams/index' });
    const data = await request<any[]>({ url: /api/players?teamId=&search= });
    this.setData({ list: data || [] });
  },
  onSearch(e: any) { this.setData({ keyword: e.detail.value }, () => this.fetchPlayers()); }
});
