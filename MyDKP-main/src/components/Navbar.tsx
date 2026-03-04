'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, LogOut, Shield, Swords, User } from 'lucide-react';
import { toast } from 'sonner';
import { Team } from '@/types';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface NavbarProps {
  teams: Team[];
  selectedTeam: string;
  onTeamChange: (teamId: string) => void;
  isAdmin: boolean;
  onAuthChange: (isAdmin: boolean) => void;
  onLoginSuccess?: () => void | Promise<void>;
}

type LoginCaptchaConfig = {
  required: boolean;
  enabled: boolean;
  emergencyBypass: boolean;
  configured: boolean;
  identity: string;
  sceneId: string;
  region: string;
};

type AliyunCaptchaInstance = {
  refresh?: () => void;
};

type AliyunCaptchaInitOptions = {
  SceneId: string;
  mode: 'popup';
  element: string;
  button: string;
  server: string[];
  success?: (captchaVerifyParam: string) => void;
  fail?: (errorInfo: unknown) => void;
  onClose?: () => void;
  onError?: (errorInfo: unknown) => void;
  getInstance?: (instance: AliyunCaptchaInstance) => void;
};

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: string;
      prefix: string;
    };
    initAliyunCaptcha?: (options: AliyunCaptchaInitOptions) => void;
  }
}

const CAPTCHA_SCRIPT_ID = 'aliyun-esa-captcha-script';
const CAPTCHA_TRIGGER_ID = 'admin-login-captcha-trigger';
const CAPTCHA_ELEMENT_ID = 'admin-login-captcha-element';
const DEFAULT_LOGIN_CAPTCHA_CONFIG: LoginCaptchaConfig = {
  required: false,
  enabled: false,
  emergencyBypass: false,
  configured: false,
  identity: '',
  sceneId: '',
  region: 'cn',
};

let captchaScriptLoadingPromise: Promise<void> | null = null;

function loadAliyunCaptchaScript(region: string, prefix: string) {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  window.AliyunCaptchaConfig = { region, prefix };

  if (typeof window.initAliyunCaptcha === 'function') {
    return Promise.resolve();
  }

  if (captchaScriptLoadingPromise) {
    return captchaScriptLoadingPromise;
  }

  captchaScriptLoadingPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(CAPTCHA_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => {
          captchaScriptLoadingPromise = null;
          reject(new Error('加载阿里云验证码脚本失败'));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = CAPTCHA_SCRIPT_ID;
    script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      captchaScriptLoadingPromise = null;
      reject(new Error('加载阿里云验证码脚本失败'));
    };
    document.head.appendChild(script);
  });

  return captchaScriptLoadingPromise;
}

