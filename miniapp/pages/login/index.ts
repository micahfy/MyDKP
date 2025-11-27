import { request } from '../../utils/request';
import { setSession } from '../../stores/session';

Page({
  data: { username: '', password: '', loading: false },
  onUserChange(e: any) { this.setData({ username: e.detail.value }); },
  onPassChange(e: any) { this.setData({ password: e.detail.value }); },
  async onLogin() {
    if (!this.data.username || !this.data.password) return wx.showToast({ title: '请输入账号密码', icon: 'none' });
    this.setData({ loading: true });
    try {
      const res = await request<{ token: string; username: string }>({
        url: '/api/auth/login', method: 'POST',
        data: { username: this.data.username, password: this.data.password }
      });
      setSession(res.token, res.username);
      wx.showToast({ title: '登录成功' });
      wx.redirectTo({ url: '/pages/teams/index' });
    } catch (e: any) {
      wx.showToast({ title: e?.data?.error || '登录失败', icon: 'none' });
    } finally { this.setData({ loading: false }); }
  }
});
