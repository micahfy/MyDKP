let token = '';
let teamId = '';
let username = '';

export function setSession(t: string, u: string) {
  token = t; username = u;
  wx.setStorageSync('token', t);
  wx.setStorageSync('username', u);
}
export function loadSession() {
  token = wx.getStorageSync('token') || '';
  username = wx.getStorageSync('username') || '';
  teamId = wx.getStorageSync('teamId') || '';
}
export function clearSession() {
  token = ''; username = ''; teamId = '';
  wx.removeStorageSync('token'); wx.removeStorageSync('username'); wx.removeStorageSync('teamId');
}
export function setTeam(id: string) { teamId = id; wx.setStorageSync('teamId', id); }
export function getTeam() { return teamId; }
export function getToken() { return token; }
export function getUsername() { return username; }
