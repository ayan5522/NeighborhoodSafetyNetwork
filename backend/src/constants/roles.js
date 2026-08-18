const ROLES = Object.freeze({
  RESIDENT: 'resident',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
});

const ALL_ROLES = Object.values(ROLES);

module.exports = {
  ROLES,
  ALL_ROLES,
};
