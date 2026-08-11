module.exports = {
  apps: [
    { name: "smslocal-bss-web", script: "node_modules/.bin/next", args: "start -p 3001",
      cwd: "/var/www/v2-smslocal-bss", exec_mode: "fork", instances: 1,
      env: { NODE_ENV: "production", PORT: 3001 }, autorestart: true, max_restarts: 20, restart_delay: 5000 },
    { name: "smpp-daemon", script: "src/workers/smpp-daemon.ts", interpreter: "./node_modules/.bin/tsx",
      cwd: "/var/www/v2-smslocal-bss", exec_mode: "fork", instances: 1,
      env: { NODE_ENV: "production" }, autorestart: true, max_restarts: 50, restart_delay: 10000, kill_timeout: 5000 },
    { name: "smpp-server", script: "src/workers/smpp-server.ts", interpreter: "./node_modules/.bin/tsx",
      cwd: "/var/www/v2-smslocal-bss", exec_mode: "fork", instances: 1,
      env: { NODE_ENV: "production", SMPP_PORT: 2775 }, autorestart: true, max_restarts: 50, restart_delay: 5000, kill_timeout: 5000 },
  ],
};