export function Navbar({
  teams,
  selectedTeam,
  onTeamChange,
  isAdmin,
  onAuthChange,
  onLoginSuccess,
}: NavbarProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [captchaConfigLoading, setCaptchaConfigLoading] = useState(false);
  const [captchaOpening, setCaptchaOpening] = useState(false);
  const [captchaLayerOpen, setCaptchaLayerOpen] = useState(false);
  const [loginCaptchaConfig, setLoginCaptchaConfig] = useState<LoginCaptchaConfig>(
    DEFAULT_LOGIN_CAPTCHA_CONFIG,
  );
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: string;
  } | null>(null);

  const captchaInstanceRef = useRef<AliyunCaptchaInstance | null>(null);
  const captchaInitSignatureRef = useRef('');
  const pendingCredentialsRef = useRef<{ username: string; password: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchCurrentUser();
    } else {
      setCurrentUser(null);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isLoginOpen || isAdmin) {
      return;
    }
    void fetchLoginCaptchaConfig();
  }, [isLoginOpen, isAdmin]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (data.isAdmin && data.username) {
        setCurrentUser({
          username: data.username,
          role: data.role,
        });
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchLoginCaptchaConfig = async () => {
    setCaptchaConfigLoading(true);
    try {
      const res = await fetch('/api/auth/login-captcha-config', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '获取验证码配置失败');
      }
      setLoginCaptchaConfig({
        required: Boolean(data.required),
        enabled: Boolean(data.enabled),
        emergencyBypass: Boolean(data.emergencyBypass),
        configured: Boolean(data.configured),
        identity: String(data.identity || '').trim(),
        sceneId: String(data.sceneId || '').trim(),
        region: String(data.region || 'cn').trim() || 'cn',
      });
    } catch (error: any) {
      console.error('Fetch login captcha config failed:', error);
      toast.error(error?.message || '获取验证码配置失败');
      setLoginCaptchaConfig(DEFAULT_LOGIN_CAPTCHA_CONFIG);
    } finally {
      setCaptchaConfigLoading(false);
    }
  };

  const submitLogin = async (
    credentials: { username: string; password: string },
    captchaVerifyParam?: string,
  ) => {
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (captchaVerifyParam) {
        headers.captcha_verify_param = captchaVerifyParam;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          captchaVerifyParam: captchaVerifyParam || '',
        }),
      });

      const verifyCode = (res.headers.get('x-captcha-verify-code') || '').trim().toUpperCase();
      const serverCaptchaRequired = res.headers.get('x-admin-login-captcha-required') === '1';
      const data = await res.json();

      if (loginCaptchaConfig.required || serverCaptchaRequired) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocalDirectHost = host === 'localhost' || host === '127.0.0.1';
        const verifyPassed = verifyCode === 'T001' || (isLocalDirectHost && !verifyCode);

        if (!verifyPassed) {
          toast.error(`拼图验证码校验失败${verifyCode ? `（${verifyCode}）` : ''}`);
          captchaInstanceRef.current?.refresh?.();
          return;
        }
      }

      if (res.ok) {
        toast.success('登录成功');
        onAuthChange(true);
        setIsLoginOpen(false);
        setUsername('');
        setPassword('');
        setShowForgotPassword(false);
        setForgotIdentifier('');
        fetchCurrentUser();
        if (onLoginSuccess) {
          await onLoginSuccess();
        }
      } else {
        toast.error(data.error || '登录失败');
      }
    } catch (error) {
      toast.error('登录失败，请重试');
    } finally {
      setLoading(false);
      setCaptchaOpening(false);
      setCaptchaLayerOpen(false);
      pendingCredentialsRef.current = null;
    }
  };

  const ensureCaptchaReady = async () => {
    if (!loginCaptchaConfig.configured) {
      toast.error('管理员登录验证码已开启，但 ESA 参数未配置完整');
      return false;
    }

    const signature = `${loginCaptchaConfig.region}|${loginCaptchaConfig.identity}|${loginCaptchaConfig.sceneId}`;
    if (captchaInstanceRef.current && captchaInitSignatureRef.current === signature) {
      return true;
    }

    setCaptchaOpening(true);
    try {
      await loadAliyunCaptchaScript(loginCaptchaConfig.region, loginCaptchaConfig.identity);
      if (typeof window.initAliyunCaptcha !== 'function') {
        throw new Error('验证码 SDK 未加载');
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const done = (error?: Error) => {
          if (settled) return;
          settled = true;
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        };

        window.initAliyunCaptcha?.({
          SceneId: loginCaptchaConfig.sceneId,
          mode: 'popup',
          element: `#${CAPTCHA_ELEMENT_ID}`,
          button: `#${CAPTCHA_TRIGGER_ID}`,
          server: ['captcha-esa-open.aliyuncs.com', 'captcha-esa-open-b.aliyuncs.com'],
          success: (captchaVerifyParam: string) => {
            const pending = pendingCredentialsRef.current;
            if (!pending) {
              toast.error('登录信息已失效，请重新点击登录');
              setCaptchaLayerOpen(false);
              return;
            }
            void submitLogin(pending, captchaVerifyParam);
          },
          fail: (errorInfo: unknown) => {
            console.error('captcha verify fail:', errorInfo);
            toast.error('验证码未通过，请重试');
            setCaptchaLayerOpen(false);
          },
          onClose: () => {
            setCaptchaLayerOpen(false);
          },
          onError: (errorInfo: unknown) => {
            console.error('captcha init error:', errorInfo);
            done(new Error('验证码初始化失败'));
          },
          getInstance: (instance: AliyunCaptchaInstance) => {
            captchaInstanceRef.current = instance;
            captchaInitSignatureRef.current = signature;
            done();
          },
        });
      });

      return true;
    } catch (error) {
      console.error('Ensure captcha ready failed:', error);
      toast.error('验证码初始化失败，请稍后再试');
      return false;
    } finally {
      setCaptchaOpening(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || captchaOpening) {
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    const credentials = {
      username: trimmedUsername,
      password,
    };
    pendingCredentialsRef.current = credentials;

    if (!loginCaptchaConfig.required) {
      await submitLogin(credentials);
      return;
    }

    if (captchaConfigLoading) {
      toast.warning('验证码配置加载中，请稍后重试');
      return;
    }

    const ready = await ensureCaptchaReady();
    if (!ready) {
      return;
    }

    const trigger = document.getElementById(CAPTCHA_TRIGGER_ID);
    if (!trigger) {
      toast.error('验证码触发器未找到，请刷新页面重试');
      return;
    }

    setCaptchaLayerOpen(true);
    (trigger as HTMLButtonElement).click();
  };

  const handleForgotPassword = async () => {
    const identifier = forgotIdentifier.trim();
    if (!identifier) {
      toast.error('请输入用户名或邮箱');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || '如账号存在，我们已发送重置邮件。');
      } else {
        toast.error(data.error || '发送重置邮件失败');
      }
    } catch (error) {
      toast.error('发送重置邮件失败');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('已退出登录');
      onAuthChange(false);
      setCurrentUser(null);
    } catch (error) {
      toast.error('退出失败');
    }
  };

  const handleLoginDialogChange = (open: boolean) => {
    setIsLoginOpen(open);
    if (!open) {
      setShowForgotPassword(false);
      setForgotIdentifier('');
      setCaptchaLayerOpen(false);
      pendingCredentialsRef.current = null;
    }
  };

  return (
    <nav className="navbar sticky top-0 z-50 border-b border-blue-900/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-3">
              <Swords className="h-8 w-8 text-yellow-400" />
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                MirDKP
              </h1>
            </Link>

            {isAdmin && teams.length > 0 && (
              <Select value={selectedTeam} onValueChange={onTeamChange}>
                <SelectTrigger className="w-[200px] bg-slate-800/50 border-blue-900 text-gray-200">
                  <SelectValue placeholder="选择团队" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-blue-900">
                  {teams.map((team) => (
                    <SelectItem
                      key={team.id}
                      value={team.id}
                      className="hover:bg-blue-950 text-gray-200"
                    >
                      {team.serverName && team.guildName
                        ? `${team.serverName} / ${team.guildName} / ${team.name}`
                        : team.name}{' '}
                      {isAdmin && team._count ? `(${team._count.players}人)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {isAdmin ? (
              <>
                <div className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/50">
                  <Shield className="h-4 w-4 text-green-400" />
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <User className="h-3 w-3 text-green-400" />
                      <span className="text-sm text-green-400 font-semibold">
                        {currentUser?.username || '管理员'}
                      </span>
                    </div>
                    {currentUser?.role === 'super_admin' && (
                      <span className="text-xs text-yellow-400">超级管理员</span>
                    )}
                  </div>
                </div>
                <ChangePasswordDialog />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="border-red-700 text-red-400 hover:bg-red-950 btn-glow"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出
                </Button>
              </>
            ) : (
              <Dialog open={isLoginOpen} onOpenChange={handleLoginDialogChange}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 btn-glow"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    管理员登录
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="bg-slate-800 border-blue-900"
                  onInteractOutside={(event) => event.preventDefault()}
                  onEscapeKeyDown={(event) => {
                    if (loading || captchaLayerOpen || captchaOpening) {
                      event.preventDefault();
                    }
                  }}
                >
                  <DialogHeader>
                    <DialogTitle className="text-gray-100 flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-blue-400" />
                      <span>管理员登录</span>
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="username" className="text-gray-300">用户名</Label>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="请输入用户名"
                        required
                        className="bg-slate-900/50 border-blue-900 text-gray-200"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-gray-300">密码</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="请输入密码"
                        required
                        className="bg-slate-900/50 border-blue-900 text-gray-200"
                      />
                    </div>

                    {loginCaptchaConfig.required && (
                      <div className="rounded border border-blue-800/60 bg-blue-950/30 px-3 py-2 text-xs text-blue-200">
                        已启用 ESA 拼图验证码，点击登录后会先完成验证。
                      </div>
                    )}
                    {loginCaptchaConfig.required && !loginCaptchaConfig.configured && (
                      <div className="rounded border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                        当前已启用验证码，但环境变量未完整配置（需 ESA_AI_CAPTCHA_IDENTITY / SCENE_ID /
                        REGION）。
                      </div>
                    )}
                    {loginCaptchaConfig.emergencyBypass && (
                      <div className="rounded border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                        紧急恢复开关已启用，当前管理员登录不要求验证码。
                      </div>
                    )}

                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto p-0 text-sm text-blue-300 hover:text-blue-200 hover:bg-transparent"
                        onClick={() => setShowForgotPassword((prev) => !prev)}
                      >
                        {showForgotPassword ? '收起密码找回' : '忘记密码？'}
                      </Button>

                      {showForgotPassword && (
                        <div className="space-y-2 rounded border border-slate-700 bg-slate-900/40 p-3">
                          <Label htmlFor="forgotIdentifier" className="text-gray-300">找回密码</Label>
                          <Input
                            id="forgotIdentifier"
                            value={forgotIdentifier}
                            onChange={(e) => setForgotIdentifier(e.target.value)}
                            placeholder="输入用户名或邮箱"
                            className="bg-slate-900/50 border-blue-900 text-gray-200"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full border-blue-700 text-blue-300 hover:bg-blue-950"
                            onClick={handleForgotPassword}
                            disabled={forgotLoading}
                          >
                            {forgotLoading ? '发送中...' : '发送重置邮件'}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div id={CAPTCHA_ELEMENT_ID} className="hidden" aria-hidden="true" />
                    <button
                      id={CAPTCHA_TRIGGER_ID}
                      type="button"
                      tabIndex={-1}
                      className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden"
                      aria-hidden="true"
                    >
                      captcha trigger
                    </button>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      disabled={loading || captchaOpening || captchaConfigLoading}
                    >
                      {loading
                        ? '登录中...'
                        : captchaOpening
                          ? '拉起验证码中...'
                          : loginCaptchaConfig.required
                            ? '验证并登录'
                            : '登录'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
