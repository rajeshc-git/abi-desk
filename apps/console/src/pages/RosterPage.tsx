import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Users,
  Grid,
  Settings,
  Layers,
  FileText,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Copy,
  CheckCircle,
  AlertTriangle,
  Printer,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  RotateCw,
  Share2,
  Shield,
  Info,
  Clock,
  Sparkles,
  Search,
  UserCheck,
  UserX,
  Package,
  Database,
  Check,
  Sun,
  Moon,
  X,
  CalendarDays,
  GripVertical,
  Monitor,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiClient } from '../api/client';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';

// Shift codes and metadata
export type ShiftCode = 'G' | 'M' | 'E' | 'OFF' | 'HOL' | 'L' | 'CO';

export const SHIFT_META: Record<ShiftCode, { label: string; desc: string; color: string; bg: string; border: string }> = {
  G: { label: 'General', desc: 'Standard business hours', color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' },
  M: { label: 'Morning', desc: '7:30 AM - 4:30 PM', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  E: { label: 'Evening', desc: '2:00 PM - 11:00 PM', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
  OFF: { label: 'Weekly Off', desc: 'Scheduled weekly off day', color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  HOL: { label: 'Holiday', desc: 'Company-wide holiday', color: '#be123c', bg: '#ffe4e6', border: '#fecdd3' },
  L: { label: 'Leave', desc: 'Approved planned/casual leave', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' },
  CO: { label: 'Comp-Off', desc: 'Compensatory off for weekend/duty', color: '#854d0e', bg: '#fef9c3', border: '#fef08a' },
};

export const CODES: ShiftCode[] = ['G', 'M', 'E', 'OFF', 'HOL', 'L', 'CO'];
export const WOV_SHIFTS: ShiftCode[] = ['M', 'G', 'E', 'OFF'];
export const GRADES = ['Senior', 'Junior', 'Permanent General Shift'] as const;
export const SHIFTS = ['General Shift', 'Morning Shift', 'Evening Shift'] as const;
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_SHIFT_TIMINGS: Record<string, string> = {
  'General Shift': '10:00 AM - 7:00 PM',
  'Morning Shift': '7:30 AM - 4:30 PM',
  'Evening Shift': '2:00 PM - 11:00 PM',
};

export function parseTo24h(str: string): string {
  if (!str) return '10:00';
  const clean = str.trim();
  const match = clean.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return '10:00';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

export function formatFrom24h(str: string): string {
  if (!str) return '10:00 AM';
  const [hStr, mStr] = str.split(':');
  let h = parseInt(hStr || '10', 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export function parseTimingRange(range: string): [string, string] {
  if (!range || !range.includes('-')) return ['10:00', '19:00'];
  const [start, end] = range.split('-');
  return [parseTo24h(start), parseTo24h(end)];
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  brandId?: string | null;
  brand?: { id: string; name: string } | null;
  description?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  shift: string;
  timing: string;
  grade: (typeof GRADES)[number];
}

export interface RotationConfig {
  morningPerDay: number;
  eveningPerDay: number;
  step: number;
  anchor: string;
  offDay: number;
  skeleton: number;
  maxDuty: number;
}

export interface LeaveEntry {
  id: string;
  memberId: string;
  from: string;
  to: string;
  reason: string;
}

export interface CompOffEntry {
  id: string;
  memberId: string;
  worked: string;
  co: string;
}

export interface WeekendDutyEntry {
  id: string;
  date: string;
  morningId: string;
  eveningId: string;
}

export interface WeekdayOverrideEntry {
  id: string;
  memberId: string;
  from: string;
  to: string;
  shift: ShiftCode;
  reason: string;
}

export interface ChangelogItem {
  at: string;
  revision: number;
  note: string;
}

export interface SavedRoster {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  createdAt: string;
  days: string[];
  members: { id: string; name: string; grade: string }[];
  grid: Record<string, ShiftCode[]>;
  edits: Record<string, ShiftCode>;
  editCount: number;
  status: 'Draft' | 'Published' | 'Revised';
  revision: number;
  sharedAt: string | null;
  changelog: ChangelogItem[];
  configSnap: RotationConfig;
}

export interface TeamData {
  id: string;
  name?: string;
  slug?: string;
  tier: string;
  productId: string | null;
  config: RotationConfig;
  members: TeamMember[];
  rotationOrder: string[];
  leaves: LeaveEntry[];
  comps: CompOffEntry[];
  weekendDuties: WeekendDutyEntry[];
  wov: WeekdayOverrideEntry[];
  rosters: SavedRoster[];
}

export interface GlobalHoliday {
  id: string;
  date: string;
  reason: string;
}

export interface RosterDB {
  products: Product[];
  tiers: string[];
  holidays: GlobalHoliday[];
  teams: TeamData[];
  activeTeamId: string;
}

// Helpers
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtISO = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};
const parseD = (s: string) => {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(y, m - 1, dd);
};
const eachDay = (a: Date, b: Date): Date[] => {
  const out: Date[] = [];
  const d = parseD(fmtISO(a));
  const e = parseD(fmtISO(b));
  while (d <= e) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
};
const weekIndex = (date: Date, anchor: string) => {
  return Math.floor((parseD(fmtISO(date)).getTime() - parseD(anchor).getTime()) / (7 * 864e5));
};
const nextWorkingDay = (iso: string, offDay: number, holidays: GlobalHoliday[]) => {
  const d = parseD(iso);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === Number(offDay) || holidays.some((h) => h.date === fmtISO(d)));
  return fmtISO(d);
};

const defaultConfig = (): RotationConfig => ({
  morningPerDay: 2,
  eveningPerDay: 2,
  step: 4,
  anchor: fmtISO(new Date()),
  offDay: 0, // Sunday
  skeleton: 1, // 1 = 1 M + 1 E skeleton coverage
  maxDuty: 2,
});

const emptyTeamData = (tier = 'L2', productId: string | null = null): TeamData => ({
  id: uid(),
  name: tier === 'L1' ? 'General Support' : `${tier} Support Team`,
  tier,
  productId,
  config: defaultConfig(),
  members: [],
  rotationOrder: [],
  leaves: [],
  comps: [],
  weekendDuties: [],
  wov: [],
  rosters: [],
});

const loadInitialHolidays = (): GlobalHoliday[] => {
  try {
    const raw = localStorage.getItem('abidesk_roster_holidays');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

const getCachedTeamConditions = (teamId: string) => {
  try {
    const raw = localStorage.getItem(`abidesk_team_conditions_${teamId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};

export function emptyInitialDB(): RosterDB {
  const l1 = emptyTeamData('L1', null);
  return {
    products: [],
    tiers: ['L1', 'L2', 'L3', 'DEV', 'QA'],
    holidays: loadInitialHolidays(),
    teams: [l1],
    activeTeamId: l1.id,
  };
}

export const RosterPage: React.FC = () => {
  const { user, brands } = useAuth();
  const toast = useToast();

  const canManage = Boolean(
    user?.roles?.some((r: string) => ['TENANT_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r)) ||
    user?.permissions?.includes('roster:manage')
  );

  const [db, setDb] = useState<RosterDB>(() => emptyInitialDB());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'generate' | 'teams' | 'members' | 'conditions' | 'history'
  >('generate');

  useEffect(() => {
    if (!canManage && ['teams', 'members'].includes(activeTab)) {
      setActiveTab('generate');
    }
  }, [canManage, activeTab]);

  // Generator inputs
  const [startDate, setStartDate] = useState('2026-09-05');
  const [endDate, setEndDate] = useState('2026-10-04');
  const [rosterTitle, setRosterTitle] = useState('Sep 2026');
  const [currentRoster, setCurrentRoster] = useState<SavedRoster | null>(null);

  // Add Product Modal state
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSlug, setNewProductSlug] = useState('');
  const [newProductBrandId, setNewProductBrandId] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Edit Product Modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editProductSlug, setEditProductSlug] = useState('');
  const [editProductBrandId, setEditProductBrandId] = useState('');
  const [editProductDesc, setEditProductDesc] = useState('');
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);

  // Multi-Member Condition Wizard Modal state
  const [conditionWizardType, setConditionWizardType] = useState<'wov' | 'leave' | 'comp' | null>(null);
  const [wizardSelectedMemberIds, setWizardSelectedMemberIds] = useState<string[]>([]);
  const [wizardMemberSearch, setWizardMemberSearch] = useState('');
  const [wizardFromDate, setWizardFromDate] = useState('2026-09-08');
  const [wizardToDate, setWizardToDate] = useState('2026-09-08');
  const [wizardShift, setWizardShift] = useState<ShiftCode>('M');
  const [wizardReason, setWizardReason] = useState('');
  const [wizardWorkedDate, setWizardWorkedDate] = useState('2026-09-08');
  const [wizardCoDate, setWizardCoDate] = useState('2026-09-08');

  // In-deck Search Filter (Filter overrides, leaves, comp-offs by staff name)
  const [conditionStaffFilter, setConditionStaffFilter] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Non-admin agents only see teams they are members of; admins see all organization teams
  const visibleTeams = useMemo(() => {
    if (canManage || !user) return db.teams;
    const myTeams = db.teams.filter((t) =>
      t.members.some(
        (m) =>
          m.id === user.id ||
          (user.fullName && m.name?.toLowerCase() === user.fullName.toLowerCase()) ||
          (user.email && m.name?.toLowerCase() === user.email.toLowerCase()),
      ),
    );
    return myTeams.length > 0 ? myTeams : db.teams;
  }, [db.teams, canManage, user]);

  const activeTeam = useMemo(() => {
    const list = visibleTeams.length > 0 ? visibleTeams : db.teams;
    return list.find((t) => t.id === db.activeTeamId) || list[0] || db.teams[0];
  }, [visibleTeams, db.teams, db.activeTeamId]);

  useEffect(() => {
    if (activeTeam && Array.isArray(activeTeam.rosters) && activeTeam.rosters.length > 0) {
      if (!currentRoster || !activeTeam.rosters.some((r) => r.id === currentRoster.id)) {
        const latest =
          activeTeam.rosters.slice().reverse().find((r) => r.status === 'Published' || r.status === 'Revised') ||
          activeTeam.rosters[activeTeam.rosters.length - 1];
        if (latest) {
          setCurrentRoster(latest);
        }
      }
    } else if (activeTeam && (!activeTeam.rosters || activeTeam.rosters.length === 0) && !canManage) {
      setCurrentRoster(null);
    }
  }, [activeTeam?.id, activeTeam?.rosters, canManage]);

  const productName = (id: string | null) => {
    if (!id) return 'Service Desk (Common)';
    const p = db.products.find((x) => x.id === id);
    return p ? p.name : 'Unknown Product';
  };

  const teamName = (t: TeamData) => {
    if (!t) return '—';
    if (t.name) return t.name;
    return t.tier === 'L1' ? 'General Support' : `${t.tier} · ${productName(t.productId)}`;
  };

  const [isSyncingToDb, setIsSyncingToDb] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  const syncTeamConfigToDb = async (teamId: string, team: TeamData, showToast = false) => {
    setIsSyncingToDb(true);
    try {
      await ApiClient.put(`/admin/roster/teams/${teamId}/config`, {
        morningPerDay: team.config.morningPerDay,
        eveningPerDay: team.config.eveningPerDay,
        step: team.config.step,
        anchorDate: team.config.anchor,
        offDay: team.config.offDay,
        skeleton: team.config.skeleton,
        maxDuty: team.config.maxDuty,
        rotationOrder: team.rotationOrder,
        leaves: team.leaves,
        comps: team.comps,
        weekendDuties: team.weekendDuties,
        weekdayOverrides: team.wov,
      });
      setLastSyncedAt(new Date());
      if (showToast) {
        toast.success('Team rules & configuration saved to PostgreSQL database');
      }
    } catch (e) {
      console.warn('Failed to sync team config to server', e);
      if (showToast) {
        toast.error('Failed to save team rules to database');
      }
    } finally {
      setIsSyncingToDb(false);
    }
  };

  const persistDB = (nextDB: RosterDB) => {
    setDb(nextDB);

    try {
      localStorage.setItem('abidesk_roster_holidays', JSON.stringify(nextDB.holidays));
      localStorage.setItem('abidesk_roster_active_team', nextDB.activeTeamId);
    } catch (e) {}

    const currentActive = nextDB.teams.find((t) => t.id === nextDB.activeTeamId);
    if (currentActive) {
      try {
        localStorage.setItem(
          `abidesk_team_conditions_${currentActive.id}`,
          JSON.stringify({
            leaves: currentActive.leaves,
            comps: currentActive.comps,
            weekendDuties: currentActive.weekendDuties,
            wov: currentActive.wov,
            config: currentActive.config,
            rotationOrder: currentActive.rotationOrder,
          }),
        );
      } catch (e) {}
      syncTeamConfigToDb(currentActive.id, currentActive);
    }
  };

  const [realStaffUsers, setRealStaffUsers] = useState<any[]>([]);

  const loadData = async (isMounted = true) => {
    try {
      const [users, liveBrands, liveTeams, liveRosters, liveProducts] = await Promise.all([
        ApiClient.get<any[]>('/admin/users').catch(() => []),
        ApiClient.get<any[]>('/admin/brands').catch(() => []),
        ApiClient.get<any[]>('/admin/teams').catch(() => []),
        ApiClient.get<any[]>('/admin/roster/rosters').catch(() => []),
        ApiClient.get<any[]>('/admin/roster/products').catch(() => []),
      ]);

      if (!isMounted) return;
      // Filter ONLY actual internal staff users (exclude external customers & guests)
      const staffList = Array.isArray(users)
        ? users.filter((u: any) => {
            if (u.kind === 'STAFF') return true;
            if (u.kind === 'CUSTOMER' || u.kind === 'SYSTEM') return false;
            if (Array.isArray(u.roles) && u.roles.length > 0) {
              return u.roles.some((r: any) => {
                const roleKey = typeof r === 'string' ? r : r.role?.key;
                return roleKey && roleKey !== 'CUSTOMER' && roleKey !== 'GUEST';
              });
            }
            return false;
          })
        : [];
      setRealStaffUsers(staffList);

      const products: Product[] = Array.isArray(liveProducts) ? liveProducts : [];

      let teams: TeamData[] = [];
      if (Array.isArray(liveTeams) && liveTeams.length > 0) {
        // Fetch server configs for each team in parallel
        const teamConfigs = await Promise.all(
          liveTeams.map(async (lt) => {
            try {
              const res = await ApiClient.get<any>(`/admin/roster/teams/${lt.id}/config`);
              return { teamId: lt.id, configData: res?.config };
            } catch (e) {
              return { teamId: lt.id, configData: null };
            }
          }),
        );

        const configMap = new Map(teamConfigs.map((c) => [c.teamId, c.configData]));

        teams = liveTeams.map((lt) => {
          const members: TeamMember[] = (lt.members || []).map((tm: any) => ({
            id: tm.user?.id || tm.id || uid(),
            name: tm.user?.fullName || tm.user?.displayName || tm.user?.email || 'Staff',
            shift: tm.defaultShift || 'General Shift',
            timing: tm.timing || '10:00 AM - 7:00 PM',
            grade: (tm.grade as any) || (tm.isLead ? 'Senior' : 'Junior'),
          }));

          const c = configMap.get(lt.id);
          const teamRosters = Array.isArray(liveRosters)
            ? liveRosters
                .filter((r) => r.teamId === lt.id)
                .map((r) => {
                  const sIso = typeof r.startDate === 'string' ? r.startDate.slice(0, 10) : fmtISO(new Date(r.startDate));
                  const eIso = typeof r.endDate === 'string' ? r.endDate.slice(0, 10) : fmtISO(new Date(r.endDate));
                  return {
                    id: r.id,
                    title: r.title,
                    startISO: sIso,
                    endISO: eIso,
                    createdAt: r.createdAt,
                    days: eachDay(parseD(sIso), parseD(eIso)).map(fmtISO),
                    members: members.map((m) => ({ id: m.id, name: m.name, grade: m.grade })),
                    grid: r.gridData || {},
                    edits: r.manualEdits || {},
                    editCount: Object.keys(r.manualEdits || {}).length,
                    status: (r.status === 'PUBLISHED' ? 'Published' : r.status === 'AMENDED' ? 'Revised' : 'Draft') as any,
                    revision: r.revision || 1,
                    sharedAt: r.publishedAt || null,
                    changelog: r.changelog || [],
                    configSnap: r.configSnap || defaultConfig(),
                  };
                })
            : [];

          const cached = getCachedTeamConditions(lt.id);

          return {
            id: lt.id,
            name: lt.name || (lt.tier === 'L1' ? 'General Support' : `${lt.tier || 'L1'} Support Team`),
            slug: lt.slug,
            tier: lt.tier || 'L1',
            productId: lt.brandId || lt.productId || null,
            config: c
              ? {
                  morningPerDay: c.morningPerDay ?? 2,
                  eveningPerDay: c.eveningPerDay ?? 2,
                  step: c.step ?? 4,
                  anchor: c.anchorDate ? String(c.anchorDate).slice(0, 10) : fmtISO(new Date()),
                  offDay: c.offDay ?? 0,
                  skeleton: c.skeleton ?? 1,
                  maxDuty: c.maxDuty ?? 2,
                }
              : (cached?.config || defaultConfig()),
            members,
            rotationOrder:
              Array.isArray(c?.rotationOrder) && c.rotationOrder.length > 0
                ? c.rotationOrder
                : (Array.isArray(cached?.rotationOrder) && cached.rotationOrder.length > 0
                    ? cached.rotationOrder
                    : members.map((m) => m.id)),
            leaves: Array.isArray(c?.leaves) ? c.leaves : (cached?.leaves || []),
            comps: Array.isArray(c?.comps) ? c.comps : (cached?.comps || []),
            weekendDuties: Array.isArray(c?.weekendDuties) ? c.weekendDuties : (cached?.weekendDuties || []),
            wov: Array.isArray(c?.weekdayOverrides) ? c.weekdayOverrides : (cached?.wov || []),
            rosters: teamRosters,
          };
        });
      } else {
        teams = [emptyTeamData('L1', null)];
      }

      const savedHolidays = loadInitialHolidays();
      if (!isMounted) return;

      const userTeams = !canManage && user
        ? teams.filter((t) =>
            t.members.some(
              (m) =>
                m.id === user.id ||
                (user.fullName && m.name?.toLowerCase() === user.fullName.toLowerCase()) ||
                (user.email && m.name?.toLowerCase() === user.email.toLowerCase()),
            ),
          )
        : teams;

      const fallbackTeamId = userTeams.length > 0 ? userTeams[0].id : teams[0]?.id;

      setDb((prevDb) => ({
        products,
        tiers: ['L1', 'L2', 'L3', 'DEV', 'QA'],
        holidays: savedHolidays.length > 0 ? savedHolidays : prevDb.holidays,
        teams,
        activeTeamId: teams.some((t) => t.id === prevDb.activeTeamId) ? prevDb.activeTeamId : fallbackTeamId,
      }));
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load roster initial data', err);
      if (isMounted) setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadData(isMounted);

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newProductName.trim();
    if (!cleanName) {
      toast.error('Product name is required');
      return;
    }
    // Auto-generate clean unique slug behind the scenes
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'product';
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    setIsSavingProduct(true);
    try {
      const created = await ApiClient.post<Product>('/admin/roster/products', {
        name: cleanName,
        slug,
        brandId: newProductBrandId || null,
        description: newProductDesc.trim() || undefined,
      });

      setDb((prev) => ({
        ...prev,
        products: [...prev.products.filter((p) => p.id !== created.id), created],
      }));
      toast.success(`Product "${created.name}" created successfully`);
      setIsAddProductModalOpen(false);
      setNewProductName('');
      setNewProductBrandId('');
      setNewProductDesc('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editProductName.trim();
    if (!editingProduct || !cleanName) {
      toast.error('Product name is required');
      return;
    }
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || editingProduct.slug;
    setIsUpdatingProduct(true);
    try {
      const updated = await ApiClient.patch<Product>(`/admin/roster/products/${editingProduct.id}`, {
        name: cleanName,
        slug,
        brandId: editProductBrandId || null,
        description: editProductDesc.trim() || undefined,
      });

      setDb((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === updated.id ? updated : p)),
      }));
      toast.success(`Product "${updated.name}" updated successfully`);
      setEditingProduct(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Are you sure you want to delete product "${p.name}" and all its mapped tier teams? This cannot be undone.`)) {
      return;
    }
    try {
      await ApiClient.delete(`/admin/roster/products/${p.id}`);
      setDb((prev) => ({
        ...prev,
        products: prev.products.filter((x) => x.id !== p.id),
        teams: prev.teams.filter((t) => t.productId !== p.id),
      }));
      toast.success(`Product "${p.name}" deleted`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    }
  };

  // Duty drag & drop state
  const [draggedDutyMemberId, setDraggedDutyMemberId] = useState<string | null>(null);
  const [dutyDropHover, setDutyDropHover] = useState<{ id: string; slot: 'morning' | 'evening' } | null>(null);

  // Duty counts for active team
  const dutyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!activeTeam) return counts;
    activeTeam.weekendDuties.forEach((w) => {
      if (w.morningId) counts[w.morningId] = (counts[w.morningId] || 0) + 1;
      if (w.eveningId) counts[w.eveningId] = (counts[w.eveningId] || 0) + 1;
    });
    return counts;
  }, [activeTeam]);

  const handleDutyDrop = (dutyId: string, slot: 'morning' | 'evening', memberId: string) => {
    if (!activeTeam) return;
    const nextTeams = db.teams.map((t) => {
      if (t.id === activeTeam.id) {
        return {
          ...t,
          weekendDuties: t.weekendDuties.map((x) =>
            x.id === dutyId
              ? { ...x, [slot === 'morning' ? 'morningId' : 'eveningId']: memberId }
              : x,
          ),
        };
      }
      return t;
    });
    persistDB({ ...db, teams: nextTeams });
    if (memberId) {
      const mem = activeTeam.members.find((m) => m.id === memberId);
      toast.success(`Assigned ${mem ? mem.name : 'staff'} to ${slot === 'morning' ? 'Morning' : 'Evening'} duty`);
    } else {
      toast.success(`Cleared ${slot === 'morning' ? 'Morning' : 'Evening'} duty`);
    }
    setDutyDropHover(null);
    setDraggedDutyMemberId(null);
  };

  // Multi-Member Condition Wizard Handlers
  const openWovWizard = () => {
    setWizardSelectedMemberIds([]);
    setWizardMemberSearch('');
    setWizardFromDate(fmtISO(new Date()));
    setWizardToDate(fmtISO(new Date()));
    setWizardShift('M');
    setWizardReason('Shift swap request');
    setConditionWizardType('wov');
  };

  const openLeaveWizard = () => {
    setWizardSelectedMemberIds([]);
    setWizardMemberSearch('');
    setWizardFromDate(fmtISO(new Date()));
    setWizardToDate(fmtISO(new Date()));
    setWizardReason('Annual Leave');
    setConditionWizardType('leave');
  };

  const openCompWizard = () => {
    setWizardSelectedMemberIds([]);
    setWizardMemberSearch('');
    setWizardWorkedDate(fmtISO(new Date()));
    setWizardCoDate(fmtISO(new Date()));
    setConditionWizardType('comp');
  };

  const handleApplyConditionWizard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeam || wizardSelectedMemberIds.length === 0) {
      toast.error('Please select at least one team member');
      return;
    }

    if (conditionWizardType === 'wov') {
      const newEntries: WeekdayOverrideEntry[] = wizardSelectedMemberIds.map((mId) => ({
        id: uid(),
        memberId: mId,
        from: wizardFromDate,
        to: wizardToDate,
        shift: wizardShift,
        reason: wizardReason.trim() || 'Shift swap request',
      }));
      const nextTeams = db.teams.map((t) =>
        t.id === activeTeam.id ? { ...t, wov: [...t.wov, ...newEntries] } : t,
      );
      persistDB({ ...db, teams: nextTeams });
      toast.success(`Added shift override for ${newEntries.length} ${newEntries.length === 1 ? 'member' : 'members'}`);
    } else if (conditionWizardType === 'leave') {
      const newEntries: LeaveEntry[] = wizardSelectedMemberIds.map((mId) => ({
        id: uid(),
        memberId: mId,
        from: wizardFromDate,
        to: wizardToDate,
        reason: wizardReason.trim() || 'Annual Leave',
      }));
      const nextTeams = db.teams.map((t) =>
        t.id === activeTeam.id ? { ...t, leaves: [...t.leaves, ...newEntries] } : t,
      );
      persistDB({ ...db, teams: nextTeams });
      toast.success(`Recorded leave for ${newEntries.length} ${newEntries.length === 1 ? 'member' : 'members'}`);
    } else if (conditionWizardType === 'comp') {
      const newEntries: CompOffEntry[] = wizardSelectedMemberIds.map((mId) => ({
        id: uid(),
        memberId: mId,
        worked: wizardWorkedDate,
        co: wizardCoDate,
      }));
      const nextTeams = db.teams.map((t) =>
        t.id === activeTeam.id ? { ...t, comps: [...t.comps, ...newEntries] } : t,
      );
      persistDB({ ...db, teams: nextTeams });
      toast.success(`Granted comp-off to ${newEntries.length} ${newEntries.length === 1 ? 'member' : 'members'}`);
    }

    setConditionWizardType(null);
  };

  // Compute Roster logic
  const computeRoster = (
    team: TeamData,
    startISO: string,
    endISO: string,
    manualEdits: Record<string, ShiftCode> = {},
  ) => {
    const cfg = team.config;
    const days = eachDay(parseD(startISO), parseD(endISO));
    const pool = team.rotationOrder.filter((id) => {
      const mm = team.members.find((x) => x.id === id);
      return mm && mm.grade !== 'Permanent General Shift';
    });
    const N = pool.length;
    const autoCO: Record<string, boolean> = {};
    const dutyByDate: Record<string, { m: string; e: string }> = {};

    team.weekendDuties.forEach((w) => {
      if (!w.date) return;
      dutyByDate[w.date] = { m: w.morningId, e: w.eveningId };
      const co = nextWorkingDay(w.date, cfg.offDay, db.holidays);
      if (w.morningId) autoCO[`${w.morningId}|${co}`] = true;
      if (w.eveningId) autoCO[`${w.eveningId}|${co}`] = true;
    });

    const grid: Record<string, ShiftCode[]> = {};
    team.members.forEach((mm) => {
      grid[mm.id] = [];
    });

    days.forEach((day) => {
      const iso = fmtISO(day);
      const w = weekIndex(day, cfg.anchor);
      const ptr = N ? ((w * cfg.step) % N + N) % N : 0;
      const skelM = N ? pool[ptr % N] : null;
      const skelE = N ? pool[(ptr + cfg.morningPerDay) % N] : null;
      const isOff = day.getDay() === Number(cfg.offDay);
      const holiday = db.holidays.find((h) => h.date === iso);
      const wd = dutyByDate[iso];
      const fixed: Record<string, ShiftCode> = {};

      team.members.forEach((mem) => {
        const onLeave = team.leaves.find(
          (l) => l.memberId === mem.id && l.from && iso >= l.from && (!l.to || iso <= l.to),
        );
        const manualCO = team.comps.find((c) => c.memberId === mem.id && c.co === iso);
        const isAutoCO = autoCO[`${mem.id}|${iso}`];
        const wov = team.wov.find(
          (o) => o.memberId === mem.id && o.from && iso >= o.from && (!o.to || iso <= o.to),
        );

        if (onLeave) fixed[mem.id] = 'L';
        else if (manualCO || isAutoCO) fixed[mem.id] = 'CO';
        else if (isOff || holiday) {
          if (wd) fixed[mem.id] = mem.id === wd.m ? 'M' : mem.id === wd.e ? 'E' : holiday ? 'HOL' : 'OFF';
          else if (Number(cfg.skeleton) === 1 && mem.id === skelM) fixed[mem.id] = 'M';
          else if (Number(cfg.skeleton) === 1 && mem.id === skelE) fixed[mem.id] = 'E';
          else fixed[mem.id] = holiday ? 'HOL' : 'OFF';
        } else if (wov) fixed[mem.id] = wov.shift;
        else if (mem.grade === 'Permanent General Shift') fixed[mem.id] = 'G';
      });

      if (!(isOff || holiday)) {
        let needM = cfg.morningPerDay;
        let needE = cfg.eveningPerDay;
        team.members.forEach((m) => {
          if (fixed[m.id] === 'M') needM--;
          if (fixed[m.id] === 'E') needE--;
        });
        for (let off = 0; off < N && (needM > 0 || needE > 0); off++) {
          const id = pool[(ptr + off) % N];
          if (fixed[id] !== undefined) continue;
          if (needM > 0) {
            fixed[id] = 'M';
            needM--;
          } else if (needE > 0) {
            fixed[id] = 'E';
            needE--;
          }
        }
        team.members.forEach((m) => {
          if (fixed[m.id] === undefined) fixed[m.id] = 'G';
        });
      } else {
        team.members.forEach((m) => {
          if (fixed[m.id] === undefined) fixed[m.id] = holiday ? 'HOL' : 'OFF';
        });
      }

      team.members.forEach((mem) => {
        grid[mem.id].push(fixed[mem.id]);
      });
    });

    Object.keys(manualEdits).forEach((k) => {
      const [mid, ci] = k.split('|');
      if (grid[mid]) grid[mid][+ci] = manualEdits[k];
    });

    return { days: days.map(fmtISO), grid };
  };

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast.error('Please pick both a start and end date');
      return;
    }
    if (endDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }
    if (!activeTeam.members.length) {
      toast.error('This team has no members yet. Add team members first.');
      return;
    }

    const { days, grid } = computeRoster(activeTeam, startDate, endDate, {});
    const title =
      rosterTitle.trim() ||
      parseD(startDate).toLocaleString('en-US', { month: 'short', year: 'numeric' });

    setCurrentRoster({
      id: uid(),
      title,
      startISO: startDate,
      endISO: endDate,
      createdAt: new Date().toISOString(),
      days,
      members: activeTeam.members.slice().map((m) => ({ id: m.id, name: m.name, grade: m.grade })),
      grid,
      edits: {},
      editCount: 0,
      status: 'Draft',
      revision: 1,
      sharedAt: null,
      changelog: [{ at: new Date().toISOString(), revision: 1, note: 'Initial roster generated' }],
      configSnap: JSON.parse(JSON.stringify(activeTeam.config)),
    });
    toast.success(`Generated roster for ${days.length} days (${activeTeam.members.length} members)`);
  };

  const handleCycleCell = (memberId: string, colIndex: number) => {
    if (!currentRoster) return;
    const currentCode = currentRoster.grid[memberId][colIndex];
    const currentIndex = CODES.indexOf(currentCode);
    const nextCode = CODES[(currentIndex + 1) % CODES.length];

    const nextGrid = { ...currentRoster.grid };
    nextGrid[memberId] = [...nextGrid[memberId]];
    nextGrid[memberId][colIndex] = nextCode;

    const nextEdits = { ...currentRoster.edits, [`${memberId}|${colIndex}`]: nextCode };

    setCurrentRoster({
      ...currentRoster,
      grid: nextGrid,
      edits: nextEdits,
      editCount: Object.keys(nextEdits).length,
    });
  };

  const handleSaveToHistory = async (asRevision = false) => {
    if (!currentRoster) return;
    let note = 'Initial save';
    let nextRevision = currentRoster.revision;
    let nextStatus = currentRoster.status;

    if (asRevision) {
      const inputNote = window.prompt('What changed in this revision? (e.g. Swapped shift, added leave)', '');
      if (inputNote === null) return;
      note = inputNote || 'Revision update';
      nextRevision = currentRoster.revision + 1;
      if (currentRoster.status === 'Published') nextStatus = 'Revised';
    }

    const updatedChangelog = [
      ...(currentRoster.changelog || []),
      { at: new Date().toISOString(), revision: nextRevision, note },
    ];

    const savedSnap: SavedRoster = {
      ...currentRoster,
      revision: nextRevision,
      status: nextStatus,
      changelog: updatedChangelog,
    };

    // Save to PostgreSQL via REST API
    try {
      const res = await ApiClient.post<any>(`/admin/roster/teams/${activeTeam.id}/rosters`, {
        title: savedSnap.title,
        startDate: savedSnap.startISO,
        endDate: savedSnap.endISO,
        status: savedSnap.status === 'Published' ? 'PUBLISHED' : savedSnap.status === 'Revised' ? 'AMENDED' : 'DRAFT',
        revision: savedSnap.revision,
        configSnap: savedSnap.configSnap,
        gridData: savedSnap.grid,
        manualEdits: savedSnap.edits,
        changelog: savedSnap.changelog,
      });
      if (res?.id) {
        savedSnap.id = res.id;
      }
    } catch (e) {
      console.warn('Server roster save failed, cached locally', e);
    }

    const nextTeams = db.teams.map((t) => {
      if (t.id === activeTeam.id) {
        const existingIdx = t.rosters.findIndex((r) => r.id === savedSnap.id);
        const nextRosters = [...t.rosters];
        if (existingIdx >= 0) {
          nextRosters[existingIdx] = savedSnap;
        } else {
          nextRosters.unshift(savedSnap);
        }
        return { ...t, rosters: nextRosters };
      }
      return t;
    });

    persistDB({ ...db, teams: nextTeams });
    setCurrentRoster(savedSnap);
    toast.success(asRevision ? `Saved revision r${nextRevision} to database` : 'Roster saved to database');
  };

  const handleMarkPublished = async () => {
    if (!currentRoster) return;
    const sharedAt = new Date().toISOString();
    const updatedChangelog = [
      ...(currentRoster.changelog || []),
      { at: sharedAt, revision: currentRoster.revision, note: 'Marked as officially published' },
    ];
    const updated: SavedRoster = {
      ...currentRoster,
      status: 'Published' as const,
      sharedAt,
      changelog: updatedChangelog,
    };

    // Publish to PostgreSQL via REST API
    try {
      await ApiClient.post(`/admin/roster/rosters/${currentRoster.id}/publish`, {
        note: 'Marked as officially published',
      });
    } catch (e) {
      console.warn('Server publish failed, updated locally', e);
    }

    const nextTeams = db.teams.map((t) => {
      if (t.id === activeTeam.id) {
        return {
          ...t,
          rosters: t.rosters.map((r) => (r.id === updated.id ? updated : r)),
        };
      }
      return t;
    });

    persistDB({ ...db, teams: nextTeams });
    setCurrentRoster(updated);
    toast.success(`Roster ${updated.title} marked as Published!`);
  };

  const handleExportCsv = (roster: SavedRoster) => {
    let rows: string[][] = [
      ['Team', teamName(activeTeam)],
      ['Roster Title', roster.title],
      ['Period', `${roster.startISO} to ${roster.endISO}`],
      ['Status', `${roster.status} (rev ${roster.revision})`],
      [],
      ['Member', 'Grade', ...roster.days],
    ];

    roster.members.forEach((m) => {
      rows.push([m.name, m.grade, ...(roster.grid[m.id] || [])]);
    });

    rows.push([]);
    // Footers
    const sums = roster.days.map((iso, ci) => {
      const col = roster.members.map((m) => roster.grid[m.id][ci]);
      const c: Record<string, number> = { G: 0, M: 0, E: 0, OFF: 0, HOL: 0, L: 0, CO: 0 };
      let sen = false,
        jun = false;
      col.forEach((code, i) => {
        c[code] = (c[code] || 0) + 1;
        if (['M', 'G', 'E'].includes(code)) {
          const g = roster.members[i]?.grade;
          if (g === 'Senior' || g === 'Permanent General Shift') sen = true;
          if (g === 'Junior') jun = true;
        }
      });
      const onDuty = c.M + c.G + c.E;
      const absent = c.L + c.CO;
      return { ...c, onDuty, absent, check: onDuty > 0 && sen && jun ? 'OK' : 'CHECK' };
    });

    [
      ['Morning (M)', 'M'],
      ['General (G)', 'G'],
      ['Evening (E)', 'E'],
      ['Off / Holiday', 'offhol'],
      ['Total on duty', 'onDuty'],
      ['Absent (L/CO)', 'absent'],
      ['Senior + Junior Balance', 'check'],
    ].forEach(([l, k]) => {
      rows.push([
        l,
        '',
        ...sums.map((s: any) => (k === 'offhol' ? String(s.OFF + s.HOL) : String(s[k]))),
      ]);
    });

    const csvContent = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${teamName(activeTeam)}_${roster.title}.csv`.replace(/[^\w.-]+/g, '_'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV export downloaded');
  };

  const handlePrintRoster = (roster: SavedRoster) => {
    if (!roster) return;
    const teamTitle = teamName(activeTeam);
    const activeProd = db.products.find((p) => p.id === activeTeam?.productId);
    const prodName = activeProd?.name || '';
    const brandName = activeProd?.brand?.name || (brands || []).find((b) => b.id === activeProd?.brandId)?.name || '';

    // Compute summary rows
    const sums = roster.days.map((iso, ci) => {
      const col = roster.members.map((m) => roster.grid[m.id]?.[ci] || 'G');
      const c: Record<string, number> = { G: 0, M: 0, E: 0, OFF: 0, HOL: 0, L: 0, CO: 0 };
      let sen = false,
        jun = false;
      col.forEach((code, i) => {
        c[code] = (c[code] || 0) + 1;
        if (['M', 'G', 'E'].includes(code)) {
          const g = roster.members[i]?.grade;
          if (g === 'Senior' || g === 'Permanent General Shift') sen = true;
          if (g === 'Junior') jun = true;
        }
      });
      const onDuty = c.M + c.G + c.E;
      const absent = c.L + c.CO;
      return { ...c, onDuty, absent, check: onDuty > 0 && sen && jun ? 'OK' : 'CHECK' };
    });

    const dayHeaders = roster.days
      .map((iso) => {
        const d = new Date(iso + 'T00:00:00');
        const dow = DOW[d.getDay()];
        const dayNum = d.getDate();
        const hol = db.holidays.find((h) => h.date === iso);
        return `<th style="padding: 6px 3px; text-align: center; border: 1px solid #cbd5e1; background: ${hol ? '#ffe4e6' : '#f8fafc'}; font-size: 11px; min-width: 30px;">
        <div style="font-weight: 700; color: ${dow === 'Sun' || dow === 'Sat' ? '#dc2626' : '#1e293b'};">${dow}</div>
        <div style="color: #64748b; font-size: 10px;">${dayNum}</div>
        ${hol ? `<div style="font-size: 8px; color: #be123c; font-weight: 800;" title="${hol.reason}">★</div>` : ''}
      </th>`;
      })
      .join('');

    const memberRows = roster.members
      .map((m) => {
        const cells = roster.days
          .map((iso, ci) => {
            const code = (roster.grid[m.id]?.[ci] || 'G') as ShiftCode;
            const meta = SHIFT_META[code] || SHIFT_META.G;
            return `<td style="padding: 4px 2px; text-align: center; border: 1px solid #cbd5e1; background: ${meta.bg}; color: ${meta.color}; font-weight: 700; font-size: 11px; font-family: monospace;">${code}</td>`;
          })
          .join('');

        return `<tr>
        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600; font-size: 11.5px; white-space: nowrap; background: #ffffff;">
          ${m.name}
          <div style="font-size: 9.5px; color: #64748b; font-weight: normal;">${m.grade}</div>
        </td>
        ${cells}
      </tr>`;
      })
      .join('');

    const summaryRows = [
      { label: 'Morning (M)', key: 'M', bg: '#fef3c7', color: '#b45309' },
      { label: 'General (G)', key: 'G', bg: '#f1f5f9', color: '#334155' },
      { label: 'Evening (E)', key: 'E', bg: '#ede9fe', color: '#6d28d9' },
      { label: 'Off / Holiday', key: 'offhol', bg: '#f8fafc', color: '#64748b' },
      { label: 'Total On Duty', key: 'onDuty', bg: '#e0f2fe', color: '#0369a1', isBold: true },
      { label: 'Absent (L/CO)', key: 'absent', bg: '#fee2e2', color: '#b91c1c' },
      { label: 'Senior + Junior', key: 'check', bg: '#ffffff', color: '#0f172a' },
    ]
      .map((r) => {
        const cells = sums
          .map((s: any) => {
            let val = s[r.key];
            if (r.key === 'offhol') val = s.OFF + s.HOL;
            const isCheck = r.key === 'check';
            const isOk = isCheck && val === 'OK';
            return `<td style="padding: 4px 2px; text-align: center; border: 1px solid #cbd5e1; background: ${isCheck ? (isOk ? '#f0fdf4' : '#fee2e2') : r.bg}; color: ${isCheck ? (isOk ? '#15803d' : '#dc2626') : r.color}; font-weight: ${r.isBold || isCheck ? '700' : '600'}; font-size: 10.5px; font-family: monospace;">${val}</td>`;
          })
          .join('');

        return `<tr>
        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: ${r.isBold ? '700' : '600'}; font-size: 11px; background: ${r.bg}; color: ${r.color};">
          ${r.label}
        </td>
        ${cells}
      </tr>`;
      })
      .join('');

    const legendItems = CODES.map((c) => {
      const m = SHIFT_META[c];
      return `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; margin-right: 10px; background: ${m.bg}; color: ${m.color}; padding: 2px 6px; border: 1px solid ${m.border}; border-radius: 4px; font-weight: 600;">
        <b>${c}</b>: ${m.label} (${m.desc})
      </span>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${roster.title} - ${teamTitle}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #0f172a;
      background: #ffffff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px;">
    <div>
      <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">${roster.title}</div>
      <div style="font-size: 12px; color: #475569; margin-top: 2px;">
        <b>Team:</b> ${teamTitle} ${prodName ? `· <b>Product:</b> ${prodName}` : ''} ${brandName ? `(${brandName})` : ''}
      </div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #475569;">
      <div><b>Period:</b> ${roster.startISO} &rarr; ${roster.endISO} (${roster.days.length} days)</div>
      <div style="margin-top: 2px;">
        <b>Status:</b> <span style="font-weight: 700; color: ${roster.status === 'Published' ? '#15803d' : roster.status === 'Revised' ? '#b45309' : '#475569'};">${roster.status}</span> 
        (Rev <b>r${roster.revision}</b>) · Printed: ${new Date().toLocaleDateString()}
      </div>
    </div>
  </div>

  <!-- Legend -->
  <div style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
    ${legendItems}
  </div>

  <!-- Main Roster Matrix -->
  <table>
    <thead>
      <tr>
        <th style="padding: 6px 8px; text-align: left; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11.5px; font-weight: 700; min-width: 140px;">
          Staff Member
        </th>
        ${dayHeaders}
      </tr>
    </thead>
    <tbody>
      ${memberRows}
    </tbody>
    <tfoot>
      ${summaryRows}
    </tfoot>
  </table>

  <!-- Footer Signatures -->
  <div style="margin-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; padding-top: 10px; border-top: 1px solid #e2e8f0;">
    <div>Prepared by: _______________________ (Team Lead)</div>
    <div>Verified by: _______________________ (Operations Manager)</div>
    <div>Approved by: _______________________ (Director)</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 200);
    };
  </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
    } else {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printHtml);
        doc.close();
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 2000);
      }
    }
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `abidesk_roster_backup_${fmtISO(new Date())}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Roster database backup downloaded');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.teams && parsed.products) {
          persistDB(parsed);
          toast.success('Backup successfully restored');
        } else {
          toast.error('Invalid backup format');
        }
      } catch (err) {
        toast.error('Failed to parse backup JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', width: '100%', padding: 0 }} className="custom-scrollbar roster-page-wrapper">
      {/* Mobile & Portrait Tablet Screen Restriction Notice (< 1024px) */}
      <div className="analytics-mobile-restriction">
        <div className="analytics-restriction-card">
          <div className="analytics-restriction-icon-wrapper">
            <div className="analytics-restriction-icon-disc">
              <Calendar size={32} />
            </div>
            <div className="analytics-restriction-sub-disc">
              <Monitor size={16} />
            </div>
          </div>

          <div className="analytics-restriction-badge">
            <ShieldCheck size={13} />
            <span>Desktop & Landscape Tablet Experience</span>
          </div>

          <h2 className="analytics-restriction-title">
            Optimized for Widescreen Displays
          </h2>

          <p className="analytics-restriction-desc">
            Shift Roster & Product Mapping matrices feature 30-day team rotation grids, multi-shift assignment tables, and L1/L2 product allocation timelines designed specifically for larger screens.
          </p>

          <div className="analytics-restriction-specs">
            <div className="analytics-spec-item">
              <div className="analytics-spec-icon">💻</div>
              <div className="analytics-spec-info">
                <strong>Desktop & Laptop</strong>
                <span>Minimum width 1366 × 768</span>
              </div>
            </div>
            <div className="analytics-spec-item">
              <div className="analytics-spec-icon">📱</div>
              <div className="analytics-spec-info">
                <strong>Tablet (Landscape)</strong>
                <span>Minimum 1024 × 768 (iPad Mini or larger in landscape)</span>
              </div>
            </div>
          </div>

          <div className="analytics-restriction-actions">
            <Link
              to="/inbox"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <Layers size={16} /> Open Ticket Inbox
            </Link>
            <Link
              to="/live-chat"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <Activity size={16} /> Live Chat Desk
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop Dashboard (≥ 1024px) */}
      <div className="analytics-desktop-content" style={{ padding: '24px 32px' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', paddingBottom: '60px' }}>
          {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-surface)', border: '1px solid var(--primary-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Calendar size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Shift Roster &amp; Product Mapping
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Multi-team rotation scheduling, L1/L2 product mapping, holiday duty management &amp; revisions
              </p>
            </div>
          </div>
        </div>

        {/* Active Team Selector & Backup Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Active Team:</span>
            <select
              value={activeTeam?.id || db.activeTeamId}
              onChange={(e) => {
                persistDB({ ...db, activeTeamId: e.target.value });
                setCurrentRoster(null);
                toast.info(`Switched to team`);
              }}
              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px', fontWeight: '600', background: 'var(--bg-app)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              {visibleTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {teamName(t)} ({t.members.length} {t.members.length === 1 ? 'member' : 'members'})
                </option>
              ))}
            </select>
          </div>
          {canManage && (
            <>
              <button
                onClick={handleExportBackup}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
                title="Export full JSON backup"
              >
                <Download size={14} /> Export Backup
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
                title="Import JSON backup"
              >
                <Upload size={14} /> Import
              </button>
            </>
          )}
          <button
            onClick={async () => {
              setIsLoading(true);
              try {
                await loadData(true);
                toast.success('Live database records refreshed');
              } catch (err) {
                toast.error('Failed to refresh data from server');
              } finally {
                setIsLoading(false);
              }
            }}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
            title="Reload live records from database"
          >
            <RotateCw size={14} /> Refresh Live Data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportBackup}
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
        {(canManage
          ? [
              { id: 'generate', label: 'Generate Roster', icon: Calendar },
              { id: 'teams', label: 'Teams & Products Matrix', icon: Grid },
              { id: 'members', label: 'Members & Rotation Rules', icon: Users },
              { id: 'conditions', label: 'Conditions & Duty Hub', icon: Layers },
              { id: 'history', label: `History (${activeTeam?.rosters?.length || 0})`, icon: Clock },
            ]
          : [
              { id: 'generate', label: 'Shift Schedule', icon: Calendar },
              { id: 'conditions', label: 'Holidays & Team Duty', icon: Layers },
              { id: 'history', label: `Published Schedules (${activeTeam?.rosters?.length || 0})`, icon: Clock },
            ]
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: isActive ? '600' : '500',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GENERATE ROSTER                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'generate' && (
        <div>
          {/* Controls Panel */}
          {canManage ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '650', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Roster Period &amp; Parameters
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Select date range for <b>{teamName(activeTeam)}</b>. Rotation sequence will auto-calculate weekly Morning/Evening slots, off-days, and compensatory leaves.
              </p>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Roster Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sep 2026"
                    value={rosterTitle}
                    onChange={(e) => setRosterTitle(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px', minWidth: '200px' }}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: '600' }}
                >
                  <Sparkles size={16} /> Generate Roster
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: '12px' }}>
                    Staff Schedule View
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                    {currentRoster?.title || 'Active Shift Schedule'} — {teamName(activeTeam)}
                  </h3>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  Period: <b>{currentRoster ? `${currentRoster.startISO} to ${currentRoster.endISO}` : `${startDate} to ${endDate}`}</b> • View team coverage and your scheduled shifts.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {currentRoster && (
                  <>
                    <button
                      onClick={() => handleExportCsv(currentRoster)}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <FileSpreadsheet size={13} /> Export CSV
                    </button>
                    <button
                      onClick={() => handlePrintRoster(currentRoster)}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Printer size={13} /> Print Schedule
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Roster Result Grid */}
          {currentRoster ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', overflow: 'hidden' }}>
              {/* Status & Revision Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {currentRoster.title}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        fontWeight: '650',
                        background:
                          currentRoster.status === 'Published'
                            ? '#e6f4ec'
                            : currentRoster.status === 'Revised'
                            ? '#fef3c7'
                            : '#f1f5f9',
                        color:
                          currentRoster.status === 'Published'
                            ? '#15803d'
                            : currentRoster.status === 'Revised'
                            ? '#b45309'
                            : '#475569',
                      }}
                    >
                      {currentRoster.status}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      rev {currentRoster.revision}
                    </span>
                    {currentRoster.editCount > 0 && (
                      <span style={{ fontSize: '11px', background: 'var(--primary-surface)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                        {currentRoster.editCount} manual edits
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    {teamName(activeTeam)} · {currentRoster.startISO} → {currentRoster.endISO} ·{' '}
                    {currentRoster.days.length} days · {currentRoster.members.length} members
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {canManage && (
                    <>
                      <button
                        onClick={() => {
                          const { days, grid } = computeRoster(
                            activeTeam,
                            currentRoster.startISO,
                            currentRoster.endISO,
                            currentRoster.edits,
                          );
                          setCurrentRoster({
                            ...currentRoster,
                            days,
                            grid,
                            members: activeTeam.members.slice().map((m) => ({ id: m.id, name: m.name, grade: m.grade })),
                          });
                          toast.success('Re-generated from latest rules (manual edits preserved)');
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <RefreshCw size={13} /> Re-generate
                      </button>

                      <button
                        onClick={() => handleSaveToHistory(true)}
                        className="btn btn-primary"
                        style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Edit2 size={13} /> Save New Revision
                      </button>

                      {currentRoster.status !== 'Published' && (
                        <button
                          onClick={handleMarkPublished}
                          className="btn btn-secondary"
                          style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#15803d' }}
                        >
                          <Share2 size={13} /> Publish Roster
                        </button>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => handleExportCsv(currentRoster)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <FileSpreadsheet size={13} /> CSV
                  </button>

                  <button
                    onClick={() => handlePrintRoster(currentRoster)}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Printer size={13} /> Print
                  </button>
                </div>
              </div>

              {/* Grid Scroll Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', maxHeight: '68vh' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 10, background: '#f8fafc', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-medium)', borderRight: '2px solid var(--border-medium)', minWidth: '180px', fontWeight: '700' }}>
                        Member
                      </th>
                      {currentRoster.days.map((iso) => {
                        const hol = db.holidays.find((h) => h.date === iso);
                        return (
                          <th
                            key={iso}
                            style={{
                              position: 'sticky',
                              top: 0,
                              zIndex: 5,
                              background: hol ? '#ffe4e6' : '#f8fafc',
                              padding: '6px 8px',
                              textAlign: 'center',
                              fontSize: '11px',
                              fontWeight: '600',
                              borderBottom: '1px solid var(--border-medium)',
                              borderRight: '1px solid var(--border-subtle)',
                              minWidth: '42px',
                            }}
                            title={hol ? `Holiday: ${hol.reason}` : undefined}
                          >
                            {iso.slice(8, 10)}/{iso.slice(5, 7)}
                          </th>
                        );
                      })}
                    </tr>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, top: '33px', zIndex: 10, background: '#f8fafc', padding: '4px 12px', textAlign: 'left', borderBottom: '2px solid var(--border-medium)', borderRight: '2px solid var(--border-medium)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        Day of week
                      </th>
                      {currentRoster.days.map((iso) => {
                        const dow = DOW[parseD(iso).getDay()];
                        const isWk = dow === 'Sun' || dow === 'Sat';
                        return (
                          <th
                            key={`dow-${iso}`}
                            style={{
                              position: 'sticky',
                              top: '33px',
                              zIndex: 5,
                              background: '#f8fafc',
                              padding: '4px 4px',
                              textAlign: 'center',
                              fontSize: '10.5px',
                              fontWeight: isWk ? '700' : '500',
                              color: isWk ? '#dc2626' : 'var(--text-muted)',
                              borderBottom: '2px solid var(--border-medium)',
                              borderRight: '1px solid var(--border-subtle)',
                            }}
                          >
                            {dow}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRoster.members.map((mem, mi) => (
                      <tr key={mem.id} style={{ background: mi % 2 === 0 ? '#ffffff' : '#fafbfd' }}>
                        <td
                          style={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 4,
                            background: mi % 2 === 0 ? '#ffffff' : '#fafbfd',
                            padding: '7px 12px',
                            fontWeight: '600',
                            borderRight: '2px solid var(--border-medium)',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          {mem.name}
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: '500' }}>
                            ({mem.grade === 'Permanent General Shift' ? 'Perm-G' : mem.grade})
                          </span>
                        </td>
                        {currentRoster.days.map((iso, ci) => {
                          const code = currentRoster.grid[mem.id]?.[ci] || 'G';
                          const isEdited = !!currentRoster.edits[`${mem.id}|${ci}`];
                          const d = parseD(iso).getDay();
                          const isWeekend = d === 0 || d === 6;
                          const meta = SHIFT_META[code] || SHIFT_META.G;

                          return (
                            <td
                              key={iso}
                              style={{
                                padding: '2px',
                                textAlign: 'center',
                                borderRight: '1px solid var(--border-subtle)',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: isWeekend ? 'rgba(0,0,0,0.015)' : undefined,
                              }}
                            >
                              {canManage ? (
                                <button
                                  onClick={() => handleCycleCell(mem.id, ci)}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    height: '28px',
                                    padding: '2px 0',
                                    border: isEdited ? '2px solid var(--primary)' : '1px solid transparent',
                                    borderRadius: '4px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    color: meta.color,
                                    background: meta.bg,
                                    cursor: 'pointer',
                                    transition: 'transform 0.1s ease',
                                  }}
                                  title={`${meta.label} (${meta.desc}) - Click to change`}
                                >
                                  {code}
                                </button>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: '28px',
                                    borderRadius: '4px',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    color: meta.color,
                                    background: meta.bg,
                                    border: '1px solid transparent',
                                    userSelect: 'none',
                                  }}
                                  title={`${meta.label} (${meta.desc})`}
                                >
                                  {code}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const sums = currentRoster.days.map((iso, ci) => {
                        const col = currentRoster.members.map((m) => currentRoster.grid[m.id]?.[ci] || 'G');
                        const c: Record<string, number> = { G: 0, M: 0, E: 0, OFF: 0, HOL: 0, L: 0, CO: 0 };
                        let sen = false,
                          jun = false;
                        col.forEach((code, i) => {
                          c[code] = (c[code] || 0) + 1;
                          if (['M', 'G', 'E'].includes(code)) {
                            const g = currentRoster.members[i]?.grade;
                            if (g === 'Senior' || g === 'Permanent General Shift') sen = true;
                            if (g === 'Junior') jun = true;
                          }
                        });
                        const onDuty = c.M + c.G + c.E;
                        const absent = c.L + c.CO;
                        return { ...c, onDuty, absent, check: onDuty > 0 && sen && jun ? 'OK' : 'CHECK' };
                      });

                      const metricRows = [
                        { label: 'Morning (M)', key: 'M', bg: '#fef3c7', color: '#b45309' },
                        { label: 'General (G)', key: 'G', bg: '#f1f5f9', color: '#334155' },
                        { label: 'Evening (E)', key: 'E', bg: '#ede9fe', color: '#6d28d9' },
                        { label: 'Off / Holiday', key: 'offhol', bg: '#f8fafc', color: '#64748b' },
                        { label: 'Total On Duty', key: 'onDuty', bg: '#e0f2fe', color: '#0369a1', isTotal: true },
                        { label: 'Absent (L / CO)', key: 'absent', bg: '#fee2e2', color: '#b91c1c' },
                        { label: 'Senior + Junior', key: 'check', bg: '#ffffff', color: '#0f172a' },
                      ];

                      return metricRows.map((row) => (
                        <tr key={row.key} style={{ background: row.isTotal ? '#f1f5f9' : '#f8fafc', fontWeight: '700' }}>
                          <td
                            style={{
                              position: 'sticky',
                              left: 0,
                              zIndex: 4,
                              background: row.isTotal ? '#e2e8f0' : '#f1f5f9',
                              padding: '6px 12px',
                              borderRight: '2px solid var(--border-medium)',
                              borderTop: '1px solid var(--border-medium)',
                              fontSize: '11.5px',
                              color: row.color,
                            }}
                          >
                            {row.label}
                          </td>
                          {sums.map((s: any, ci) => {
                            let val = s[row.key];
                            if (row.key === 'offhol') val = s.OFF + s.HOL;
                            const isCheck = row.key === 'check';
                            const isOk = isCheck && val === 'OK';

                            return (
                              <td
                                key={`sum-${ci}-${row.key}`}
                                style={{
                                  padding: '5px 4px',
                                  textAlign: 'center',
                                  borderRight: '1px solid var(--border-subtle)',
                                  borderTop: '1px solid var(--border-medium)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: isCheck ? (isOk ? '#15803d' : '#dc2626') : row.color,
                                  background: isCheck && !isOk ? '#fee2e2' : undefined,
                                }}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tfoot>
                </table>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Shift Legend:</span>
                {CODES.map((c) => {
                  const m = SHIFT_META[c];
                  return (
                    <span
                      key={c}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: m.bg,
                        color: m.color,
                        border: `1px solid ${m.border}`,
                      }}
                    >
                      <b style={{ fontFamily: 'var(--font-mono)' }}>{c}</b>
                      {m.label}
                    </span>
                  );
                })}
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>
                  💡 Click any cell in the table to cycle through shift codes
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-surface)', border: '1px dashed var(--border-medium)', borderRadius: '12px' }}>
              <Calendar size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 6px', color: 'var(--text-primary)' }}>
                {canManage ? 'No Roster Generated Yet' : 'No Published Roster Available Yet'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 16px', lineHeight: '1.5' }}>
                {canManage ? (
                  <>
                    Pick your date range and roster title above, then click <b>Generate Roster</b> to calculate the complete rotation and duty grid.
                  </>
                ) : (
                  <>
                    No published schedule is currently available for <b>{teamName(activeTeam)}</b>. Once your team manager or administrator generates and publishes the roster, your shift schedule will appear here automatically.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAMS & PRODUCTS MATRIX                                            */}
      {/* ========================================================================= */}
      {activeTab === 'teams' && (
        <div>
          {/* Products Management Card */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '650', margin: '0 0 2px', color: 'var(--text-primary)' }}>
                  Registered Products &amp; Applications
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  Software applications mapped to your organization brands for multi-tier support scheduling (L1/L2/L3/Dev/QA).
                </p>
              </div>
              <button
                onClick={() => {
                  setNewProductName('');
                  setNewProductSlug('');
                  setNewProductBrandId(brands && brands[0] ? brands[0].id : '');
                  setNewProductDesc('');
                  setIsAddProductModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={14} /> Add Product
              </button>
            </div>

            {db.products.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', border: '1px dashed var(--border-medium)', borderRadius: '10px', background: 'var(--bg-app)' }}>
                <Package size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                <div style={{ fontWeight: '650', fontSize: '14.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  No Products or Applications Registered
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 16px', lineHeight: 1.4 }}>
                  Add your organization's software products/applications to assign L2/L3/Dev/QA support tier teams and generate multi-tier rosters.
                </p>
                <button
                  onClick={() => {
                    setNewProductName('');
                    setNewProductBrandId(brands && brands[0] ? brands[0].id : '');
                    setNewProductDesc('');
                    setIsAddProductModalOpen(true);
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Add First Product
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {db.products.map((p) => {
                  const mappedTeams = db.teams.filter((t) => t.productId === p.id);
                  const brandName = p.brand?.name || brands.find((b) => b.id === p.brandId)?.name || 'Org-wide (All Brands)';

                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '16px 18px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div>
                        {/* Top Row: Icon + Name + Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: '#eff6ff',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Package size={18} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: '700',
                                  fontSize: '14.5px',
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={p.name}
                              >
                                {p.name}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>🏢 {brandName}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setEditProductName(p.name);
                                setEditProductBrandId(p.brandId || '');
                                setEditProductDesc(p.description || '');
                              }}
                              className="btn btn-ghost"
                              style={{ padding: '5px', height: 'auto', borderRadius: '6px' }}
                              title="Edit Product"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className="btn btn-ghost"
                              style={{ padding: '5px', height: 'auto', color: '#dc2626', borderRadius: '6px' }}
                              title="Delete Product"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Description Section */}
                        <div style={{ marginTop: '12px', minHeight: '36px' }}>
                          {p.description ? (
                            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                              {p.description}
                            </p>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                              No description provided.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bottom Footer: Mapped Tiers */}
                      <div
                        style={{
                          marginTop: '14px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '11.5px',
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>
                          Configured Tiers:
                        </span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {mappedTeams.length > 0 ? (
                            mappedTeams.map((t) => (
                              <span key={t.id} className={`tier-pill ${t.tier}`}>
                                {t.tier}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>
                              Not mapped in matrix yet
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Matrix Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '650', margin: '0 0 2px', color: 'var(--text-primary)' }}>
                  Support Tiers &times; Products Matrix
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  L1 (Service Desk) is shared across all products. L2, L3, Dev, and QA have dedicated teams per product.
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid var(--border-medium)', borderRight: '1px solid var(--border-subtle)', minWidth: '100px', fontWeight: '700' }}>
                      Tier
                    </th>
                    {db.products.length === 0 ? (
                      <th
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          borderBottom: '1px solid var(--border-medium)',
                          borderRight: '1px solid var(--border-subtle)',
                          minWidth: '220px',
                          fontWeight: '700',
                          color: 'var(--text-muted)',
                        }}
                      >
                        Product Columns (Register products above to populate)
                      </th>
                    ) : (
                      db.products.map((p) => (
                        <th
                          key={p.id}
                          style={{
                            padding: '10px 14px',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border-medium)',
                            borderRight: '1px solid var(--border-subtle)',
                            minWidth: '220px',
                            fontWeight: '700',
                          }}
                        >
                          <div>{p.name}</div>
                          <div style={{ fontSize: '11px', fontWeight: '400', color: 'var(--text-muted)' }}>
                            {p.brand?.name || brands.find((b) => b.id === p.brandId)?.name || 'Org-wide'}
                          </div>
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {db.tiers.map((tier) => {
                    if (tier === 'L1') {
                      const l1Team = db.teams.find((t) => t.tier === 'L1');
                      const isActive = l1Team?.id === db.activeTeamId;
                      return (
                        <tr key={tier} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px', fontWeight: '700', background: '#f8fafc', borderRight: '1px solid var(--border-subtle)' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb', fontWeight: '700' }}>
                              L1
                            </span>
                          </td>
                          <td colSpan={Math.max(1, db.products.length)} style={{ padding: '14px', background: '#fafbfd' }}>
                            {l1Team ? (
                              <div
                                style={{
                                  border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  borderRadius: '8px',
                                  padding: '12px 16px',
                                  background: '#ffffff',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: '700', fontSize: '13.5px' }}>{teamName(l1Team)}</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {l1Team.members.length} members · {l1Team.rosters.length} saved rosters
                                    {isActive && <span style={{ color: 'var(--primary)', fontWeight: '600', marginLeft: '6px' }}>● Active</span>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    onClick={() => {
                                      persistDB({ ...db, activeTeamId: l1Team.id });
                                      setActiveTab('members');
                                    }}
                                    className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                                  >
                                    {isActive ? 'Manage Rules' : 'Select Team'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: '14px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '8px' }}>
                                <span>No L1 team configured</span>
                                <button
                                  onClick={() => {
                                    const t = emptyTeamData('L1', null);
                                    persistDB({ ...db, teams: [...db.teams, t], activeTeamId: t.id });
                                    toast.success('Created L1 Service Desk team');
                                  }}
                                  className="btn btn-sm btn-primary"
                                  style={{ marginLeft: '10px' }}
                                >
                                  + Create L1 Team
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    if (db.products.length === 0) {
                      return (
                        <tr key={tier} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px', fontWeight: '700', background: '#f8fafc', borderRight: '1px solid var(--border-subtle)' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: '700' }}>
                              {tier}
                            </span>
                          </td>
                          <td style={{ padding: '14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
                            Register products above to assign {tier} teams for each product.
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={tier} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '14px', fontWeight: '700', background: '#f8fafc', borderRight: '1px solid var(--border-subtle)' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: '700' }}>
                            {tier}
                          </span>
                        </td>
                        {db.products.map((p) => {
                          const team = db.teams.find((t) => t.tier === tier && t.productId === p.id);
                          const isActive = team?.id === db.activeTeamId;

                          return (
                            <td key={p.id} style={{ padding: '12px', borderRight: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                              {team ? (
                                <div
                                  style={{
                                    border: isActive ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    background: '#ffffff',
                                  }}
                                >
                                  <div style={{ fontWeight: '650', fontSize: '13px' }}>
                                    {tier} · {p.name}
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '3px 0 8px' }}>
                                    {team.members.length} members · {team.rosters.length} rosters
                                    {isActive && <span style={{ color: 'var(--primary)', fontWeight: '600', marginLeft: '4px' }}>● Active</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                    <button
                                      onClick={() => {
                                        persistDB({ ...db, activeTeamId: team.id });
                                        setActiveTab('members');
                                      }}
                                      className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                                      style={{ fontSize: '11.5px', padding: '4px 8px' }}
                                    >
                                      {isActive ? 'Manage' : 'Select'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const cloneMembers = window.confirm('Clone with members and rules? (Cancel = rules only)');
                                        const idMap: Record<string, string> = {};
                                        const clonedMembers = cloneMembers
                                          ? team.members.map((m) => {
                                              const nid = uid();
                                              idMap[m.id] = nid;
                                              return { ...m, id: nid };
                                            })
                                          : [];
                                        const newTeam: TeamData = {
                                          ...JSON.parse(JSON.stringify(team)),
                                          id: uid(),
                                          members: clonedMembers,
                                          rotationOrder: cloneMembers ? team.rotationOrder.map((id) => idMap[id]).filter(Boolean) : [],
                                          rosters: [],
                                        };
                                        persistDB({ ...db, teams: [...db.teams, newTeam], activeTeamId: newTeam.id });
                                        toast.success(`Cloned ${tier} · ${p.name}`);
                                      }}
                                      className="btn btn-sm btn-secondary"
                                      style={{ fontSize: '11.5px', padding: '4px 8px' }}
                                      title="Clone team"
                                    >
                                      <Copy size={12} /> Clone
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (!window.confirm(`Delete ${tier} · ${p.name} team?`)) return;
                                        persistDB({ ...db, teams: db.teams.filter((t) => t.id !== team.id) });
                                        toast.success('Team deleted');
                                      }}
                                      className="btn btn-sm btn-ghost"
                                      style={{ fontSize: '11.5px', padding: '4px 6px', color: '#dc2626' }}
                                      title="Delete"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ border: '1px dashed var(--border-medium)', borderRadius: '8px', padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                                  No {tier} team
                                  <br />
                                  <button
                                    onClick={() => {
                                      const newT = emptyTeamData(tier, p.id);
                                      persistDB({ ...db, teams: [...db.teams, newT], activeTeamId: newT.id });
                                      toast.success(`Created ${tier} team for ${p.name}`);
                                    }}
                                    className="btn btn-sm btn-secondary"
                                    style={{ marginTop: '6px', fontSize: '11.5px', padding: '3px 8px' }}
                                  >
                                    + Create
                                  </button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MEMBERS & ROTATION RULES                                           */}
      {/* ========================================================================= */}
      {activeTab === 'members' && activeTeam && (
        <div>
          {/* Rotation Settings Form */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '650', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  Rotation Rules for {teamName(activeTeam)}
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  Each week a block is pulled from the rotation order for Morning &amp; Evening shifts; everyone else works General.
                </p>
              </div>
              <button
                onClick={() => syncTeamConfigToDb(activeTeam.id, activeTeam, true)}
                className="btn btn-primary"
                disabled={isSyncingToDb}
                style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Save current rotation rules directly to PostgreSQL database"
              >
                <Check size={14} /> {isSyncingToDb ? 'Saving...' : 'Save Rules'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Morning per day
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={activeTeam.config.morningPerDay}
                  onChange={(e) => {
                    const val = +e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, morningPerDay: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Evening per day
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={activeTeam.config.eveningPerDay}
                  onChange={(e) => {
                    const val = +e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, eveningPerDay: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Rotation step / week
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={activeTeam.config.step}
                  onChange={(e) => {
                    const val = +e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, step: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Week Anchor (Sunday)
                </label>
                <input
                  type="date"
                  value={activeTeam.config.anchor}
                  onChange={(e) => {
                    const val = e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, anchor: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Weekly Off Day
                </label>
                <select
                  value={activeTeam.config.offDay}
                  onChange={(e) => {
                    const val = +e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, offDay: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Off-day Coverage Fallback
                </label>
                <select
                  value={activeTeam.config.skeleton}
                  onChange={(e) => {
                    const val = +e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, skeleton: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                >
                  <option value={1}>Skeleton (1 M + 1 E)</option>
                  <option value={0}>Everyone Off</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Max Weekend/Holiday Duties
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={activeTeam.config.maxDuty}
                  onChange={(e) => {
                    const val = +e.target.value;
                    const nextTeams = db.teams.map((t) => (t.id === activeTeam.id ? { ...t, config: { ...t.config, maxDuty: val } } : t));
                    persistDB({ ...db, teams: nextTeams });
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#1e40af' }}>
              💡 Staff graded <b>Permanent General Shift</b> are automatically skipped by the rotation engine and stay on General shift.
            </div>
          </div>

          {/* Members Table */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '650', margin: '0 0 2px', color: 'var(--text-primary)' }}>
                  Team Members ({activeTeam.members.length})
                </h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  Order from top to bottom defines the exact rotational queue order.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {realStaffUsers.length > 0 && (
                  <button
                    onClick={() => {
                      const existingNames = new Set(activeTeam.members.map((m) => m.name.toLowerCase().trim()));
                      const imported: TeamMember[] = [];
                      realStaffUsers.forEach((u) => {
                        const name = (u.fullName || u.displayName || u.email || '').trim();
                        if (name && !existingNames.has(name.toLowerCase())) {
                          const isAdmin = Array.isArray(u.roles) && u.roles.some((r: any) => {
                            const k = r.role?.key || (typeof r === 'string' ? r : '');
                            return k === 'TENANT_ADMIN' || k === 'SYSTEM_ADMIN';
                          });
                          const memberId = u.id || uid();
                          imported.push({
                            id: memberId,
                            name,
                            shift: 'General Shift',
                            timing: '10:00 AM - 7:00 PM',
                            grade: isAdmin ? 'Permanent General Shift' : 'Senior',
                          });
                          if (u.id) {
                            ApiClient.post(`/admin/teams/${activeTeam.id}/members`, {
                              userId: u.id,
                              defaultShift: 'General Shift',
                              timing: '10:00 AM - 7:00 PM',
                              grade: isAdmin ? 'Permanent General Shift' : 'Senior',
                            }).catch(() => {});
                          }
                        }
                      });
                      if (!imported.length) {
                        toast.info('All staff from directory are already in this team');
                        return;
                      }
                      const nextMembers = [...activeTeam.members, ...imported];
                      const nextTeams = db.teams.map((t) =>
                        t.id === activeTeam.id
                          ? { ...t, members: nextMembers, rotationOrder: nextMembers.map((m) => m.id) }
                          : t,
                      );
                      persistDB({ ...db, teams: nextTeams });
                      toast.success(`Imported ${imported.length} staff members from your organization directory`);
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    title="Import active internal staff users from organization directory"
                  >
                    <UserCheck size={14} /> Import Staff Directory ({realStaffUsers.length})
                  </button>
                )}

                {activeTeam.members.some((m) => !realStaffUsers.some((u) => (u.fullName || u.displayName || u.email || '').toLowerCase().trim() === m.name.toLowerCase().trim())) && (
                  <button
                    onClick={() => {
                      if (!window.confirm('Remove members who are not found in the staff directory (e.g. customers/guest users)?')) return;
                      const validStaffNames = new Set(realStaffUsers.map((u) => (u.fullName || u.displayName || u.email || '').toLowerCase().trim()));
                      const cleaned = activeTeam.members.filter((m) => validStaffNames.has(m.name.toLowerCase().trim()));
                      const nextTeams = db.teams.map((t) =>
                        t.id === activeTeam.id
                          ? { ...t, members: cleaned, rotationOrder: cleaned.map((m) => m.id) }
                          : t,
                      );
                      persistDB({ ...db, teams: nextTeams });
                      toast.success(`Cleaned roster: retained ${cleaned.length} verified staff members`);
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#b45309', borderColor: '#fde68a' }}
                    title="Remove non-staff / guest entries from team roster"
                  >
                    <UserX size={14} /> Clean Non-Staff ({activeTeam.members.filter((m) => !realStaffUsers.some((u) => (u.fullName || u.displayName || u.email || '').toLowerCase().trim() === m.name.toLowerCase().trim())).length})
                  </button>
                )}

                <button
                  onClick={() => {
                    const newM: TeamMember = {
                      id: uid(),
                      name: 'New Staff Member',
                      shift: 'General Shift',
                      timing: '10:00 AM - 7:00 PM',
                      grade: 'Junior',
                    };
                    const nextTeams = db.teams.map((t) =>
                      t.id === activeTeam.id
                        ? { ...t, members: [...t.members, newM], rotationOrder: [...t.rotationOrder, newM.id] }
                        : t,
                    );
                    persistDB({ ...db, teams: nextTeams });
                    toast.success('Added team member');
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Plus size={14} /> Add Member
                </button>
              </div>
            </div>

            <div
              style={{
                maxHeight: '480px',
                overflowY: 'auto',
                overflowX: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                background: '#ffffff',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '9px 10px', width: '70px', textAlign: 'center', borderBottom: '1px solid var(--border-medium)', background: '#f8fafc' }}>Order</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-medium)', background: '#f8fafc' }}>Name</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-medium)', background: '#f8fafc' }}>Default Shift</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-medium)', background: '#f8fafc' }}>Timing</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-medium)', background: '#f8fafc' }}>Grade</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right', borderBottom: '1px solid var(--border-medium)', background: '#f8fafc' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {activeTeam.members.map((m, idx) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                          <button
                            disabled={idx === 0}
                            onClick={() => {
                              const arr = [...activeTeam.members];
                              [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id
                                  ? { ...t, members: arr, rotationOrder: arr.map((x) => x.id) }
                                  : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            className="btn btn-ghost"
                            style={{ padding: '2px', opacity: idx === 0 ? 0.3 : 1 }}
                            title="Move Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            disabled={idx === activeTeam.members.length - 1}
                            onClick={() => {
                              const arr = [...activeTeam.members];
                              [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id
                                  ? { ...t, members: arr, rotationOrder: arr.map((x) => x.id) }
                                  : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            className="btn btn-ghost"
                            style={{ padding: '2px', opacity: idx === activeTeam.members.length - 1 ? 0.3 : 1 }}
                            title="Move Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          value={m.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextTeams = db.teams.map((t) =>
                              t.id === activeTeam.id
                                ? { ...t, members: t.members.map((x) => (x.id === m.id ? { ...x, name: val } : x)) }
                                : t,
                            );
                            persistDB({ ...db, teams: nextTeams });
                          }}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <select
                          value={m.shift}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newTiming = DEFAULT_SHIFT_TIMINGS[val] || m.timing;
                            const nextTeams = db.teams.map((t) =>
                              t.id === activeTeam.id
                                ? {
                                    ...t,
                                    members: t.members.map((x) =>
                                      x.id === m.id ? { ...x, shift: val, timing: newTiming } : x,
                                    ),
                                  }
                                : t,
                            );
                            persistDB({ ...db, teams: nextTeams });
                          }}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                        >
                          {SHIFTS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-app)', border: '1px solid var(--border-medium)', borderRadius: '6px', padding: '4px 8px' }}>
                          <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <input
                            type="time"
                            value={parseTimingRange(m.timing)[0]}
                            onChange={(e) => {
                              const newStart24 = e.target.value;
                              const currentEnd24 = parseTimingRange(m.timing)[1];
                              const formatted = `${formatFrom24h(newStart24)} - ${formatFrom24h(currentEnd24)}`;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id
                                  ? { ...t, members: t.members.map((x) => (x.id === m.id ? { ...x, timing: formatted } : x)) }
                                  : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '12px',
                              padding: 0,
                              outline: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                              fontWeight: '500',
                            }}
                            title="Shift Start Time"
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>–</span>
                          <input
                            type="time"
                            value={parseTimingRange(m.timing)[1]}
                            onChange={(e) => {
                              const currentStart24 = parseTimingRange(m.timing)[0];
                              const newEnd24 = e.target.value;
                              const formatted = `${formatFrom24h(currentStart24)} - ${formatFrom24h(newEnd24)}`;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id
                                  ? { ...t, members: t.members.map((x) => (x.id === m.id ? { ...x, timing: formatted } : x)) }
                                  : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '12px',
                              padding: 0,
                              outline: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-primary)',
                              fontWeight: '500',
                            }}
                            title="Shift End Time"
                          />
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <select
                          value={m.grade}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            const nextTeams = db.teams.map((t) =>
                              t.id === activeTeam.id
                                ? { ...t, members: t.members.map((x) => (x.id === m.id ? { ...x, grade: val } : x)) }
                                : t,
                            );
                            persistDB({ ...db, teams: nextTeams });
                          }}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: '1px solid var(--border-medium)', fontSize: '13px' }}
                        >
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            if (!window.confirm(`Delete member ${m.name}?`)) return;
                            const nextTeams = db.teams.map((t) =>
                              t.id === activeTeam.id
                                ? {
                                    ...t,
                                    members: t.members.filter((x) => x.id !== m.id),
                                    rotationOrder: t.rotationOrder.filter((id) => id !== m.id),
                                    leaves: t.leaves.filter((l) => l.memberId !== m.id),
                                    comps: t.comps.filter((c) => c.memberId !== m.id),
                                    wov: t.wov.filter((o) => o.memberId !== m.id),
                                  }
                                : t,
                            );
                            persistDB({ ...db, teams: nextTeams });
                            ApiClient.delete(`/admin/teams/${activeTeam.id}/members/${m.id}`).catch(() => {});
                            toast.success('Member removed');
                          }}
                          className="btn btn-ghost"
                          style={{ color: '#dc2626', padding: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CONDITIONS & DUTY HUB                                              */}
      {/* ========================================================================= */}
      {activeTab === 'conditions' && activeTeam && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Global Holidays */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '650', margin: 0, color: 'var(--text-primary)' }}>
                    Company Holidays
                  </h3>
                  <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                    Global (All Teams)
                  </span>
                  <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                    {db.holidays.length} {db.holidays.length === 1 ? 'holiday' : 'holidays'}
                  </span>
                  {!canManage && (
                    <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                      Read-Only
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {canManage
                    ? 'Company-wide non-working days. Roster algorithm automatically exempts staff and triggers Compensatory Off (CO) rules.'
                    : 'Official organization-wide non-working holidays. Shifts are automatically exempted on these dates.'}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    const newH: GlobalHoliday = { id: uid(), date: fmtISO(new Date()), reason: 'New Company Holiday' };
                    persistDB({ ...db, holidays: [...db.holidays, newH] });
                    toast.success('Added new company holiday');
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={13} /> Add Holiday
                </button>
              )}
            </div>

            {db.holidays.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '10px', color: 'var(--text-muted)', background: '#fafbfc' }}>
                <CalendarDays size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: '13px', fontWeight: '600' }}>No Company Holidays Configured</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>Click &quot;+ Add Holiday&quot; above to declare organization-wide non-working holidays.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {db.holidays.map((h) => {
                  const dObj = h.date ? parseD(h.date) : new Date();
                  const dow = DOW[dObj.getDay()] || '';
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 14px',
                        background: '#ffffff',
                        border: '1px solid #fed7aa',
                        borderRadius: '10px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Calendar Badge */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid #fdba74',
                          width: '48px',
                          height: '52px',
                          flexShrink: 0,
                          background: '#fff',
                          boxShadow: '0 1px 2px rgba(251,146,60,0.15)',
                        }}
                      >
                        <div
                          style={{
                            background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                            color: '#ffffff',
                            fontSize: '9.5px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            width: '100%',
                            textAlign: 'center',
                            padding: '2px 0',
                          }}
                        >
                          {dow}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '17px',
                            fontWeight: '800',
                            color: '#9a3412',
                            fontFamily: 'var(--font-mono)',
                            background: '#fff7ed',
                            width: '100%',
                          }}
                        >
                          {h.date ? h.date.split('-')[2] : '--'}
                        </div>
                      </div>

                      {/* Symmetrical Inputs Column */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        {canManage ? (
                          <>
                            <input
                              type="text"
                              value={h.reason}
                              onChange={(e) => {
                                const val = e.target.value;
                                persistDB({
                                  ...db,
                                  holidays: db.holidays.map((x) => (x.id === h.id ? { ...x, reason: val } : x)),
                                });
                              }}
                              placeholder="Holiday Name / Festival"
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-medium)',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: 'var(--text-primary)',
                                boxSizing: 'border-box',
                                outline: 'none',
                                background: '#ffffff',
                              }}
                            />
                            <input
                              type="date"
                              value={h.date}
                              onChange={(e) => {
                                const val = e.target.value;
                                persistDB({
                                  ...db,
                                  holidays: db.holidays.map((x) => (x.id === h.id ? { ...x, date: val } : x)),
                                });
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: 'var(--text-secondary)',
                                background: '#f8fafc',
                                boxSizing: 'border-box',
                                outline: 'none',
                                cursor: 'pointer',
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {h.reason || 'Company Holiday'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                              {h.date} ({dow})
                            </div>
                          </>
                        )}
                      </div>

                      {/* Delete Action Button */}
                      {canManage && (
                        <button
                          onClick={() => {
                            persistDB({ ...db, holidays: db.holidays.filter((x) => x.id !== h.id) });
                            toast.success('Holiday removed');
                          }}
                          className="btn btn-ghost"
                          style={{
                            color: '#dc2626',
                            width: '36px',
                            height: '36px',
                            padding: 0,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            cursor: 'pointer',
                            alignSelf: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          title="Delete Holiday"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekend & Holiday Duty Management */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '650', margin: 0, color: 'var(--text-primary)' }}>
                    Weekend &amp; Holiday Duty Assignments
                  </h3>
                  <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                    {activeTeam.weekendDuties.length} {activeTeam.weekendDuties.length === 1 ? 'duty slot' : 'duty slots'}
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Assigned staff cover Morning (7:30 AM) or Evening (2:00 PM) shifts on weekends/holidays. Compensatory Off (CO) is <b>automatically granted</b> on their next working day.
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    const newD: WeekendDutyEntry = {
                      id: uid(),
                      date: fmtISO(new Date()),
                      morningId: activeTeam.members[0]?.id || '',
                      eveningId: activeTeam.members[1]?.id || '',
                    };
                    const nextTeams = db.teams.map((t) =>
                      t.id === activeTeam.id ? { ...t, weekendDuties: [...t.weekendDuties, newD] } : t,
                    );
                    persistDB({ ...db, teams: nextTeams });
                    toast.success('Added weekend/holiday duty slot');
                  }}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={13} /> Add Duty Slot
                </button>
              )}
            </div>

            {/* Duty Load Balance Barometer & Staff Drag Deck */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={15} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Duty Load Balance Deck
                  </span>
                  <span style={{ fontSize: '11px', background: '#ffffff', border: '1px solid var(--border-medium)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Max Policy: {activeTeam.config.maxDuty} duties/period
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  💡 Drag a staff card below to any Morning/Evening slot, or click the slot to assign
                </span>
              </div>

              {/* Staff Deck Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
                {activeTeam.members.map((m) => {
                  const cnt = dutyCounts[m.id] || 0;
                  const max = activeTeam.config.maxDuty || 2;
                  const pct = Math.min(100, Math.round((cnt / Math.max(1, max)) * 100));
                  const isOver = max > 0 && cnt > max;
                  const isMax = max > 0 && cnt === max;

                  let meterColor = '#16a34a'; // green
                  let meterBg = '#dcfce7';
                  let statusText = `${cnt}/${max} Duties`;
                  if (isOver) {
                    meterColor = '#dc2626'; // red
                    meterBg = '#fee2e2';
                    statusText = `${cnt}/${max} ⚠️ Over`;
                  } else if (isMax) {
                    meterColor = '#d97706'; // amber
                    meterBg = '#fef3c7';
                    statusText = `${cnt}/${max} Full`;
                  }

                  return (
                    <div
                      key={m.id}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedDutyMemberId(m.id);
                        e.dataTransfer.setData('text/plain', m.id);
                      }}
                      onDragEnd={() => setDraggedDutyMemberId(null)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isOver ? '1.5px solid #fca5a5' : isMax ? '1.5px solid #fde68a' : '1px solid var(--border-medium)',
                        background: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        cursor: 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        userSelect: 'none',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                      title="Drag to assign to a duty slot"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              background: 'var(--primary-surface)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '700',
                              fontSize: '11px',
                            }}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '650', fontSize: '12.5px', color: 'var(--text-primary)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.name}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: meterColor, background: meterBg, padding: '2px 6px', borderRadius: '4px' }}>
                          {cnt}
                        </span>
                      </div>

                      {/* Capacity Progress Bar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ width: '100%', height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: meterColor,
                              borderRadius: '3px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          <span>{m.grade || 'Staff'}</span>
                          <span style={{ fontWeight: '600', color: isOver ? '#dc2626' : 'var(--text-secondary)' }}>{statusText}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Duty Slots Grid */}
            {activeTeam.weekendDuties.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '10px', color: 'var(--text-muted)', background: '#fafbfc' }}>
                <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div style={{ fontSize: '13.5px', fontWeight: '600' }}>No Weekend or Holiday Duty Slots Defined</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>Click &quot;+ Add Duty Slot&quot; to assign staff to weekend or holiday duty coverages.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '14px' }}>
                {activeTeam.weekendDuties.map((w) => {
                  const dObj = w.date ? parseD(w.date) : new Date();
                  const dow = DOW[dObj.getDay()] || '';
                  const isHol = db.holidays.some((h) => h.date === w.date);
                  const autoCO = w.date ? nextWorkingDay(w.date, activeTeam.config.offDay, db.holidays) : '';

                  const morningMember = activeTeam.members.find((m) => m.id === w.morningId);
                  const eveningMember = activeTeam.members.find((m) => m.id === w.eveningId);

                  const isMorningHover = dutyDropHover?.id === w.id && dutyDropHover?.slot === 'morning';
                  const isEveningHover = dutyDropHover?.id === w.id && dutyDropHover?.slot === 'evening';

                  return (
                    <div
                      key={w.id}
                      style={{
                        background: '#ffffff',
                        border: isHol ? '1.5px solid #fecdd3' : '1px solid var(--border-medium)',
                        borderRadius: '10px',
                        padding: '14px',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {/* Top Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="date"
                            value={w.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id
                                  ? {
                                      ...t,
                                      weekendDuties: t.weekendDuties.map((x) => (x.id === w.id ? { ...x, date: val } : x)),
                                    }
                                  : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{
                              padding: '3px 6px',
                              borderRadius: '5px',
                              border: '1px solid var(--border-medium)',
                              fontSize: '12.5px',
                              fontWeight: '600',
                            }}
                          />
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: isHol ? '#ffe4e6' : '#f1f5f9',
                              color: isHol ? '#dc2626' : '#475569',
                            }}
                          >
                            {dow} {isHol && '· Holiday'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {autoCO && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                color: '#15803d',
                                background: '#dcfce7',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Auto Compensatory Off date"
                            >
                              ⚡ Auto-CO: {autoCO}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id
                                  ? { ...t, weekendDuties: t.weekendDuties.filter((x) => x.id !== w.id) }
                                  : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                              toast.success('Duty slot removed');
                            }}
                            className="btn btn-ghost"
                            style={{ color: '#dc2626', padding: '4px', borderRadius: '4px' }}
                            title="Remove Duty Slot"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Morning and Evening Drop Zones */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {/* Morning Slot */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!isMorningHover) setDutyDropHover({ id: w.id, slot: 'morning' });
                          }}
                          onDragLeave={() => setDutyDropHover(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            const mId = e.dataTransfer.getData('text/plain') || draggedDutyMemberId;
                            if (mId) handleDutyDrop(w.id, 'morning', mId);
                          }}
                          style={{
                            border: isMorningHover
                              ? '2px dashed var(--primary)'
                              : morningMember
                              ? '1px solid #fed7aa'
                              : '1.5px dashed var(--border-medium)',
                            background: isMorningHover
                              ? 'var(--primary-surface)'
                              : morningMember
                              ? '#fffbeb'
                              : '#fafbfc',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            transition: 'all 0.15s ease',
                            minHeight: '62px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Sun size={12} /> Morning Duty
                            </span>
                            {morningMember && (
                              <button
                                onClick={() => handleDutyDrop(w.id, 'morning', '')}
                                className="btn btn-ghost"
                                style={{ padding: '0 4px', fontSize: '11px', color: '#94a3b8', lineHeight: 1 }}
                                title="Clear Morning Duty"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          {morningMember ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '700',
                                  fontSize: '10px',
                                }}
                              >
                                {morningMember.name.charAt(0)}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '650', color: '#78350f', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {morningMember.name}
                              </span>
                            </div>
                          ) : (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleDutyDrop(w.id, 'morning', e.target.value);
                              }}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '11.5px',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              <option value="">📥 Drop staff or select...</option>
                              {activeTeam.members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({dutyCounts[m.id] || 0} duties)
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Evening Slot */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!isEveningHover) setDutyDropHover({ id: w.id, slot: 'evening' });
                          }}
                          onDragLeave={() => setDutyDropHover(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            const mId = e.dataTransfer.getData('text/plain') || draggedDutyMemberId;
                            if (mId) handleDutyDrop(w.id, 'evening', mId);
                          }}
                          style={{
                            border: isEveningHover
                              ? '2px dashed var(--primary)'
                              : eveningMember
                              ? '1px solid #ddd6fe'
                              : '1.5px dashed var(--border-medium)',
                            background: isEveningHover
                              ? 'var(--primary-surface)'
                              : eveningMember
                              ? '#f5f3ff'
                              : '#fafbfc',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            transition: 'all 0.15s ease',
                            minHeight: '62px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#6d28d9', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Moon size={12} /> Evening Duty
                            </span>
                            {eveningMember && (
                              <button
                                onClick={() => handleDutyDrop(w.id, 'evening', '')}
                                className="btn btn-ghost"
                                style={{ padding: '0 4px', fontSize: '11px', color: '#94a3b8', lineHeight: 1 }}
                                title="Clear Evening Duty"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>

                          {eveningMember ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: '#ede9fe',
                                  color: '#5b21b6',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '700',
                                  fontSize: '10px',
                                }}
                              >
                                {eveningMember.name.charAt(0)}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: '650', color: '#4c1d95', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {eveningMember.name}
                              </span>
                            </div>
                          ) : (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleDutyDrop(w.id, 'evening', e.target.value);
                              }}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '11.5px',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                outline: 'none',
                              }}
                            >
                              <option value="">📥 Drop staff or select...</option>
                              {activeTeam.members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({dutyCounts[m.id] || 0} duties)
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Search & Filter Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-surface)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={conditionStaffFilter}
                onChange={(e) => setConditionStaffFilter(e.target.value)}
                placeholder="🔍 Filter overrides, leaves & comp-offs by staff name..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 34px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '12.5px',
                  outline: 'none',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
              {conditionStaffFilter && (
                <button
                  onClick={() => setConditionStaffFilter('')}
                  style={{
                    position: 'absolute',
                    right: '9px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--text-muted)',
                  }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>
                Active Rules: <b>{activeTeam.wov.length + activeTeam.leaves.length + activeTeam.comps.length}</b> total
              </span>
              {conditionStaffFilter && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                  }}
                >
                  Filtering for &quot;{conditionStaffFilter}&quot;
                </span>
              )}
            </div>
          </div>

          {/* Weekday Shift Overrides, Leaves & Comp-Offs (3-Column Symmetrical Grid) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '18px', alignItems: 'stretch' }}>
            {/* 1. Weekday Overrides */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14.5px', fontWeight: '650', margin: 0, color: 'var(--text-primary)' }}>
                      Weekday Shift Overrides
                    </h3>
                    <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      {activeTeam.wov.length}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0', minHeight: '34px', lineHeight: 1.35 }}>
                    Force staff onto a specific shift for a date range (swaps, manager requests).
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={openWovWizard}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: '600' }}
                    title="Open Search & Multi-Select Override Wizard"
                  >
                    <Plus size={13} /> Override
                  </button>
                )}
              </div>

              {activeTeam.wov.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '10px', color: 'var(--text-muted)', background: '#fafbfc' }}>
                  <Clock size={22} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                  <div style={{ fontSize: '12.5px', fontWeight: '600' }}>No Shift Overrides Active</div>
                  <div style={{ fontSize: '11.5px', marginTop: '2px' }}>Click &quot;+ Override&quot; to assign custom shift overrides.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeTeam.wov
                    .filter((o) => {
                      if (!conditionStaffFilter) return true;
                      const mem = activeTeam.members.find((m) => m.id === o.memberId);
                      return mem?.name.toLowerCase().includes(conditionStaffFilter.toLowerCase());
                    })
                    .map((o) => {
                    const meta = SHIFT_META[o.shift] || SHIFT_META['G'];
                    return (
                      <div
                        key={o.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          padding: '12px 14px',
                          background: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium)',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}
                      >
                        {/* Top Row: Member + Shift + Delete */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <select
                              value={o.memberId}
                              onChange={(e) => {
                                const val = e.target.value;
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, wov: t.wov.map((x) => (x.id === o.id ? { ...x, memberId: val } : x)) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                              }}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12.5px',
                                fontWeight: '600',
                                height: '32px',
                                background: '#ffffff',
                                color: 'var(--text-primary)',
                                boxSizing: 'border-box',
                              }}
                            >
                              {activeTeam.members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>

                            <select
                              value={o.shift}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, wov: t.wov.map((x) => (x.id === o.id ? { ...x, shift: val } : x)) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                              }}
                              style={{
                                height: '32px',
                                padding: '0 8px',
                                borderRadius: '6px',
                                border: `1px solid ${meta.border}`,
                                background: meta.bg,
                                color: meta.color,
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              {WOV_SHIFTS.map((s) => (
                                <option key={s} value={s}>
                                  {s} · {SHIFT_META[s].label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {canManage && (
                            <button
                              onClick={() => {
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, wov: t.wov.filter((x) => x.id !== o.id) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                                toast.success('Override removed');
                              }}
                              className="btn btn-ghost"
                              style={{
                                color: '#dc2626',
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                cursor: 'pointer',
                              }}
                              title="Remove Override"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Bottom Row: Dates + Reason */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <input
                              type="date"
                              value={o.from}
                              onChange={(e) => {
                                const val = e.target.value;
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, wov: t.wov.map((x) => (x.id === o.id ? { ...x, from: val } : x)) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                              }}
                              style={{ height: '30px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#f8fafc', color: 'var(--text-secondary)', boxSizing: 'border-box' }}
                            />
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>→</span>
                            <input
                              type="date"
                              value={o.to}
                              onChange={(e) => {
                                const val = e.target.value;
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, wov: t.wov.map((x) => (x.id === o.id ? { ...x, to: val } : x)) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                              }}
                              style={{ height: '30px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#f8fafc', color: 'var(--text-secondary)', boxSizing: 'border-box' }}
                            />
                          </div>

                          <input
                            type="text"
                            value={o.reason}
                            placeholder="Reason / Approved by"
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id ? { ...t, wov: t.wov.map((x) => (x.id === o.id ? { ...x, reason: val } : x)) } : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{ flex: 1, minWidth: 0, height: '30px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Planned Leaves */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14.5px', fontWeight: '650', margin: 0, color: 'var(--text-primary)' }}>
                      Planned Leaves (L)
                    </h3>
                    <span style={{ fontSize: '11px', background: '#ffe4e6', color: '#e11d48', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      {activeTeam.leaves.length}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0', minHeight: '34px', lineHeight: 1.35 }}>
                    Marks member as &apos;L&apos; for all days in the date range (exempted from shifts).
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={openLeaveWizard}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: '600' }}
                    title="Open Search & Multi-Select Leave Wizard"
                  >
                    <Plus size={13} /> Leave
                  </button>
                )}
              </div>

              {activeTeam.leaves.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '10px', color: 'var(--text-muted)', background: '#fafbfc' }}>
                  <CalendarDays size={22} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                  <div style={{ fontSize: '12.5px', fontWeight: '600' }}>No Planned Leaves</div>
                  <div style={{ fontSize: '11.5px', marginTop: '2px' }}>Click &quot;+ Leave&quot; to record planned staff leaves or time off.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeTeam.leaves
                    .filter((l) => {
                      if (!conditionStaffFilter) return true;
                      const mem = activeTeam.members.find((m) => m.id === l.memberId);
                      return mem?.name.toLowerCase().includes(conditionStaffFilter.toLowerCase());
                    })
                    .map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px 14px',
                        background: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Top Row: Member + Badge + Delete */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <select
                            value={l.memberId}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id ? { ...t, leaves: t.leaves.map((x) => (x.id === l.id ? { ...x, memberId: val } : x)) } : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              height: '32px',
                              background: '#ffffff',
                              color: 'var(--text-primary)',
                              boxSizing: 'border-box',
                            }}
                          >
                            {activeTeam.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>

                          <span
                            style={{
                              height: '32px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            🌴 Leave (L)
                          </span>
                        </div>

                        {canManage && (
                          <button
                            onClick={() => {
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id ? { ...t, leaves: t.leaves.filter((x) => x.id !== l.id) } : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                              toast.success('Leave removed');
                            }}
                            className="btn btn-ghost"
                            style={{
                              color: '#dc2626',
                              width: '32px',
                              height: '32px',
                              padding: 0,
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              cursor: 'pointer',
                            }}
                            title="Remove Leave"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {/* Bottom Row: Dates + Reason */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <input
                            type="date"
                            value={l.from}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id ? { ...t, leaves: t.leaves.map((x) => (x.id === l.id ? { ...x, from: val } : x)) } : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{ height: '30px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#f8fafc', color: 'var(--text-secondary)', boxSizing: 'border-box' }}
                          />
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>→</span>
                          <input
                            type="date"
                            value={l.to}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id ? { ...t, leaves: t.leaves.map((x) => (x.id === l.id ? { ...x, to: val } : x)) } : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{ height: '30px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#f8fafc', color: 'var(--text-secondary)', boxSizing: 'border-box' }}
                          />
                        </div>

                        <input
                          type="text"
                          value={l.reason}
                          placeholder="Leave Reason (e.g. Vacation, Medical)"
                          onChange={(e) => {
                            const val = e.target.value;
                            const nextTeams = db.teams.map((t) =>
                              t.id === activeTeam.id ? { ...t, leaves: t.leaves.map((x) => (x.id === l.id ? { ...x, reason: val } : x)) } : t,
                            );
                            persistDB({ ...db, teams: nextTeams });
                          }}
                          style={{ flex: 1, minWidth: 0, height: '30px', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Manual Comp-Offs (CO) */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '14.5px', fontWeight: '650', margin: 0, color: 'var(--text-primary)' }}>
                      Comp-off (CO)
                    </h3>
                    <span style={{ fontSize: '11px', background: '#fef9c3', color: '#854d0e', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      {activeTeam.comps.length}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0', minHeight: '34px', lineHeight: 1.35 }}>
                    Manual comp-offs. Weekend/holiday duty adds its own CO automatically.
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={openCompWizard}
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: '600' }}
                    title="Open Search & Multi-Select Comp-Off Wizard"
                  >
                    <Plus size={13} /> Comp-off
                  </button>
                )}
              </div>

              {activeTeam.comps.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', textAlign: 'center', border: '1px dashed var(--border-medium)', borderRadius: '10px', color: 'var(--text-muted)', background: '#fafbfc' }}>
                  <Clock size={22} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                  <div style={{ fontSize: '12.5px', fontWeight: '600' }}>No Manual Comp-Offs</div>
                  <div style={{ fontSize: '11.5px', marginTop: '2px' }}>Click &quot;+ Comp-off&quot; to assign custom comp-offs.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeTeam.comps
                    .filter((c) => {
                      if (!conditionStaffFilter) return true;
                      const mem = activeTeam.members.find((m) => m.id === c.memberId);
                      return mem?.name.toLowerCase().includes(conditionStaffFilter.toLowerCase());
                    })
                    .map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px 14px',
                        background: '#ffffff',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Top Row: Member + Badge + Delete */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                          <select
                            value={c.memberId}
                            onChange={(e) => {
                              const val = e.target.value;
                              const nextTeams = db.teams.map((t) =>
                                t.id === activeTeam.id ? { ...t, comps: t.comps.map((x) => (x.id === c.id ? { ...x, memberId: val } : x)) } : t,
                              );
                              persistDB({ ...db, teams: nextTeams });
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              height: '32px',
                              background: '#ffffff',
                              color: 'var(--text-primary)',
                              boxSizing: 'border-box',
                            }}
                          >
                            {activeTeam.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>

                          <span
                            style={{
                              height: '32px',
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid #fef08a',
                              background: '#fefce8',
                              color: '#a16207',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ⭐ Comp-Off (CO)
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            const nextTeams = db.teams.map((t) =>
                              t.id === activeTeam.id ? { ...t, comps: t.comps.filter((x) => x.id !== c.id) } : t,
                            );
                            persistDB({ ...db, teams: nextTeams });
                            toast.success('Comp-off removed');
                          }}
                          className="btn btn-ghost"
                          style={{
                            color: '#dc2626',
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            cursor: 'pointer',
                          }}
                          title="Remove Comp-Off"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Bottom Row: Worked Date + CO Date */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>Worked:</span>
                            <input
                              type="date"
                              value={c.worked}
                              onChange={(e) => {
                                const val = e.target.value;
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, comps: t.comps.map((x) => (x.id === c.id ? { ...x, worked: val } : x)) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                              }}
                              style={{ width: '100%', height: '30px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#f8fafc', color: 'var(--text-secondary)', boxSizing: 'border-box' }}
                            />
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', flexShrink: 0 }}>→</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>CO Date:</span>
                            <input
                              type="date"
                              value={c.co}
                              onChange={(e) => {
                                const val = e.target.value;
                                const nextTeams = db.teams.map((t) =>
                                  t.id === activeTeam.id ? { ...t, comps: t.comps.map((x) => (x.id === c.id ? { ...x, co: val } : x)) } : t,
                                );
                                persistDB({ ...db, teams: nextTeams });
                              }}
                              style={{ width: '100%', height: '30px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '11.5px', background: '#f0fdf4', color: '#166534', fontWeight: '600', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: HISTORY & REVISIONS                                                */}
      {/* ========================================================================= */}
      {activeTab === 'history' && activeTeam && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '650', margin: '0 0 4px', color: 'var(--text-primary)' }}>
            Saved Rosters &amp; Audit Trail for {teamName(activeTeam)}
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Complete version history with revision trails and 1-click reopen &amp; export.
          </p>

          {activeTeam.rosters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', border: '1px dashed var(--border-medium)', borderRadius: '8px', color: 'var(--text-muted)' }}>
              No saved rosters yet. Go to <b>Generate Roster</b> and click <b>Save Roster</b>.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
              {activeTeam.rosters.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '16px',
                    background: '#ffffff',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {r.title}
                      </h4>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {r.startISO} → {r.endISO} ({r.days.length} days)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: '650',
                          background:
                            r.status === 'Published' ? '#e6f4ec' : r.status === 'Revised' ? '#fef3c7' : '#f1f5f9',
                          color:
                            r.status === 'Published' ? '#15803d' : r.status === 'Revised' ? '#b45309' : '#475569',
                        }}
                      >
                        {r.status}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        r{r.revision}
                      </span>
                    </div>
                  </div>

                  {/* Changelog preview */}
                  <div style={{ background: '#fafbfd', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 10px', fontSize: '11.5px', color: 'var(--text-secondary)', maxHeight: '90px', overflowY: 'auto', margin: '10px 0' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>Revision History:</div>
                    {(r.changelog || []).map((c, ci) => (
                      <div key={ci} style={{ padding: '2px 0' }}>
                        <code>r{c.revision}</code> · {new Date(c.at).toLocaleDateString()} — {c.note}
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                    <button
                      onClick={() => {
                        setCurrentRoster(JSON.parse(JSON.stringify(r)));
                        setActiveTab('generate');
                        toast.info(`Loaded ${r.title}`);
                      }}
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1 }}
                    >
                      {canManage ? 'Open & Edit' : 'View Schedule'}
                    </button>
                    <button
                      onClick={() => handleExportCsv(r)}
                      className="btn btn-sm btn-secondary"
                      title="Download CSV"
                    >
                      <FileSpreadsheet size={13} />
                    </button>
                    <button
                      onClick={() => handlePrintRoster(r)}
                      className="btn btn-sm btn-secondary"
                      title="Print Landscape Document"
                    >
                      <Printer size={13} />
                    </button>
                    {canManage && (
                      <button
                        onClick={() => {
                          if (!window.confirm(`Delete saved roster ${r.title}?`)) return;
                          const nextTeams = db.teams.map((t) =>
                            t.id === activeTeam.id ? { ...t, rosters: t.rosters.filter((x) => x.id !== r.id) } : t,
                          );
                          persistDB({ ...db, teams: nextTeams });
                          toast.success('Roster removed from history');
                        }}
                        className="btn btn-sm btn-danger"
                        title="Delete Roster"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PRODUCT / APPLICATION                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title="Register Product / Application"
        maxWidth="480px"
      >
        <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label">
              Associated Brand <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <select
              value={newProductBrandId}
              onChange={(e) => setNewProductBrandId(e.target.value)}
              className="form-select"
            >
              <option value="">Org-wide (All Brands)</option>
              {(brands || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '5px 0 0' }}>
              Assign this product to a specific brand or leave as Org-wide.
            </p>
          </div>

          <div>
            <label className="form-label">
              Product Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. MedBilling Core, Laboratory Engine"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="form-label">
              Description <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Brief description or support scope for this product..."
              value={newProductDesc}
              onChange={(e) => setNewProductDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setIsAddProductModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSavingProduct}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingProduct || !newProductName.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSavingProduct && <LoadingSpinner size={14} />}
              Create Product
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EDIT PRODUCT                                                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="Edit Product / Application"
        maxWidth="480px"
      >
        <form onSubmit={handleUpdateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label">
              Associated Brand <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <select
              value={editProductBrandId}
              onChange={(e) => setEditProductBrandId(e.target.value)}
              className="form-select"
            >
              <option value="">Org-wide (All Brands)</option>
              {(brands || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">
              Product Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={editProductName}
              onChange={(e) => setEditProductName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="form-label">
              Description <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              value={editProductDesc}
              onChange={(e) => setEditProductDesc(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="btn btn-secondary"
              disabled={isUpdatingProduct}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isUpdatingProduct || !editProductName.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isUpdatingProduct && <LoadingSpinner size={14} />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: MULTI-MEMBER CONDITION WIZARD (Overrides, Leaves, Comp-Offs)       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!conditionWizardType}
        onClose={() => setConditionWizardType(null)}
        title={
          conditionWizardType === 'wov'
            ? '⚡ Assign Weekday Shift Override'
            : conditionWizardType === 'leave'
            ? '🌴 Record Planned Leaves (L)'
            : '⭐ Assign Manual Comp-Off (CO)'
        }
        maxWidth="680px"
      >
        <form onSubmit={handleApplyConditionWizard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Info Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background:
                conditionWizardType === 'wov'
                  ? '#eff6ff'
                  : conditionWizardType === 'leave'
                  ? '#ecfdf5'
                  : '#fefce8',
              border:
                conditionWizardType === 'wov'
                  ? '1px solid #bfdbfe'
                  : conditionWizardType === 'leave'
                  ? '1px solid #a7f3d0'
                  : '1px solid #fef08a',
              color:
                conditionWizardType === 'wov'
                  ? '#1e40af'
                  : conditionWizardType === 'leave'
                  ? '#065f46'
                  : '#854d0e',
              fontSize: '12.5px',
              lineHeight: 1.4,
            }}
          >
            {conditionWizardType === 'wov' && (
              <span>Select one or multiple staff members and choose the forced weekday shift and effective dates.</span>
            )}
            {conditionWizardType === 'leave' && (
              <span>Select one or multiple staff members who will be on approved leave (exempted from all shift rotations).</span>
            )}
            {conditionWizardType === 'comp' && (
              <span>Select staff members to grant manual compensatory off (CO) for hours worked.</span>
            )}
          </div>

          {/* Member Selection Section with Search & Select All */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>
                Select Team Members <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeTeam) {
                      setWizardSelectedMemberIds(activeTeam.members.map((m) => m.id));
                    }
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: '11px', padding: '2px 8px', height: '24px' }}
                >
                  Select All ({activeTeam?.members.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setWizardSelectedMemberIds([])}
                  className="btn btn-ghost"
                  style={{ fontSize: '11px', padding: '2px 8px', height: '24px', color: 'var(--text-muted)' }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Member Search Bar */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={wizardMemberSearch}
                onChange={(e) => setWizardMemberSearch(e.target.value)}
                placeholder="Search staff by name or keyword..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {wizardMemberSearch && (
                <button
                  type="button"
                  onClick={() => setWizardMemberSearch('')}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Member Chips Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '8px',
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '6px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {activeTeam?.members
                .filter((m) => !wizardMemberSearch || m.name.toLowerCase().includes(wizardMemberSearch.toLowerCase()))
                .map((m) => {
                  const isSelected = wizardSelectedMemberIds.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        setWizardSelectedMemberIds((prev) =>
                          isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: isSelected ? '1.5px solid #3b82f6' : '1px solid var(--border-medium)',
                        boxShadow: isSelected ? '0 1px 3px rgba(59,130,246,0.15)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: isSelected ? '#3b82f6' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '11px',
                          flexShrink: 0,
                        }}
                      >
                        {m.name.charAt(0)}
                      </div>
                      <span
                        style={{
                          fontSize: '12.5px',
                          fontWeight: isSelected ? '650' : '500',
                          color: isSelected ? '#1d4ed8' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {m.name}
                      </span>
                    </div>
                  );
                })}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
              Selected: <b>{wizardSelectedMemberIds.length}</b> of {activeTeam?.members.length || 0} staff
            </div>
          </div>

          {/* Specific Condition Configuration Fields */}
          {conditionWizardType === 'wov' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label">Forced Shift</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                  {WOV_SHIFTS.map((s) => {
                    const meta = SHIFT_META[s];
                    const isPicked = wizardShift === s;
                    return (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setWizardShift(s)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isPicked ? `2px solid ${meta.color}` : '1px solid var(--border-medium)',
                          background: isPicked ? meta.bg : '#ffffff',
                          color: meta.color,
                          fontWeight: '700',
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>{s}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: '500', opacity: 0.85 }}>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wizardFromDate}
                    onChange={(e) => setWizardFromDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wizardToDate}
                    onChange={(e) => setWizardToDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Reason / Notes</label>
                <input
                  type="text"
                  className="form-control"
                  value={wizardReason}
                  onChange={(e) => setWizardReason(e.target.value)}
                  placeholder="e.g. Shift swap request, Client cover, Tier escalation"
                />
              </div>
            </div>
          )}

          {conditionWizardType === 'leave' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wizardFromDate}
                    onChange={(e) => setWizardFromDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wizardToDate}
                    onChange={(e) => setWizardToDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Leave Reason / Type</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  {['Annual Leave', 'Casual Leave', 'Medical Leave', 'Festival Off', 'Personal'].map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setWizardReason(r)}
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: wizardReason === r ? '#eff6ff' : '#f1f5f9', color: wizardReason === r ? '#1d4ed8' : 'var(--text-secondary)' }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="form-control"
                  value={wizardReason}
                  onChange={(e) => setWizardReason(e.target.value)}
                  placeholder="Leave details or approved reason"
                  required
                />
              </div>
            </div>
          )}

          {conditionWizardType === 'comp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="form-label">Worked Date (Extra Day)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wizardWorkedDate}
                    onChange={(e) => setWizardWorkedDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Comp-Off (CO) Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={wizardCoDate}
                    onChange={(e) => setWizardCoDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <button
              type="button"
              onClick={() => setConditionWizardType(null)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={wizardSelectedMemberIds.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={14} />
              Apply for {wizardSelectedMemberIds.length} {wizardSelectedMemberIds.length === 1 ? 'Staff Member' : 'Staff Members'}
            </button>
          </div>
        </form>
      </Modal>
        </div>
      </div>
    </div>
  );
};
