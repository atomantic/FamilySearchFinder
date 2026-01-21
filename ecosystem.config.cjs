// =============================================================================
// Port Configuration - All ports defined here as single source of truth
// =============================================================================
const PORTS = {
  API: 6374,    // Express API server
  UI: 6373,     // Vite dev server (client)
  CDP: 9920     // Chrome DevTools Protocol port for browser automation
};

module.exports = {
  PORTS, // Export for other configs to reference

  apps: [
    {
      name: 'fsf-server',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: `${__dirname}/server`,
      interpreter: 'node',
      env: {
        NODE_ENV: 'development',
        PORT: PORTS.API,
        HOST: '0.0.0.0',
        CDP_PORT: PORTS.CDP
      },
      watch: false
    },
    {
      name: 'fsf-ui',
      script: 'node_modules/.bin/vite',
      cwd: `${__dirname}/client`,
      args: `--host 0.0.0.0 --port ${PORTS.UI}`,
      env: {
        NODE_ENV: 'development',
        VITE_PORT: PORTS.UI
      },
      watch: false
    },
    {
      name: 'fsf-browser',
      script: '.browser/start.sh',
      cwd: __dirname,
      interpreter: 'bash',
      autorestart: false,
      env: {
        CDP_PORT: PORTS.CDP
      }
    }
  ]
};
