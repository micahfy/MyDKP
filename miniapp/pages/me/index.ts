import { clearSession, getUsername } from '../../stores/session';

Page({
  data: { username: '' },
  onShow() { this.setData({ username: getUsername() }); },
  onLogout() {
    clearSession();
    wx.reLaunch({ url: '/pages/login/index' });
  }
});
