/**
 * Module 4: Personal SOS Event Status Constants
 */
const SOS_STATUS = {
  ACTIVE: 'ACTIVE',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
};

const VALID_SOS_STATUSES = Object.values(SOS_STATUS);

module.exports = {
  SOS_STATUS,
  VALID_SOS_STATUSES,
};
