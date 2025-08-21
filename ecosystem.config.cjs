module.exports = {
  apps: [
    {
      name: 'injury-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4000,
        DATA_DIR: process.env.DATA_DIR || './data',
        APP_VERSION: process.env.APP_VERSION || '0.1.0',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
      }
    }
  ]
}
