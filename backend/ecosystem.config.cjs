// .cjs extension is required: package.json sets "type": "module", so a .js
// file here is parsed as ESM and `module.exports` throws when PM2 loads it.
module.exports = {
  apps: [
    {
      name: 'fync-backend',
      script: 'index.js',
      // 'max' spawns one worker per core. On a 2 GB instance two workers at the
      // old 1G restart ceiling could reach the box's entire RAM before PM2 ever
      // recycled one. Sized from env so a bigger instance can scale up without
      // editing this file.
      instances: Number(process.env.WEB_CONCURRENCY || 2),
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',

      // Zero-downtime reloads: PM2 waits for the 'ready' signal and gives the
      // old worker time to drain in-flight requests instead of cutting sockets.
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 10000,

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
