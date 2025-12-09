'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-slate-900 text-gray-100 flex items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-bold">系统错误</h2>
          <p className="text-sm text-gray-400">
            页面加载失败，请重试或刷新。如果持续异常，请联系管理员。
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
              刷新
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
