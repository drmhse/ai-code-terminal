import { SsoClient } from '@drmhse/sso-sdk';
import { authStorage } from '@/utils/auth-storage';

const ssoClient = new SsoClient({
  baseURL: import.meta.env.VITE_SSO_BASE_URL,
  token: authStorage.getToken() || undefined,
});

export default ssoClient;
