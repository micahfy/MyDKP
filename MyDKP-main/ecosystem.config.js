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
        DATABASE_URL: 'file:/var/www/MyDKP/MyDKP-main/data.db',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
    },
  ],
};
