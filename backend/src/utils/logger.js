const env = require('../config/env');

const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, Object.keys(meta).length ? meta : '');
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, Object.keys(meta).length ? meta : '');
  },
  error: (message, error = null) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, error ? (error.stack || error.message || error) : '');
  },
  devOTP: (channel, recipient, otp, purpose) => {
    if (env.NODE_ENV !== 'production') {
      console.log(`\n================== [DEV OTP INSPECTOR] ==================`);
      console.log(`📡 Channel:   ${channel}`);
      console.log(`🎯 Recipient: ${recipient}`);
      console.log(`🔑 OTP Code:  ${otp}`);
      console.log(`📋 Purpose:   ${purpose}`);
      console.log(`⏳ Expires:   ${env.OTP_EXPIRY_MINUTES} minutes`);
      console.log(`=========================================================\n`);
    }
  },
};

module.exports = logger;
