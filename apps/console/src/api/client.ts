export function formatUserFriendlyError(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  let rawMsg = '';
  if (typeof error === 'string') {
    rawMsg = error;
  } else if (Array.isArray(error)) {
    rawMsg = error.join(', ');
  } else if (typeof error === 'object') {
    rawMsg = Array.isArray(error.message)
      ? error.message.join(', ')
      : error.message || error.detail || error.title || String(error);
  } else {
    rawMsg = String(error);
  }

  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('already exists') ||
    lower.includes('duplicate') ||
    lower.includes('409') ||
    lower.includes('p2002')
  ) {
    return 'An account or organization with this email address already exists. Please sign in instead.';
  }
  if (
    lower.includes('invalid email or password') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return 'Invalid email address or password. Please verify your credentials.';
  }
  if (
    lower.includes('cannot post') ||
    lower.includes('cannot get') ||
    lower.includes('cannot patch') ||
    lower.includes('cannot delete')
  ) {
    return 'The requested service is initializing. Please try again in a moment.';
  }
  if (
    lower.includes('no active sso provider') ||
    lower.includes('sso provider') ||
    lower.includes('authorized for this sso')
  ) {
    return rawMsg;
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return 'The requested resource was not found.';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('econnrefused')
  ) {
    return 'Unable to reach the server. Please check your network connection.';
  }
  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'The server encountered an issue processing your request. Please try again.';
  }

  // If the error message is clean and readable, return it directly!
  if (
    rawMsg &&
    !rawMsg.includes('Prisma') &&
    !rawMsg.includes('Postgres') &&
    !rawMsg.includes('Fastify') &&
    !rawMsg.includes('/api/v1') &&
    !rawMsg.includes('Cannot ')
  ) {
    return rawMsg;
  }

  return 'Unable to process request at this time. Please try again.';
}

export class ApiClient {
  private static token: string | null = localStorage.getItem('abidesk_token');
  private static refreshToken: string | null = localStorage.getItem('abidesk_refresh_token');
  private static tenantId: string | null = localStorage.getItem('abidesk_tenant_id');
  private static refreshPromise: Promise<string | null> | null = null;

  static setAuth(token: string | null, tenantId?: string | null) {
    this.token = token;
    if (token) localStorage.setItem('abidesk_token', token);
    else localStorage.removeItem('abidesk_token');

    if (tenantId !== undefined) {
      this.tenantId = tenantId;
      if (tenantId) localStorage.setItem('abidesk_tenant_id', tenantId);
      else localStorage.removeItem('abidesk_tenant_id');
    }
  }

  static setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
    if (refreshToken) localStorage.setItem('abidesk_refresh_token', refreshToken);
    else localStorage.removeItem('abidesk_refresh_token');
  }

  static getRefreshToken(): string | null {
    return this.refreshToken;
  }

  static getAuthToken(): string | null {
    return this.token;
  }

  static getTenantId(): string | null {
    return this.tenantId;
  }

  private static getTokenExpiration(token: string): number | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      return payload.exp || null;
    } catch {
      return null;
    }
  }

  static async getValidToken(): Promise<string | null> {
    if (!this.token) return null;

    const exp = this.getTokenExpiration(this.token);
    if (!exp) return this.token;

    const now = Date.now();
    const expiryTime = exp * 1000;
    // Refresh if expiring in less than 3 minutes to be safe
    if (expiryTime - now > 180 * 1000) {
      return this.token;
    }

    const storedRefresh = this.getRefreshToken();
    if (!storedRefresh) return this.token;

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.tenantId ? { 'x-abidesk-tenant': this.tenantId } : {}),
          },
          body: JSON.stringify({
            refreshToken: storedRefresh,
            sessionMode: 'token',
          }),
        });

        if (!response.ok) {
          throw new Error('Refresh endpoint rejected token');
        }

        const data = await response.json();
        this.setAuth(data.accessToken, data.tenantId);
        this.setRefreshToken(data.refreshToken);

        window.dispatchEvent(new CustomEvent('abidesk_token_refreshed', { detail: data }));
        return data.accessToken;
      } catch (err) {
        console.error('⚡ Silent token refresh failed:', err);
        this.setAuth(null);
        this.setRefreshToken(null);
        window.dispatchEvent(new Event('abidesk_unauthorized'));
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  static async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const validToken = await this.getValidToken();
    if (validToken) {
      headers['Authorization'] = `Bearer ${validToken}`;
    }

    if (this.tenantId) {
      headers['x-abidesk-tenant'] = this.tenantId;
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `/api/v1${cleanPath}`;

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      throw new Error(formatUserFriendlyError(networkErr));
    }

    if (res.status === 401) {
      this.setAuth(null);
      this.setRefreshToken(null);
      window.dispatchEvent(new Event('abidesk_unauthorized'));
    }

    if (!res.ok) {
      let errorMsg: any = `HTTP Error ${res.status}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson.message || errorJson.detail || errorJson.title || errorMsg;
      } catch {
        errorMsg = await res.text();
      }
      throw new Error(formatUserFriendlyError(errorMsg));
    }

    if (res.status === 204) return null as T;

    const contentType = res.headers.get('Content-Type');
    if (contentType && (contentType.includes('text/csv') || contentType.includes('text/plain'))) {
      return res.text() as any;
    }

    return res.json();
  }

  static get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
    let url = path;
    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
      });
      const qs = query.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  static post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  static patch<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  static delete<T = any>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
