module.exports = {
  apps: [
    {
      name: 'fync-backend',
      script: 'index.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Error recovery
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
    },
  ],
};
