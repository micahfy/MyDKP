import { loadSession } from './stores/session';
App({
  onLaunch() { loadSession(); },
  globalData: {}
});
