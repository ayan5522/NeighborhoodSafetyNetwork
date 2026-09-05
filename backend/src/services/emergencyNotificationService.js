const logger = require('../utils/logger');

/**
 * Module 4: Emergency Notification Service (Development / Mock Engine)
 * Prepares the architecture for emergency contact SMS alerts.
 * Clearly labeled as development/mock engine without false claims.
 */
class EmergencyNotificationService {
  /**
   * Send mock emergency notification to emergency contact
   */
  async notifyEmergencyContact({ contactName, phoneNumber, userFullName, locationText, coordinates, eventType = 'PERSONAL_SOS' }) {
    const timestamp = new Date().toISOString();
    const alertMessage = eventType === 'PERSONAL_SOS'
      ? `🚨 EMERGENCY ALERT: ${userFullName || 'A resident'} has triggered a Personal SOS near ${locationText || 'your registered area'}.`
      : `⚠️ SAFETY ALERT: Serious incident reported near ${locationText || 'your area'}.`;

    // Formatted development console inspector
    console.log('\n================== [EMERGENCY CONTACT NOTIFICATION (DEV MOCK)] ==================');
    console.log(`📡 Channel:     DEV MOCK SMS / ALERT`);
    console.log(`🎯 Recipient:   ${contactName} (${phoneNumber})`);
    console.log(`👤 User:        ${userFullName || 'Resident'}`);
    console.log(`🚨 Event:       ${eventType}`);
    console.log(`📍 Location:    ${locationText} (Lat: ${coordinates?.latitude?.toFixed?.(4) || 'N/A'}, Lon: ${coordinates?.longitude?.toFixed?.(4) || 'N/A'})`);
    console.log(`💬 Content:     ${alertMessage}`);
    console.log(`⏳ Timestamp:   ${timestamp}`);
    console.log('==================================================================================\n');

    logger.info(`[Dev Emergency Notification] Sent mock alert to ${phoneNumber} (${contactName}) for event ${eventType}`);

    return {
      success: true,
      delivered: true,
      mock: true,
      recipient: {
        name: contactName,
        phone_number: phoneNumber,
      },
      message: alertMessage,
      timestamp,
    };
  }
}

module.exports = new EmergencyNotificationService();
