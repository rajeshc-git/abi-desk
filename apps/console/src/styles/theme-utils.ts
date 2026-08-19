export interface ThemePreset {
  name: string;
  hex: string;
  hover: string;
  surface: string;
  border: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Blue (Default)',
    hex: '#2563eb',
    hover: '#1d4ed8',
    surface: '#eff6ff',
    border: '#bfdbfe',
  },
  {
    name: 'Freshdesk Teal',
    hex: '#0d9488',
    hover: '#0f766e',
    surface: '#f0fdf4',
    border: '#99f6e4',
  },
  {
    name: 'Zendesk Emerald',
    hex: '#059669',
    hover: '#047857',
    surface: '#ecfdf5',
    border: '#a7f3d0',
  },
  {
    name: 'Royal Indigo',
    hex: '#4f46e5',
    hover: '#4338ca',
    surface: '#eef2ff',
    border: '#c7d2fe',
  },
  {
    name: 'Purple Slate',
    hex: '#7c3aed',
    hover: '#6d28d9',
    surface: '#f3e8ff',
    border: '#d8b4fe',
  },
  {
    name: 'Crimson Red',
    hex: '#dc2626',
    hover: '#b91c1c',
    surface: '#fef2f2',
    border: '#fecaca',
  },
  {
    name: 'Sunset Amber',
    hex: '#d97706',
    hover: '#b45309',
    surface: '#fffbeb',
    border: '#fde68a',
  },
  {
    name: 'Midnight Black',
    hex: '#09090b',
    hover: '#000000',
    surface: '#f4f4f5',
    border: '#d4d4d8',
  },
  {
    name: 'Carbon Dark',
    hex: '#27272a',
    hover: '#18181b',
    surface: '#f4f4f5',
    border: '#e4e4e7',
  },
];

export function applyPrimaryTheme(hexColor: string) {
  const root = document.documentElement;
  const match = THEME_PRESETS.find((p) => p.hex.toLowerCase() === hexColor.toLowerCase());

  const primary = match ? match.hex : hexColor;
  const hover = match ? match.hover : hexColor;
  const surface = match ? match.surface : `${hexColor}15`;
  const border = match ? match.border : `${hexColor}40`;

  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-hover', hover);
  root.style.setProperty('--primary-surface', surface);
  root.style.setProperty('--primary-border', border);

  localStorage.setItem('abidesk_theme_color', primary);
}

export function initThemeFromStorage() {
  const token = localStorage.getItem('abidesk_token');
  const saved = localStorage.getItem('abidesk_theme_color');
  if (token && saved) {
    applyPrimaryTheme(saved);
  } else {
    applyPrimaryTheme('#2563eb');
  }
}
