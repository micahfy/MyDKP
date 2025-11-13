module.exports = {
  apps: [
    {
      name: 'dkp-manager',
      cwd: '/var/www/MyDKP/MyDKP-main',   // 改成你的实际目录
      script: 'npm',
      args: 'run start',                 // 生产模式执行 next start
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
