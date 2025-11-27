import { request } from '../../utils/request';
import { setTeam } from '../../stores/session';

Page({
  data: { teams: [] as any[] },
  async onLoad() {
    try {
      const data = await request<any[]>({ url: '/api/teams', method: 'GET' });
      this.setData({ teams: data || [] });
    } catch (e) { wx.showToast({ title: '获取团队失败', icon: 'none' }); }
  },
  onSelect(e: any) {
    const id = e.currentTarget.dataset.id;
    setTeam(id);
    wx.showToast({ title: '已选择团队' });
    wx.redirectTo({ url: '/pages/dashboard/index' });
  }
});
