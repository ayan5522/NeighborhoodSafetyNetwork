const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');
const logger = require('./utils/logger');

async function startServer() {
  try {
    logger.info(`Checking PostgreSQL database connectivity...`);
    const dbStatus = await db.testConnection();
    logger.info(`✅ Database connected successfully. Timestamp: ${dbStatus.timestamp}`);

    const server = app.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 ${env.APP_NAME} API Server Running`);
      logger.info(`📡 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 Listening on: http://localhost:${env.PORT}`);
      logger.info(`📋 API Base URL: http://localhost:${env.PORT}/api`);
      logger.info(`🔑 Email OTP Provider: ${env.EMAIL_OTP_PROVIDER}`);
      logger.info(`📱 SMS OTP Provider:   ${env.SMS_OTP_PROVIDER}`);
      logger.info(`=======================================================`);
    });

    // Graceful Shutdown
    const handleShutdown = async (signal) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await db.pool.end();
        logger.info('Database pool closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
