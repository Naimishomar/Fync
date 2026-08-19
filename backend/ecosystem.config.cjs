/**
 * PM2 configuration, sized for a t3.micro (2 vCPU burstable, 1 GiB RAM).
 *
 *   pm2 start ecosystem.config.cjs --env production
 *
 * WHY ONE INSTANCE
 *
 * The codebase is written for cluster mode -- the Redis adapter for broadcasts,
 * NODE_APP_INSTANCE guards so only worker 0 runs the crons. That is correct on a
 * larger box. It is the wrong choice here for two reasons:
 *
 *   Memory. Each Node worker costs ~70-90 MB of RSS before serving anything,
 *   plus its own Mongo pool and Redis connections. Two workers spend roughly a
 *   fifth of the machine's total RAM on duplication.
 *
 *   CPU. t3.micro sustains 10% of 2 vCPUs -- about 0.2 of a core -- before it
 *   starts draining burst credits. There is no second core to parallelise onto,
 *   so a second worker adds context switching and no throughput.
 *
 * Raise `instances` when the instance actually has cores to use.
 */

module.exports = {
  apps: [
    {
      name: 'fync-api',
      script: 'index.js',

      // See above. One worker, one Mongo pool, one set of crons.
      instances: 1,
      exec_mode: 'fork',

      // Node sizes its heap from total system memory, which on a 1 GiB box
      // lands near 500 MB -- high enough that the kernel OOM-killer can fire
      // before V8 decides a major GC is worthwhile. Capping below the physical
      // limit makes V8 collect under pressure instead of being killed.
      node_args: '--max-old-space-size=420',

      // Backstop for a leak: restart rather than let the box swap or die. This
      // is a safety net, not a strategy -- if it trips regularly, find the leak.
      max_memory_restart: '620M',

      // The app calls process.send('ready') once it is actually listening, so a
      // reload does not kill the running worker until the new one can serve.
      wait_ready: true,
      listen_timeout: 20000,
      kill_timeout: 10000,

      // A crash loop on a small box wastes the CPU credits the healthy process
      // needs. Back off instead of hammering.
      exp_backoff_restart_delay: 200,
      max_restarts: 10,
      min_uptime: 30000,

      merge_logs: true,
      time: true,

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        // Small pool: the box cannot run more than a couple of queries at once.
        MONGO_POOL_SIZE: '12',
        MONGO_MIN_POOL_SIZE: '2',
        // Behind one nginx/ALB hop. Wrong values here break per-user rate
        // limiting: too high trusts a client-supplied X-Forwarded-For.
        TRUST_PROXY_HOPS: '1',
        UV_THREADPOOL_SIZE: '4',
      },
    },
  ],
};
