import apiClient from './apiClient';

class EmergencyContactService {
  /**
   * Get all emergency contacts
   */
  async getContacts() {
    const response = await apiClient.get('/emergency-contacts');
    return response.data?.data || [];
  }

  /**
   * Add a new emergency contact
   */
  async addContact({ name, phoneNumber, relationship = 'Emergency Contact', isPrimary = true }) {
    const response = await apiClient.post('/emergency-contacts', {
      name,
      phone_number: phoneNumber,
      relationship,
      is_primary: isPrimary,
    });
    return response.data?.data;
  }

  /**
   * Delete an emergency contact
   */
  async deleteContact(contactId) {
    const response = await apiClient.delete(`/emergency-contacts/${contactId}`);
    return response.data;
  }
}

export default new EmergencyContactService();
