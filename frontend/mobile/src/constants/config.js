import { Platform } from 'react-native';

// Standard Android emulator uses 10.0.2.2 to access host machine; iOS uses localhost
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const CONFIG = {
  API_BASE_URL: `http://${DEV_HOST}:5000/api`,
  TOKEN_KEY: 'neighborhood_safety_jwt_token',
  USER_KEY: 'neighborhood_safety_user_profile',
  OTP_LENGTH: 6,
  COOLDOWN_SECONDS: 60,
};
