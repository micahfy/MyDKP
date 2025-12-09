'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h2 className="text-2xl font-bold">页面加载出错</h2>
        <p className="text-sm text-gray-400">
          系统遇到了一些问题，请重试。如果问题持续存在，请联系管理员。
        </p>
        {error?.message && (
          <p className="text-xs text-red-300 break-words">错误信息：{error.message}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white"
          >
            重试
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
}
