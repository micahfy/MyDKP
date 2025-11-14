module.exports = {
  apps: [
    {
      name: 'dkp-manager',
      cwd: '/var/www/MyDKP/MyDKP-main',
      script: 'node',
      args: '.next/standalone/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        // 关键：指定数据库路径（使用绝对路径）
        DATABASE_URL: 'file:/var/www/MyDKP/MyDKP-main/prisma/prod.db',
        // 从 .env 文件读取其他环境变量
        SESSION_SECRET: process.env.SESSION_SECRET,
        ADMIN_USERNAME: process.env.ADMIN_USERNAME,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // 添加日志输出
      combine_logs: true,
      // 等待应用启动
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};