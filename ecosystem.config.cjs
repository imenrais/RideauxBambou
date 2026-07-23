/**
 * PM2 process file for Hostinger VPS.
 * Start: pm2 start ecosystem.config.cjs
 * Reload after deploy: pm2 reload rideaux-bamboux
 */
module.exports = {
  apps: [
    {
      name: "rideaux-bamboux",
      script: "server.js",
      cwd: "./.next/standalone",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
      max_memory_restart: "750M",
      time: true,
    },
  ],
};
