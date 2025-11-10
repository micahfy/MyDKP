module.exports = {
  apps: [{
    name: 'dkp-manager',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 1, // 单核VPS使用1个实例
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 自动重启配置
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // 优雅关闭
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // 性能监控
    instance_var: 'INSTANCE_ID',
  }]
};