import { API_BASE } from '../config';
import { getToken } from '../stores/session';

export function request<T = any>(options: WechatMiniprogram.RequestOption): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      url: ${API_BASE},
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {}),
        Authorization: getToken() ? Bearer  : '',
      },
      success(res) {
        if (res.statusCode === 401) {
          wx.navigateTo({ url: '/pages/login/index' });
          return reject(res);
        }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(res.data as T);
        reject(res);
      },
      fail(err) { reject(err); },
    });
  });
}
