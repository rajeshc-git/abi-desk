import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiClient } from '../api/client';
import { applyPrimaryTheme } from '../styles/theme-utils';

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  kind: 'STAFF' | 'CUSTOMER';
  roles: string[];
  tenantId: string;
  tenantName?: string;
  permissions?: string[];
  preferences?: {
    themeColor?: string | null;
  };
}

export interface Brand {
  id: string;
  name: string;
  primaryColor?: string;
  widgetConfig?: {
    publicKey: string;
    isActive: boolean;
    adminWidgetEnabled?: boolean;
  };
}

interface AuthContextType {
  user: UserSession | null;
  token: string | null;
  brands: Brand[];
  activeBrandId: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  requestRegisterOtp: (
    companyName: string,
    fullName: string,
    email: string,
    pass: string,
  ) => Promise<void>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<void>;
  acceptInvitation: (tokenVal: string, fullName: string, pass: string) => Promise<void>;
  logout: () => void;
  setActiveBrandId: (id: string) => void;
  hasRole: (role: string) => boolean;
  reloadBrands: () => Promise<void>;
  updatePersonalTheme: (color: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token') && urlParams.has('refresh')) {
      return null;
    }
    const saved = localStorage.getItem('abidesk_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('token') && urlParams.has('refresh')) {
      ApiClient.setAuth(null, null);
      ApiClient.setRefreshToken(null);
      return null;
    }
    return ApiClient.getAuthToken();
  });
  const [isInterceptingSso] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('token') && urlParams.has('refresh');
  });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrandId, setActiveBrandId] = useState<string | null>(() =>
    localStorage.getItem('abidesk_brand_id'),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
    };
    const onTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      const data = customEvent.detail;
      setToken(data.accessToken);
      if (data.user) {
        setUser((prev) => {
          const session: UserSession = {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.fullName,
            kind: data.user.kind,
            roles: data.roles || data.user.roles || prev?.roles || [],
            tenantId: data.tenantId || prev?.tenantId || '',
            tenantName: data.tenantName || prev?.tenantName,
            permissions: data.permissions || data.user.permissions || prev?.permissions || [],
            preferences: data.user.preferences || prev?.preferences,
          };
          localStorage.setItem('abidesk_user', JSON.stringify(session));
          return session;
        });
      }
    };
    window.addEventListener('abidesk_unauthorized', onUnauthorized);
    window.addEventListener('abidesk_token_refreshed', onTokenRefreshed);

    const interceptSsoTokens = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const urlRefresh = urlParams.get('refresh');

      if (urlToken && urlRefresh) {
        setIsLoading(true);
        try {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);

          ApiClient.setAuth(urlToken, '');
          ApiClient.setRefreshToken(urlRefresh);

          const res = await ApiClient.get<{
            user: { id: string; email: string; fullName: string; kind: 'STAFF' | 'CUSTOMER' };
            roles: string[];
            tenantId: string;
            tenantName?: string;
            permissions?: string[];
          }>('/auth/me');

          const session: UserSession = {
            id: res.user.id,
            email: res.user.email,
            fullName: res.user.fullName,
            kind: res.user.kind,
            roles: res.roles,
            tenantId: res.tenantId,
            tenantName: res.tenantName,
            permissions: res.permissions,
          };

          ApiClient.setAuth(urlToken, session.tenantId);
          setToken(urlToken);
          setUser(session);
          localStorage.setItem('abidesk_token', urlToken);
          localStorage.setItem('abidesk_user', JSON.stringify(session));
        } catch (err) {
          console.error('SSO initialization failed:', err);
          logout();
        } finally {
          setIsLoading(false);
        }
      }
    };

    interceptSsoTokens();

    return () => {
      window.removeEventListener('abidesk_unauthorized', onUnauthorized);
      window.removeEventListener('abidesk_token_refreshed', onTokenRefreshed);
    };
  }, []);

  useEffect(() => {
    if (token && user) {
      // Sync latest profile & preferences from database on boot
      ApiClient.get<{
        user: {
          id: string;
          email: string;
          fullName: string;
          kind: 'STAFF' | 'CUSTOMER';
          preferences?: { themeColor?: string | null };
        };
        roles: string[];
        tenantId: string;
        tenantName?: string;
        permissions: string[];
      }>('/auth/me')
        .then((meRes) => {
          setUser((prev) => {
            if (!prev) return null;
            const updated: UserSession = {
              ...prev,
              fullName: meRes.user.fullName,
              permissions: meRes.permissions,
              preferences: meRes.user.preferences,
            };
            localStorage.setItem('abidesk_user', JSON.stringify(updated));
            return updated;
          });
        })
        .catch(() => {});

      loadTenantBrands().finally(() => setIsLoading(false));
    } else if (!isInterceptingSso) {
      setIsLoading(false);
    }
  }, [token, isInterceptingSso]);

  // Synchronize effective theme color:
  // 1. If not authenticated -> strictly neutral platform theme (#2563eb)
  // 2. Personal user preference takes highest priority
  // 3. Active company brand primaryColor is fallback
  useEffect(() => {
    if (!token || !user) {
      applyPrimaryTheme('#2563eb');
      return;
    }

    const personalColor = user?.preferences?.themeColor;
    if (personalColor) {
      applyPrimaryTheme(personalColor);
      return;
    }

    if (brands.length > 0) {
      const active = brands.find((b) => b.id === activeBrandId) || brands[0];
      if (active?.primaryColor) {
        applyPrimaryTheme(active.primaryColor);
      }
    }
  }, [token, user?.id, user?.preferences?.themeColor, activeBrandId, brands]);

  const loadTenantBrands = async () => {
    try {
      const list = await ApiClient.get<Brand[]>('/admin/brands');
      setBrands(list || []);
      if (list?.length) {
        const exists = list.some((b) => b.id === activeBrandId);
        if (!exists) {
          handleSetActiveBrand(list[0]!.id);
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleSetActiveBrand = (brandId: string) => {
    setActiveBrandId(brandId);
    localStorage.setItem('abidesk_brand_id', brandId);
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          fullName: string;
          kind: 'STAFF' | 'CUSTOMER';
        };
        roles: string[];
        tenantId: string;
        tenantName?: string;
        permissions: string[];
      }>('/auth/login', { email, password: pass });

      ApiClient.setAuth(res.accessToken, res.tenantId);
      ApiClient.setRefreshToken(res.refreshToken);
      setToken(res.accessToken);

      // Fetch user profile and preferences from DB immediately upon login
      try {
        const meRes = await ApiClient.get<{
          user: {
            id: string;
            email: string;
            fullName: string;
            kind: 'STAFF' | 'CUSTOMER';
            preferences?: { themeColor?: string | null };
          };
          roles: string[];
          tenantId: string;
          tenantName?: string;
          permissions: string[];
        }>('/auth/me');

        const session: UserSession = {
          id: meRes.user.id,
          email: meRes.user.email,
          fullName: meRes.user.fullName,
          kind: meRes.user.kind,
          roles: meRes.roles,
          tenantId: meRes.tenantId,
          tenantName: meRes.tenantName,
          permissions: meRes.permissions,
          preferences: meRes.user.preferences,
        };
        setUser(session);
        localStorage.setItem('abidesk_user', JSON.stringify(session));

        if (session.preferences?.themeColor) {
          applyPrimaryTheme(session.preferences.themeColor);
        }
      } catch {
        const session: UserSession = {
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName,
          kind: res.user.kind,
          roles: res.roles,
          tenantId: res.tenantId,
          tenantName: res.tenantName,
          permissions: res.permissions,
        };
        setUser(session);
        localStorage.setItem('abidesk_user', JSON.stringify(session));
      }

      await loadTenantBrands();
    } finally {
      setIsLoading(false);
    }
  };

  const requestRegisterOtp = async (
    companyName: string,
    fullName: string,
    email: string,
    pass: string,
  ) => {
    setIsLoading(true);
    try {
      await ApiClient.post('/auth/register/request-otp', {
        companyName,
        fullName,
        email,
        password: pass,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyRegisterOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          fullName: string;
          kind: 'STAFF' | 'CUSTOMER';
        };
        roles: string[];
        tenantId: string;
        tenantName?: string;
        permissions: string[];
      }>('/auth/register/verify-otp', {
        email,
        otp,
      });

      const session: UserSession = {
        id: res.user.id,
        email: res.user.email,
        fullName: res.user.fullName,
        kind: res.user.kind,
        roles: res.roles,
        tenantId: res.tenantId,
        tenantName: res.tenantName,
        permissions: res.permissions,
      };

      ApiClient.setAuth(res.accessToken, session.tenantId);
      ApiClient.setRefreshToken(res.refreshToken);
      setToken(res.accessToken);
      setUser(session);
      localStorage.setItem('abidesk_user', JSON.stringify(session));

      await loadTenantBrands();
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitation = async (tokenVal: string, fullName: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await ApiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          email: string;
          fullName: string;
          kind: 'STAFF' | 'CUSTOMER';
        };
        roles: string[];
        tenantId: string;
        tenantName?: string;
        permissions: string[];
      }>('/auth/invitations/accept', {
        token: tokenVal,
        fullName,
        password: pass,
      });

      const session: UserSession = {
        id: res.user.id,
        email: res.user.email,
        fullName: res.user.fullName,
        kind: res.user.kind,
        roles: res.roles,
        tenantId: res.tenantId,
        tenantName: res.tenantName,
        permissions: res.permissions,
      };

      ApiClient.setAuth(res.accessToken, session.tenantId);
      ApiClient.setRefreshToken(res.refreshToken);
      setToken(res.accessToken);
      setUser(session);
      localStorage.setItem('abidesk_user', JSON.stringify(session));

      await loadTenantBrands();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    ApiClient.setAuth(null, null);
    ApiClient.setRefreshToken(null);
    setToken(null);
    setUser(null);
    setBrands([]);
    setActiveBrandId(null);
    localStorage.removeItem('abidesk_user');
    localStorage.removeItem('abidesk_brand_id');
    localStorage.removeItem('abidesk_theme_color');
    applyPrimaryTheme('#2563eb');
  };

  const hasRole = (role: string) => {
    if (!user) return false;
    return (
      user.roles.includes(role) ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('TENANT_ADMIN')
    );
  };

  const updatePersonalTheme = async (color: string | null) => {
    try {
      const res = await ApiClient.patch<{ preferences: { themeColor?: string | null } }>(
        '/auth/me/preferences',
        { themeColor: color },
      );

      setUser((prev) => {
        if (!prev) return null;
        const updated: UserSession = {
          ...prev,
          preferences: res.preferences,
        };
        localStorage.setItem('abidesk_user', JSON.stringify(updated));
        return updated;
      });

      if (color) {
        applyPrimaryTheme(color);
      } else {
        const active = brands.find((b) => b.id === activeBrandId) || brands[0];
        applyPrimaryTheme(active?.primaryColor || '#0284c7');
      }
    } catch (err) {
      console.error('Failed to update personal theme preference:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        brands,
        activeBrandId,
        isLoading,
        login,
        requestRegisterOtp,
        verifyRegisterOtp,
        acceptInvitation,
        logout,
        setActiveBrandId: handleSetActiveBrand,
        hasRole,
        reloadBrands: loadTenantBrands,
        updatePersonalTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
