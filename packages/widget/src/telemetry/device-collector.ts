export interface DeviceDiagnostics {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  colorDepth: number;
  language: string;
  timezone: string;
  online: boolean;
  pageUrl: string;
  pageTitle: string;
  referrer: string;
}

export function collectDeviceDiagnostics(): DeviceDiagnostics {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  let browserName = 'Unknown';
  let browserVersion = 'Unknown';

  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr\//i.test(ua)) {
    browserName = 'Chrome';
    const match = ua.match(/(?:chrome|crios)\/([0-9.]+)/i);
    browserVersion = match?.[1] ?? 'Unknown';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browserName = 'Safari';
    const match = ua.match(/version\/([0-9.]+)/i);
    browserVersion = match?.[1] ?? 'Unknown';
  } else if (/firefox|fxios/i.test(ua)) {
    browserName = 'Firefox';
    const match = ua.match(/(?:firefox|fxios)\/([0-9.]+)/i);
    browserVersion = match?.[1] ?? 'Unknown';
  } else if (/edg/i.test(ua)) {
    browserName = 'Edge';
    const match = ua.match(/edg\/([0-9.]+)/i);
    browserVersion = match?.[1] ?? 'Unknown';
  }

  let osName = 'Unknown';
  let osVersion = 'Unknown';

  if (/windows/i.test(ua)) {
    osName = 'Windows';
    if (/windows nt 10.0/i.test(ua)) osVersion = '10 / 11';
    else if (/windows nt 6.3/i.test(ua)) osVersion = '8.1';
    else if (/windows nt 6.1/i.test(ua)) osVersion = '7';
  } else if (/macintosh|mac os x/i.test(ua)) {
    osName = 'macOS';
    const match = ua.match(/mac os x ([0-9_]+)/i);
    osVersion = match?.[1]?.replace(/_/g, '.') ?? 'Unknown';
  } else if (/android/i.test(ua)) {
    osName = 'Android';
    const match = ua.match(/android ([0-9.]+)/i);
    osVersion = match?.[1] ?? 'Unknown';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    osName = 'iOS';
    const match = ua.match(/os ([0-9_]+)/i);
    osVersion = match?.[1]?.replace(/_/g, '.') ?? 'Unknown';
  } else if (/linux/i.test(ua)) {
    osName = 'Linux';
  }

  const isMobile = /mobile|iphone|ipod|android.*mobile/i.test(ua);
  const isTablet = /tablet|ipad|android(?!.*mobile)/i.test(ua);
  const deviceType = isMobile ? 'MOBILE' : isTablet ? 'TABLET' : 'DESKTOP';

  return {
    userAgent: ua,
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceType,
    screenWidth: typeof window !== 'undefined' ? window.screen.width : 0,
    screenHeight: typeof window !== 'undefined' ? window.screen.height : 0,
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    colorDepth: typeof window !== 'undefined' ? window.screen.colorDepth : 24,
    language: typeof navigator !== 'undefined' ? navigator.language : 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    pageTitle: typeof document !== 'undefined' ? document.title : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
  };
}
