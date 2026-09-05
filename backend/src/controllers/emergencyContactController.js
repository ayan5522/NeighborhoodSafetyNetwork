const emergencyContactService = require('../services/emergencyContactService');
const { validateEmergencyContact } = require('../validators/emergencyContactValidators');
const { validateUUID } = require('../validators/alertValidators');

class EmergencyContactController {
  /**
   * POST /api/emergency-contacts
   * Add a new emergency contact
   */
  async addContact(req, res, next) {
    try {
      const validation = validateEmergencyContact(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          errors: validation.errors,
        });
      }

      const { name, phone_number, relationship, is_primary } = req.body;

      const contact = await emergencyContactService.addEmergencyContact({
        userId: req.user.id,
        name,
        phoneNumber: phone_number,
        relationship,
        isPrimary: is_primary !== undefined ? Boolean(is_primary) : true,
      });

      return res.status(201).json({
        success: true,
        message: 'Emergency contact saved successfully.',
        data: contact,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/emergency-contacts
   * List emergency contacts for user
   */
  async getContacts(req, res, next) {
    try {
      const contacts = await emergencyContactService.getEmergencyContacts({
        userId: req.user.id,
      });

      return res.status(200).json({
        success: true,
        data: contacts,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/emergency-contacts/:id
   * Delete an emergency contact
   */
  async deleteContact(req, res, next) {
    try {
      const { id } = req.params;
      if (!validateUUID(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact ID format. Must be a valid UUID.',
        });
      }

      const deleted = await emergencyContactService.deleteEmergencyContact({
        contactId: id,
        userId: req.user.id,
      });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Emergency contact not found.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Emergency contact deleted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EmergencyContactController();
