import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Settings,
  Users,
  Key,
  Webhook,
  Shield,
  UserPlus,
  UserCheck,
  Search,
  X,
  Plus,
  Code,
  Copy,
  Check,
  Sparkles,
  Palette,
  Trash2,
  Edit,
  RotateCw,
  Power,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Tag as TagIcon,
  Folder,
  Building2,
  Box,
  ChevronDown,
  Monitor,
  ShieldCheck,
  Layers,
  Activity,
  Globe,
  ExternalLink,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  FileSpreadsheet,
  CheckSquare,
  Square,
  FileUp,
  Filter,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ActionNoteBox, ActionNoteViewer } from '../components/common/ActionNoteBox';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSearch } from '../context/SearchContext';
import { THEME_PRESETS, applyPrimaryTheme } from '../styles/theme-utils';

declare const __CONSOLE_HOST__: string;

export const AdminPage: React.FC = () => {
  const { activeBrandId, brands, reloadBrands } = useAuth();
  const toast = useToast();
  const { debouncedSearchQuery, setSearchQuery } = useSearch();
  const [activeTab, setActiveTab] = useState<
    'brands' | 'widget' | 'organizations' | 'tags' | 'categories' | 'teams' | 'users' | 'customers' | 'sso'
  >('brands');
  const [selectedThemeColor, setSelectedThemeColor] = useState(
    () => localStorage.getItem('abidesk_theme_color') || '#2563eb',
  );

  // Organizations State
  const [organizationsList, setOrganizationsList] = useState<any[]>([]);
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any | null>(null);
  const [orgName, setOrgName] = useState('');
  const [orgDomainList, setOrgDomainList] = useState<string[]>([]);
  const [orgDomainInput, setOrgDomainInput] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgContactName, setOrgContactName] = useState('');
  const [orgContactEmail, setOrgContactEmail] = useState('');
  const [orgContactPhone, setOrgContactPhone] = useState('');
  const [orgProduct, setOrgProduct] = useState('');
  const [isOrgProductOpen, setIsOrgProductOpen] = useState(false);
  const [orgProductSearch, setOrgProductSearch] = useState('');
  const orgProductDropdownRef = useRef<HTMLDivElement>(null);
  const orgProductSearchRef = useRef<HTMLInputElement>(null);
  const [isOrgSubmitting, setIsOrgSubmitting] = useState(false);
  const [expandedOrgDomainIds, setExpandedOrgDomainIds] = useState<Set<string>>(new Set());
  const [orgSearchText, setOrgSearchText] = useState('');
  const [orgViewMode, setOrgViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('abidesk_org_view_mode') as 'list' | 'grid') || 'grid';
  });
  const [orgPage, setOrgPage] = useState(1);
  const [orgPageSize, setOrgPageSize] = useState(10);
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [isOrgImportModalOpen, setIsOrgImportModalOpen] = useState(false);
  const [isOrgBulkDeleting, setIsOrgBulkDeleting] = useState(false);
  const [selectedOrgProductFilter, setSelectedOrgProductFilter] = useState<string>('ALL');
  const [orgImportFile, setOrgImportFile] = useState<File | null>(null);
  const [orgImportPreview, setOrgImportPreview] = useState<any[]>([]);
  const [orgImportSearchText, setOrgImportSearchText] = useState('');
  const [isOrgImporting, setIsOrgImporting] = useState(false);

  // Tags State
  const [tagsList, setTagsList] = useState<any[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [tagDomainList, setTagDomainList] = useState<string[]>([]);
  const [tagDomainInput, setTagDomainInput] = useState('');
  const [tagOrganization, setTagOrganization] = useState('');
  const [tagProducts, setTagProducts] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [isTagSubmitting, setIsTagSubmitting] = useState(false);
  const [expandedTagDomainIds, setExpandedTagDomainIds] = useState<Set<string>>(new Set());
  const [tagSearchText, setTagSearchText] = useState('');
  const [tagViewMode, setTagViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('abidesk_tag_view_mode') as 'list' | 'grid') || 'grid';
  });
  const [tagPage, setTagPage] = useState(1);
  const [tagPageSize, setTagPageSize] = useState(10);

  // Tag Modal Dropdown States
  const [isTagOrgOpen, setIsTagOrgOpen] = useState(false);
  const [tagOrgSearch, setTagOrgSearch] = useState('');
  const tagOrgDropdownRef = useRef<HTMLDivElement>(null);
  const tagOrgSearchRef = useRef<HTMLInputElement>(null);

  const [isTagProductOpen, setIsTagProductOpen] = useState(false);
  const [tagProductSearch, setTagProductSearch] = useState('');
  const tagProductDropdownRef = useRef<HTMLDivElement>(null);
  const tagProductSearchRef = useRef<HTMLInputElement>(null);

  // Categories State
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#6366f1');
  const [categoryKeywordList, setCategoryKeywordList] = useState<string[]>([]);
  const [categoryKeywordInput, setCategoryKeywordInput] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [expandedCategoryKeywordIds, setExpandedCategoryKeywordIds] = useState<Set<string>>(new Set());
  const [catSearchText, setCatSearchText] = useState('');
  const [catViewMode, setCatViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('abidesk_cat_view_mode') as 'list' | 'grid') || 'grid';
  });
  const [catPage, setCatPage] = useState(1);
  const [catPageSize, setCatPageSize] = useState(10);

  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [ssoProviders, setSsoProviders] = useState<any[]>([]);
  const [isCreateSsoOpen, setIsCreateSsoOpen] = useState(false);
  const [isEditingSso, setIsEditingSso] = useState(false);
  const [ssoProviderType, setSsoProviderType] = useState<'OIDC' | 'SAML'>('OIDC');
  const [ssoDisplayName, setSsoDisplayName] = useState('');
  const [ssoIssuer, setSsoIssuer] = useState('');
  const [ssoClientId, setSsoClientId] = useState('');
  const [ssoClientSecret, setSsoClientSecret] = useState('');
  const [ssoAuthorizationUrl, setSsoAuthorizationUrl] = useState('');
  const [ssoTokenUrl, setSsoTokenUrl] = useState('');
  const [ssoUserinfoUrl, setSsoUserinfoUrl] = useState('');
  const [ssoJwksUri, setSsoJwksUri] = useState('');
  const [ssoSamlUrl, setSsoSamlUrl] = useState('');
  const [ssoSamlCert, setSsoSamlCert] = useState('');
  const [ssoDomains, setSsoDomains] = useState('');
  const [ssoJit, setSsoJit] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(true);
  const [useGoogleDefaults, setUseGoogleDefaults] = useState(true);
  const [activeBrand, setActiveBrand] = useState<any | null>(null);
  const [widgetConfig, setWidgetConfig] = useState<any | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [queuesList, setQueuesList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  // Memoized search-filtered lists for each tab
  const filteredBrands = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return brandsList;
    const query = debouncedSearchQuery.toLowerCase();
    return brandsList.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.slug.toLowerCase().includes(query) ||
        (b.supportEmail && b.supportEmail.toLowerCase().includes(query)) ||
        (b.portalDomain && b.portalDomain.toLowerCase().includes(query)),
    );
  }, [brandsList, debouncedSearchQuery]);

  const filteredSsoProviders = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return ssoProviders;
    const query = debouncedSearchQuery.toLowerCase();
    return ssoProviders.filter(
      (p) =>
        p.displayName.toLowerCase().includes(query) ||
        p.protocol.toLowerCase().includes(query) ||
        (p.issuer && p.issuer.toLowerCase().includes(query)) ||
        p.emailDomains.some((d: string) => d.toLowerCase().includes(query)),
    );
  }, [ssoProviders, debouncedSearchQuery]);

  // Helper to generate consistent badges & colors for ANY product name (dynamic or future)
  const getProductBadgeStyle = (product: string | null | undefined) => {
    if (!product || !product.trim()) return null;
    const clean = product.trim();
    const lower = clean.toLowerCase();
    if (lower === 'claimbook') {
      return { bg: 'rgba(37, 99, 235, 0.12)', color: '#2563eb', border: 'rgba(37, 99, 235, 0.3)', icon: '🛡️' };
    }
    if (lower === 'lims') {
      return { bg: 'rgba(5, 150, 105, 0.12)', color: '#059669', border: 'rgba(5, 150, 105, 0.3)', icon: '🧪' };
    }
    if (lower === 'his') {
      return { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.3)', icon: '🏥' };
    }
    if (lower.includes('pharmacy') || lower.includes('rx')) {
      return { bg: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', border: 'rgba(124, 58, 237, 0.3)', icon: '💊' };
    }
    if (lower.includes('emr') || lower.includes('ehr')) {
      return { bg: 'rgba(8, 145, 178, 0.12)', color: '#0891b2', border: 'rgba(8, 145, 178, 0.3)', icon: '📋' };
    }
    if (lower.includes('lab') || lower.includes('diag')) {
      return { bg: 'rgba(13, 148, 136, 0.12)', color: '#0d9488', border: 'rgba(13, 148, 136, 0.3)', icon: '🔬' };
    }
    if (lower.includes('bill') || lower.includes('pay') || lower.includes('finance')) {
      return { bg: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', border: 'rgba(22, 163, 74, 0.3)', icon: '💳' };
    }
    // Deterministic color generation for any dynamic custom product
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash % 360);
    return {
      bg: `hsla(${hue}, 70%, 50%, 0.12)`,
      color: `hsl(${hue}, 75%, 42%)`,
      border: `hsla(${hue}, 70%, 50%, 0.3)`,
      icon: '📦',
    };
  };

  // Dynamically extract all distinct products from organizationsList and availableProducts master list
  const dynamicOrgProductTabs = React.useMemo(() => {
    const productCounts: Record<string, number> = {};
    let unassignedCount = 0;

    for (const org of organizationsList) {
      if (org.product && org.product.trim()) {
        const prod = org.product.trim();
        productCounts[prod] = (productCounts[prod] || 0) + 1;
      } else {
        unassignedCount++;
      }
    }

    const tabs: Array<{ id: string; label: string; count: number; color: string; icon?: string }> = [
      { id: 'ALL', label: 'All Products', count: organizationsList.length, color: 'var(--primary, #2563eb)', icon: '🏢' },
    ];

    // Only add distinct products that have at least 1 organization assigned (count > 0)
    const sortedProductNames = Object.keys(productCounts)
      .filter((pName) => productCounts[pName] > 0)
      .sort((a, b) => {
        if (productCounts[b] !== productCounts[a]) {
          return productCounts[b] - productCounts[a];
        }
        return a.localeCompare(b);
      });

    for (const prodName of sortedProductNames) {
      const style = getProductBadgeStyle(prodName);
      tabs.push({
        id: prodName,
        label: prodName,
        count: productCounts[prodName],
        color: style?.color || 'var(--primary, #2563eb)',
        icon: style?.icon || '📦',
      });
    }

    if (unassignedCount > 0) {
      tabs.push({
        id: '__UNASSIGNED__',
        label: 'Unassigned',
        count: unassignedCount,
        color: 'var(--text-muted, #64748b)',
        icon: '⚪',
      });
    }

    return tabs;
  }, [organizationsList]);

  const filteredOrganizations = React.useMemo(() => {
    const rawQ = (orgSearchText.trim() || debouncedSearchQuery.trim()).toLowerCase();
    return organizationsList.filter((o: any) => {
      // Dynamic Product Filter
      if (selectedOrgProductFilter !== 'ALL') {
        if (selectedOrgProductFilter === '__UNASSIGNED__') {
          if (o.product && o.product.trim()) return false;
        } else {
          if (o.product?.trim() !== selectedOrgProductFilter) return false;
        }
      }

      // Search Query
      if (!rawQ) return true;
      return (
        o.name?.toLowerCase().includes(rawQ) ||
        o.slug?.toLowerCase().includes(rawQ) ||
        (o.domains && o.domains.toLowerCase().includes(rawQ)) ||
        (o.description && o.description.toLowerCase().includes(rawQ)) ||
        (o.website && o.website.toLowerCase().includes(rawQ)) ||
        (o.contactName && o.contactName.toLowerCase().includes(rawQ)) ||
        (o.contactEmail && o.contactEmail.toLowerCase().includes(rawQ)) ||
        (o.contactPhone && o.contactPhone.toLowerCase().includes(rawQ)) ||
        (o.product && o.product.toLowerCase().includes(rawQ))
      );
    });
  }, [organizationsList, orgSearchText, debouncedSearchQuery, selectedOrgProductFilter]);

  const totalOrgPages = Math.ceil(filteredOrganizations.length / orgPageSize) || 1;
  const paginatedOrganizations = React.useMemo(() => {
    const validPage = Math.min(Math.max(1, orgPage), totalOrgPages);
    const startIndex = (validPage - 1) * orgPageSize;
    return filteredOrganizations.slice(startIndex, startIndex + orgPageSize);
  }, [filteredOrganizations, orgPage, orgPageSize, totalOrgPages]);

  React.useEffect(() => {
    if (orgPage > totalOrgPages) {
      setOrgPage(Math.max(1, totalOrgPages));
    }
  }, [orgPage, totalOrgPages]);

  const handleSetOrgViewMode = (mode: 'list' | 'grid') => {
    setOrgViewMode(mode);
    localStorage.setItem('abidesk_org_view_mode', mode);
  };


  const filteredTags = React.useMemo(() => {
    const rawQ = (tagSearchText.trim() || debouncedSearchQuery.trim()).toLowerCase();
    if (!rawQ) return tagsList;
    return tagsList.filter(
      (t: any) =>
        t.name?.toLowerCase().includes(rawQ) ||
        t.slug?.toLowerCase().includes(rawQ) ||
        (t.domains && t.domains.toLowerCase().includes(rawQ)) ||
        (t.organization && t.organization.toLowerCase().includes(rawQ)) ||
        (t.product && t.product.toLowerCase().includes(rawQ)),
    );
  }, [tagsList, tagSearchText, debouncedSearchQuery]);

  const totalTagPages = Math.ceil(filteredTags.length / tagPageSize) || 1;
  const paginatedTags = React.useMemo(() => {
    const validPage = Math.min(Math.max(1, tagPage), totalTagPages);
    const startIndex = (validPage - 1) * tagPageSize;
    return filteredTags.slice(startIndex, startIndex + tagPageSize);
  }, [filteredTags, tagPage, tagPageSize, totalTagPages]);

  React.useEffect(() => {
    if (tagPage > totalTagPages) {
      setTagPage(Math.max(1, totalTagPages));
    }
  }, [tagPage, totalTagPages]);

  const handleSetTagViewMode = (mode: 'list' | 'grid') => {
    setTagViewMode(mode);
    localStorage.setItem('abidesk_tag_view_mode', mode);
  };

  const filteredCategories = React.useMemo(() => {
    const rawQ = (catSearchText.trim() || debouncedSearchQuery.trim()).toLowerCase();
    if (!rawQ) return categoriesList;
    return categoriesList.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(rawQ) ||
        c.slug?.toLowerCase().includes(rawQ) ||
        (c.keywords && c.keywords.toLowerCase().includes(rawQ)) ||
        (c.description && c.description.toLowerCase().includes(rawQ)),
    );
  }, [categoriesList, catSearchText, debouncedSearchQuery]);

  const totalCatPages = Math.ceil(filteredCategories.length / catPageSize) || 1;
  const paginatedCategories = React.useMemo(() => {
    const validPage = Math.min(Math.max(1, catPage), totalCatPages);
    const startIndex = (validPage - 1) * catPageSize;
    return filteredCategories.slice(startIndex, startIndex + catPageSize);
  }, [filteredCategories, catPage, catPageSize, totalCatPages]);

  React.useEffect(() => {
    if (catPage > totalCatPages) {
      setCatPage(Math.max(1, totalCatPages));
    }
  }, [catPage, totalCatPages]);

  const handleSetCatViewMode = (mode: 'list' | 'grid') => {
    setCatViewMode(mode);
    localStorage.setItem('abidesk_cat_view_mode', mode);
  };



  const filteredTeams = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return teams;
    const query = debouncedSearchQuery.toLowerCase();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)),
    );
  }, [teams, debouncedSearchQuery]);

  const filteredQueues = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return queuesList;
    const query = debouncedSearchQuery.toLowerCase();
    return queuesList.filter(
      (q) =>
        q.name.toLowerCase().includes(query) ||
        q.slug.toLowerCase().includes(query) ||
        (q.routing && q.routing.toLowerCase().includes(query)) ||
        (q.team?.name && q.team.name.toLowerCase().includes(query)) ||
        (q.brand?.name && q.brand.name.toLowerCase().includes(query)),
    );
  }, [queuesList, debouncedSearchQuery]);

  const [staffSearchText, setStaffSearchText] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('ALL');

  // Helper to distinguish Guest/Customer users from Staff members
  const isCustomerUser = (u: any) => {
    if (!u) return false;
    if (u.kind === 'CUSTOMER' || u.kind === 'SYSTEM') return true;
    if (u.kind === 'STAFF') return false;
    const roleKey = u.roles?.[0]?.role?.key || '';
    const roleName = (u.roles?.[0]?.role?.name || '').toLowerCase();
    if (roleKey === 'GUEST_CUSTOMER' || roleKey === 'CUSTOMER' || roleKey === 'GUEST') return true;
    if (roleName.includes('guest') || roleName.includes('customer')) return true;
    return false;
  };

  const isStaffUser = (u: any) => {
    if (!u) return false;
    if (u.kind === 'CUSTOMER' || u.kind === 'SYSTEM') return false;
    if (u.kind === 'STAFF') return true;
    return !isCustomerUser(u);
  };

  const totalStaffCount = React.useMemo(() => usersList.filter(isStaffUser).length, [usersList]);
  const totalCustomerCount = React.useMemo(() => usersList.filter(isCustomerUser).length, [usersList]);

  const filteredStaffUsers = React.useMemo(() => {
    const globalQ = debouncedSearchQuery.trim().toLowerCase();
    const localQ = staffSearchText.trim().toLowerCase();
    const query = localQ || globalQ;

    return usersList.filter((u) => {
      if (!isStaffUser(u)) return false;
      const roleName = u.roles?.[0]?.role?.name || '';
      const tier = u.roles?.[0]?.role?.tier || '';
      const status = u.status || '';

      if (staffRoleFilter !== 'ALL') {
        const rKey = u.roles?.[0]?.role?.key || '';
        if (staffRoleFilter === 'ADMIN' && !roleName.toLowerCase().includes('admin') && rKey !== 'TENANT_ADMIN') return false;
        if (staffRoleFilter === 'L1' && tier !== 'L1' && !roleName.toLowerCase().includes('l1')) return false;
        if (staffRoleFilter === 'L2' && tier !== 'L2' && !roleName.toLowerCase().includes('l2')) return false;
        if (staffRoleFilter === 'L3' && tier !== 'L3' && !roleName.toLowerCase().includes('l3')) return false;
        if (staffRoleFilter === 'DEV' && tier !== 'DEV' && !roleName.toLowerCase().includes('dev')) return false;
        if (staffRoleFilter === 'DEVOPS' && tier !== 'DEVOPS' && !roleName.toLowerCase().includes('devops') && !roleName.toLowerCase().includes('infra')) return false;
        if (staffRoleFilter === 'QA' && tier !== 'QA' && !roleName.toLowerCase().includes('qa')) return false;
      }

      if (staffStatusFilter !== 'ALL') {
        if (staffStatusFilter === 'ACTIVE' && status !== 'ACTIVE') return false;
        if (staffStatusFilter === 'SUSPENDED' && status !== 'SUSPENDED') return false;
      }

      if (!query) return true;
      return (
        u.fullName?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        roleName.toLowerCase().includes(query) ||
        tier.toLowerCase().includes(query)
      );
    });
  }, [usersList, debouncedSearchQuery, staffSearchText, staffRoleFilter, staffStatusFilter]);

  const filteredCustomerUsers = React.useMemo(() => {
    const globalQ = debouncedSearchQuery.trim().toLowerCase();
    const localQ = customerSearchText.trim().toLowerCase();
    const query = localQ || globalQ;

    return usersList.filter((u) => {
      if (!isCustomerUser(u)) return false;
      const status = u.status || '';

      if (customerStatusFilter !== 'ALL') {
        if (customerStatusFilter === 'ACTIVE' && status !== 'ACTIVE') return false;
        if (customerStatusFilter === 'SUSPENDED' && status !== 'SUSPENDED') return false;
      }

      if (!query) return true;
      const roleName = u.roles?.[0]?.role?.name || '';
      return (
        u.fullName?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        roleName.toLowerCase().includes(query)
      );
    });
  }, [usersList, debouncedSearchQuery, customerSearchText, customerStatusFilter]);

  const [isLoading, setIsLoading] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Modals visibility state
  const [isCreateBrandOpen, setIsCreateBrandOpen] = useState(false);
  const [isEditBrandOpen, setIsEditBrandOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isCreateQueueOpen, setIsCreateQueueOpen] = useState(false);

  // Manage Team Members State
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState<any | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isDragOverDropZone, setIsDragOverDropZone] = useState(false);
  const [draggedStaffId, setDraggedStaffId] = useState<string | null>(null);
  const [isAddingMemberLoading, setIsAddingMemberLoading] = useState(false);

  const availableStaff = React.useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    const assignedIds = new Set((selectedTeamForMembers?.members || []).map((m: any) => m.userId || m.user?.id));
    return (usersList || []).filter((u) => {
      if (!isStaffUser(u) || u.kind !== 'STAFF') return false;
      if (assignedIds.has(u.id)) return false;
      if (!q) return true;
      const name = (u.fullName || u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [usersList, selectedTeamForMembers, memberSearchQuery]);

  // Edit Staff Role Form
  const [editingStaffUser, setEditingStaffUser] = useState<any | null>(null);
  const [editStaffRoleId, setEditStaffRoleId] = useState('');
  const [editStaffBrandId, setEditStaffBrandId] = useState('');
  const [isUpdatingStaffRole, setIsUpdatingStaffRole] = useState(false);

  // Form states
  // Brand Form
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [brandName, setBrandName] = useState('');
  const [brandSlug, setBrandSlug] = useState('');
  const [brandSupportEmail, setBrandSupportEmail] = useState('');
  const [brandPortalDomain, setBrandPortalDomain] = useState('');
  const [brandTimezone, setBrandTimezone] = useState('Asia/Kolkata');
  const [brandLocale, setBrandLocale] = useState('en');
  const [brandIsDefault, setBrandIsDefault] = useState(false);

  // Widget Config Form
  const [isWidgetSaving, setIsWidgetSaving] = useState(false);
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [screenshotEnabled, setScreenshotEnabled] = useState(true);
  const [annotationEnabled, setAnnotationEnabled] = useState(true);
  const [screenRecordingEnabled, setScreenRecordingEnabled] = useState(true);
  const [voiceRecordingEnabled, setVoiceRecordingEnabled] = useState(true);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);
  const [consoleCaptureEnabled, setConsoleCaptureEnabled] = useState(true);
  const [networkCaptureEnabled, setNetworkCaptureEnabled] = useState(true);
  const [errorCaptureEnabled, setErrorCaptureEnabled] = useState(true);
  const [liveChatEnabled, setLiveChatEnabled] = useState(true);
  const [anonymousTicketsEnabled, setAnonymousTicketsEnabled] = useState(true);
  const [launcherLabel, setLauncherLabel] = useState('Support');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [privacyNotice, setPrivacyNotice] = useState('');
  const [newSecretVal, setNewSecretVal] = useState<string | null>(null);
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [adminWidgetEnabled, setAdminWidgetEnabled] = useState(true);

  // Team Form
  const [teamName, setTeamName] = useState('');
  const [teamSlug, setTeamSlug] = useState('');
  const [teamTier, setTeamTier] = useState('L1');
  const [teamDescription, setTeamDescription] = useState('');

  // Queue Form
  const [queueName, setQueueName] = useState('');
  const [queueSlug, setQueueSlug] = useState('');
  const [queueTier, setQueueTier] = useState('L1');
  const [queueTeamId, setQueueTeamId] = useState('');
  const [queueBrandId, setQueueBrandId] = useState('');
  const [queueRouting, setQueueRouting] = useState('LEAST_LOADED');
  const [queueIsDefault, setQueueIsDefault] = useState(false);

  // Invite User Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteBrandId, setInviteBrandId] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab, activeBrandId]);

  useEffect(() => {
    if (selectedTeamForMembers && usersList.length === 0) {
      ApiClient.get('/admin/users')
        .then((res: any) => setUsersList(res?.users || res || []))
        .catch((e) => console.warn('Failed to load users for modal', e));
    }
  }, [selectedTeamForMembers]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'brands') {
        const res = await ApiClient.get('/admin/brands');
        setBrandsList(res || []);
        if (activeBrandId) {
          const detail = await ApiClient.get(`/admin/brands/${activeBrandId}`);
          setActiveBrand(detail);
          if (detail.primaryColor) {
            setSelectedThemeColor(detail.primaryColor);
            applyPrimaryTheme(detail.primaryColor);
            localStorage.setItem('abidesk_theme_color', detail.primaryColor);
          }
        }
      } else if (activeTab === 'widget') {
        const res = await ApiClient.get('/admin/brands');
        setBrandsList(res || []);
        if (activeBrandId) {
          const detail = await ApiClient.get(`/admin/brands/${activeBrandId}`);
          setActiveBrand(detail);
          if (detail.widgetConfig) {
            setWidgetConfig(detail.widgetConfig);
            setWidgetEnabled(detail.widgetConfig.widgetEnabled ?? true);
            setAdminWidgetEnabled(detail.widgetConfig.adminWidgetEnabled ?? true);
            setAllowedOrigins(detail.widgetConfig.allowedOrigins || []);
            setScreenshotEnabled(detail.widgetConfig.screenshotEnabled);
            setAnnotationEnabled(detail.widgetConfig.annotationEnabled);
            setScreenRecordingEnabled(detail.widgetConfig.screenRecordingEnabled);
            setVoiceRecordingEnabled(detail.widgetConfig.voiceRecordingEnabled);
            setAttachmentsEnabled(detail.widgetConfig.attachmentsEnabled);
            setConsoleCaptureEnabled(detail.widgetConfig.consoleCaptureEnabled);
            setNetworkCaptureEnabled(detail.widgetConfig.networkCaptureEnabled);
            setErrorCaptureEnabled(detail.widgetConfig.errorCaptureEnabled);
            setLiveChatEnabled(detail.widgetConfig.liveChatEnabled);
            setAnonymousTicketsEnabled(detail.widgetConfig.anonymousTicketsEnabled);
            setLauncherLabel(detail.widgetConfig.launcherLabel || 'Support');
            setWelcomeMessage(detail.widgetConfig.welcomeMessage || '');
            setPrivacyNotice(detail.widgetConfig.privacyNotice || '');
          } else {
            setWidgetEnabled(true);
            setAdminWidgetEnabled(true);
          }
        }
      } else if (activeTab === 'teams') {
        const [teamsData, queuesData, brandsData, usersData] = await Promise.all([
          ApiClient.get('/admin/teams'),
          ApiClient.get('/admin/queues'),
          ApiClient.get('/admin/brands'),
          ApiClient.get('/admin/users'),
        ]);
        setTeams(teamsData || []);
        setQueuesList(queuesData || []);
        setBrandsList(brandsData || []);
        setUsersList(usersData?.users || usersData || []);
      } else if (activeTab === 'users' || activeTab === 'customers') {
        const [usersData, rolesData, brandsData] = await Promise.all([
          ApiClient.get('/admin/users'),
          ApiClient.get('/admin/roles'),
          ApiClient.get('/admin/brands'),
        ]);
        setUsersList(usersData?.users || usersData || []);
        setRoles(rolesData || []);
        setBrandsList(brandsData || []);
      } else if (activeTab === 'organizations') {
        const [orgsData, productsData] = await Promise.all([
          ApiClient.get('/organizations').catch(() => []),
          ApiClient.get('/admin/roster/products').catch(() => []),
        ]);
        setOrganizationsList(Array.isArray(orgsData) ? orgsData : []);
        setAvailableProducts(Array.isArray(productsData) ? productsData : []);
      } else if (activeTab === 'tags') {
        const [tagsData, productsData, orgsData] = await Promise.all([
          ApiClient.get('/tags').catch(() => []),
          ApiClient.get('/admin/roster/products').catch(() => []),
          ApiClient.get('/organizations').catch(() => []),
        ]);
        setTagsList(Array.isArray(tagsData) ? tagsData : []);
        setAvailableProducts(Array.isArray(productsData) ? productsData : []);
        setOrganizationsList(Array.isArray(orgsData) ? orgsData : []);
      } else if (activeTab === 'categories') {
        const catData = await ApiClient.get('/categories');
        setCategoriesList(Array.isArray(catData) ? catData : []);
      } else if (activeTab === 'sso') {
        const res = await ApiClient.get('/admin/sso');
        setSsoProviders(res || []);
      }
    } catch (err: any) {
      console.error('Failed to load administrative records', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Close Tag and Org Dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagOrgDropdownRef.current && !tagOrgDropdownRef.current.contains(e.target as Node)) {
        setIsTagOrgOpen(false);
      }
      if (tagProductDropdownRef.current && !tagProductDropdownRef.current.contains(e.target as Node)) {
        setIsTagProductOpen(false);
      }
      if (orgProductDropdownRef.current && !orgProductDropdownRef.current.contains(e.target as Node)) {
        setIsOrgProductOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search inputs when dropdown opens
  useEffect(() => {
    if (isTagOrgOpen) {
      setTagOrgSearch('');
      setTimeout(() => tagOrgSearchRef.current?.focus(), 50);
    }
  }, [isTagOrgOpen]);

  useEffect(() => {
    if (isTagProductOpen) {
      setTagProductSearch('');
      setTimeout(() => tagProductSearchRef.current?.focus(), 50);
    }
  }, [isTagProductOpen]);

  useEffect(() => {
    if (isOrgProductOpen) {
      setOrgProductSearch('');
      setTimeout(() => orgProductSearchRef.current?.focus(), 50);
    }
  }, [isOrgProductOpen]);

  const sanitizeDomainChip = (str: string) =>
    str
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^[<"']+|[>"',;]+$/g, '')
      .trim();

  const isValidEmailOrDomain = (str: string): boolean => {
    if (!str) return false;
    const clean = str.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailRegex.test(clean)) return true;

    const domainClean = clean.replace(/^@/, '');
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (domainRegex.test(domainClean)) return true;

    return false;
  };

  // Organization Management Handlers
  const addOrgDomainChip = (val: string, showToast = true) => {
    if (!val || !val.trim()) return;
    const tokens = val
      .split(/[\s,;\n\r\t]+/)
      .map(sanitizeDomainChip)
      .filter(Boolean);

    if (tokens.length === 0) return;

    const validTokens: string[] = [];
    let invalidCount = 0;

    for (const token of tokens) {
      if (isValidEmailOrDomain(token)) {
        validTokens.push(token);
      } else {
        invalidCount++;
      }
    }

    if (invalidCount > 0 && showToast) {
      if (tokens.length === 1) {
        toast.error(`"${tokens[0]}" is not a valid email or domain (e.g. user@domain.com or domain.com)`);
      } else {
        toast.warning(`Skipped ${invalidCount} invalid email/domain ${invalidCount === 1 ? 'entry' : 'entries'}`);
      }
    }

    if (validTokens.length === 0) return;

    setOrgDomainList((prev) => {
      const combined = [...prev];
      for (const t of validTokens) {
        if (!combined.includes(t)) {
          combined.push(t);
        }
      }
      return combined;
    });
  };

  const openCreateOrgModal = () => {
    setEditingOrg(null);
    setOrgName('');
    setOrgDomainList([]);
    setOrgDomainInput('');
    setOrgWebsite('');
    setOrgDescription('');
    setOrgContactName('');
    setOrgContactEmail('');
    setOrgContactPhone('');
    setOrgProduct('');
    setIsOrgProductOpen(false);
    setOrgProductSearch('');
    setIsOrgModalOpen(true);
  };

  const openEditOrgModal = (org: any) => {
    setEditingOrg(org);
    setOrgName(org.name || '');
    const existing = org.domains
      ? org.domains
          .split(/[\s,;]+/)
          .map(sanitizeDomainChip)
          .filter(isValidEmailOrDomain)
      : [];
    setOrgDomainList(existing);
    setOrgDomainInput('');
    setOrgWebsite(org.website || '');
    setOrgDescription(org.description || '');
    setOrgContactName(org.contactName || '');
    setOrgContactEmail(org.contactEmail || '');
    setOrgContactPhone(org.contactPhone || '');
    setOrgProduct(org.product || '');
    setIsOrgProductOpen(false);
    setOrgProductSearch('');
    setIsOrgModalOpen(true);
  };

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setIsOrgSubmitting(true);
    try {
      const finalDomains = [...orgDomainList];
      if (orgDomainInput.trim()) {
        const pendingTokens = orgDomainInput
          .split(/[\s,;\n\r\t]+/)
          .map(sanitizeDomainChip)
          .filter(isValidEmailOrDomain);
        for (const token of pendingTokens) {
          if (!finalDomains.includes(token)) {
            finalDomains.push(token);
          }
        }
        setOrgDomainList(finalDomains);
        setOrgDomainInput('');
      }

      const domainString = finalDomains.join(', ');

      const payload = {
        name: orgName.trim(),
        domains: domainString || null,
        website: orgWebsite.trim() || null,
        description: orgDescription.trim() || null,
        contactName: orgContactName.trim() || null,
        contactEmail: orgContactEmail.trim() || null,
        contactPhone: orgContactPhone.trim() || null,
        product: orgProduct.trim() || null,
      };

      if (editingOrg) {
        await ApiClient.patch(`/organizations/${editingOrg.id}`, payload);
        toast.success('Organization updated successfully');
      } else {
        await ApiClient.post('/organizations', payload);
        toast.success('Organization created successfully');
      }
      setIsOrgModalOpen(false);
      const updated = await ApiClient.get('/organizations');
      setOrganizationsList(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save organization');
    } finally {
      setIsOrgSubmitting(false);
    }
  };

  const handleExportOrganizations = () => {
    let orgsToExport: any[] = [];
    if (selectedOrgIds.size > 0) {
      orgsToExport = organizationsList.filter((org: any) => selectedOrgIds.has(org.id));
    } else {
      orgsToExport = filteredOrganizations.length > 0 ? filteredOrganizations : organizationsList;
    }

    if (orgsToExport.length === 0) {
      toast.info('No organizations available to export');
      return;
    }

    const headers = [
      'Organization Name',
      'Product',
      'Sender Domains / Email Domains',
      'Website',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Account Notes / Description',
    ];

    const rows = orgsToExport.map((org: any) => {
      const escapeField = (val: string | null | undefined) => {
        if (!val) return '';
        const s = String(val).replace(/"/g, '""');
        return `"${s}"`;
      };

      return [
        escapeField(org.name),
        escapeField(org.product),
        escapeField(org.domains),
        escapeField(org.website),
        escapeField(org.contactName),
        escapeField(org.contactEmail),
        escapeField(org.contactPhone),
        escapeField(org.description),
      ].join(',');
    });

    const csvString = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `organizations_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${orgsToExport.length} ${orgsToExport.length === 1 ? 'organization' : 'organizations'} to CSV`);
  };

  const handleDownloadSampleOrgCsv = () => {
    const sampleCsv = `Organization Name,Product,Sender Domains / Email Domains,Website,Contact Name,Contact Email,Contact Phone,Account Notes / Description
Apollo Hospitals (CB),ClaimBook,"apollohospitals.com, apollo.org",https://apollohospitals.com,Dr. Rajesh Sharma,contact@apollohospitals.com,+91 98765 43210,Enterprise SLA tier-1
Orange Diagnostics,LIMS,orangehealth.in,https://orangehealth.in,Vynetta,vynetta@orangehealth.in,77986 86764,Central Diagnostics Lab
City Care Health,HIS,citycare.org,https://citycare.org,Admin,admin@citycare.org,+91 99887 76655,Tertiary healthcare group`;

    const blob = new Blob(['\uFEFF' + sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sample_organizations_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOrgImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOrgImportFile(file);

    try {
      let text = await file.text();
      // Strip UTF-8 BOM if present (e.g. from Excel)
      text = text.replace(/^\uFEFF/, '');

      // RFC-4180 compliant CSV parser that supports multiline fields and escaped quotes
      const parseFullCsv = (csvText: string): string[][] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentField += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField);
            currentField = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
            currentRow.push(currentField);
            currentField = '';
            if (currentRow.some((f) => f.trim().length > 0)) {
              rows.push(currentRow);
            }
            currentRow = [];
          } else {
            currentField += char;
          }
        }
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          if (currentRow.some((f) => f.trim().length > 0)) {
            rows.push(currentRow);
          }
        }
        return rows;
      };

      const rows = parseFullCsv(text);
      if (rows.length <= 1) {
        toast.error('The selected CSV file appears to be empty or missing data rows');
        setOrgImportPreview([]);
        return;
      }

      const headerRow = rows[0].map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      
      // Robust column header detection
      const nameIdx = headerRow.findIndex(
        (h) =>
          h === 'organization name' ||
          h === 'company name' ||
          h === 'org name' ||
          h === 'organization' ||
          h === 'company' ||
          h === 'name' ||
          (h.includes('organization') && !h.includes('contact')) ||
          (h.includes('company') && !h.includes('contact')) ||
          (h.includes('name') && !h.includes('contact')),
      );

      const productIdx = headerRow.findIndex(
        (h) => h === 'product' || h === 'app' || h === 'module' || h.includes('product'),
      );

      const domainsIdx = headerRow.findIndex(
        (h) =>
          h.includes('domain') ||
          h.includes('sender') ||
          h.includes('email domain') ||
          h === 'domains',
      );

      const websiteIdx = headerRow.findIndex(
        (h) => h === 'website' || h === 'url' || h === 'portal' || h.includes('website') || h.includes('url'),
      );

      const contactNameIdx = headerRow.findIndex(
        (h) =>
          h === 'contact name' ||
          h === 'contact person' ||
          h === 'contact' ||
          (h.includes('contact') && h.includes('name')) ||
          (h.includes('contact') && !h.includes('email') && !h.includes('phone')),
      );

      const contactEmailIdx = headerRow.findIndex(
        (h) =>
          h === 'contact email' ||
          h === 'email' ||
          h === 'email address' ||
          (h.includes('email') && !h.includes('domain')),
      );

      const contactPhoneIdx = headerRow.findIndex(
        (h) =>
          h === 'contact phone' ||
          h === 'phone' ||
          h === 'mobile' ||
          h === 'tel' ||
          h.includes('phone') ||
          h.includes('mobile') ||
          h.includes('tel'),
      );

      const descIdx = headerRow.findIndex(
        (h) =>
          h.includes('note') ||
          h.includes('description') ||
          h.includes('desc') ||
          h.includes('account notes') ||
          h.includes('sla'),
      );

      const normalizeProduct = (p: string | null | undefined): string | null => {
        if (!p) return null;
        const clean = p.trim();
        const lower = clean.toLowerCase();
        if (lower === 'claimbook' || lower === 'claim book' || lower === 'claim-book') return 'ClaimBook';
        if (lower === 'lims') return 'LIMS';
        if (lower === 'his') return 'HIS';
        return clean.slice(0, 120);
      };

      const parsedItems = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = nameIdx !== -1 ? row[nameIdx]?.trim() : row[0]?.trim();
        if (!name) continue;

        parsedItems.push({
          name: name.slice(0, 120),
          product: productIdx !== -1 ? normalizeProduct(row[productIdx]) : null,
          domains: domainsIdx !== -1 && row[domainsIdx]?.trim() ? row[domainsIdx].trim() : null,
          website: websiteIdx !== -1 && row[websiteIdx]?.trim() ? row[websiteIdx].trim().slice(0, 255) : null,
          contactName: contactNameIdx !== -1 && row[contactNameIdx]?.trim() ? row[contactNameIdx].trim().slice(0, 120) : null,
          contactEmail: contactEmailIdx !== -1 && row[contactEmailIdx]?.trim() ? row[contactEmailIdx].trim().slice(0, 255) : null,
          contactPhone: contactPhoneIdx !== -1 && row[contactPhoneIdx]?.trim() ? row[contactPhoneIdx].trim().slice(0, 50) : null,
          description: descIdx !== -1 && row[descIdx]?.trim() ? row[descIdx].trim().slice(0, 2000) : null,
        });
      }

      setOrgImportPreview(parsedItems);
    } catch (err: any) {
      toast.error('Failed to parse CSV file: ' + (err.message || 'Invalid format'));
      setOrgImportPreview([]);
    }
  };

  const handleExecuteOrgImport = async () => {
    if (orgImportPreview.length === 0) {
      toast.error('No valid organizations to import');
      return;
    }

    setIsOrgImporting(true);
    try {
      const res: any = await ApiClient.post('/organizations/bulk-import', {
        organizations: orgImportPreview,
      });

      toast.success(
        `Import completed successfully: ${res?.created || 0} created, ${res?.updated || 0} updated/merged!`,
      );
      setIsOrgImportModalOpen(false);
      setOrgImportFile(null);
      setOrgImportPreview([]);

      const updated = await ApiClient.get('/organizations');
      setOrganizationsList(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to import organizations');
    } finally {
      setIsOrgImporting(false);
    }
  };

  const handleBulkDeleteOrganizations = async () => {
    if (selectedOrgIds.size === 0) return;
    const count = selectedOrgIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected ${count === 1 ? 'organization' : 'organizations'}? This action cannot be undone.`)) {
      return;
    }

    setIsOrgBulkDeleting(true);
    try {
      await ApiClient.post('/organizations/bulk-delete', {
        ids: Array.from(selectedOrgIds),
      });

      toast.success(`Successfully deleted ${count} ${count === 1 ? 'organization' : 'organizations'}`);
      setOrganizationsList((prev) => prev.filter((o) => !selectedOrgIds.has(o.id)));
      setSelectedOrgIds(new Set());
    } catch (err: any) {
      toast.error(err.message || 'Failed to bulk delete organizations');
    } finally {
      setIsOrgBulkDeleting(false);
    }
  };

  const isAllCurrentPageSelected =
    paginatedOrganizations.length > 0 &&
    paginatedOrganizations.every((o: any) => selectedOrgIds.has(o.id));

  const isAllFilteredSelected =
    filteredOrganizations.length > 0 &&
    filteredOrganizations.length === selectedOrgIds.size &&
    filteredOrganizations.every((o: any) => selectedOrgIds.has(o.id));

  const toggleSelectAllOrgs = () => {
    if (isAllCurrentPageSelected || isAllFilteredSelected) {
      setSelectedOrgIds(new Set());
    } else {
      const newSet = new Set(selectedOrgIds);
      for (const org of paginatedOrganizations) {
        newSet.add(org.id);
      }
      setSelectedOrgIds(newSet);
    }
  };

  const selectAllFilteredOrganizations = () => {
    const newSet = new Set<string>();
    for (const org of filteredOrganizations) {
      newSet.add(org.id);
    }
    setSelectedOrgIds(newSet);
  };

  const toggleSelectOrg = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedOrgIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOrgIds(newSet);
  };

  const handleDeleteOrganization = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the organization "${name}"?`)) return;
    try {
      await ApiClient.delete(`/organizations/${id}`);
      toast.success('Organization deleted successfully');
      setOrganizationsList((prev) => prev.filter((o) => o.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization');
    }
  };

  const addTagDomainChip = (val: string, showToast = true) => {
    if (!val || !val.trim()) return;
    const tokens = val
      .split(/[\s,;\n\r\t]+/)
      .map(sanitizeDomainChip)
      .filter(Boolean);

    if (tokens.length === 0) return;

    const validTokens: string[] = [];
    let invalidCount = 0;

    for (const token of tokens) {
      if (isValidEmailOrDomain(token)) {
        validTokens.push(token);
      } else {
        invalidCount++;
      }
    }

    if (invalidCount > 0 && showToast) {
      if (tokens.length === 1) {
        toast.error(`"${tokens[0]}" is not a valid email or domain (e.g. user@domain.com or domain.com)`);
      } else {
        toast.warning(`Skipped ${invalidCount} invalid email/domain ${invalidCount === 1 ? 'entry' : 'entries'}`);
      }
    }

    if (validTokens.length === 0) return;

    setTagDomainList((prev) => {
      const combined = [...prev];
      for (const t of validTokens) {
        if (!combined.includes(t)) {
          combined.push(t);
        }
      }
      return combined;
    });
  };

  const openCreateTagModal = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor('#3b82f6');
    setTagDomainList([]);
    setTagDomainInput('');
    setTagOrganization('');
    setTagProducts([]);
    setIsTagOrgOpen(false);
    setIsTagProductOpen(false);
    setTagOrgSearch('');
    setTagProductSearch('');
    setIsTagModalOpen(true);
  };

  const openEditTagModal = (tag: any) => {
    setEditingTag(tag);
    setTagName(tag.name || '');
    setTagColor(tag.color || '#3b82f6');
    const existing = tag.domains
      ? tag.domains
          .split(/[\s,;]+/)
          .map(sanitizeDomainChip)
          .filter(isValidEmailOrDomain)
      : [];
    setTagDomainList(existing);
    setTagDomainInput('');
    setTagOrganization(tag.organization || '');
    const existingProds = tag.product
      ? tag.product
          .split(/[\s,;]+/)
          .map((p: string) => p.trim())
          .filter(Boolean)
      : [];
    setTagProducts(existingProds);
    setIsTagOrgOpen(false);
    setIsTagProductOpen(false);
    setTagOrgSearch('');
    setTagProductSearch('');
    setIsTagModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = tagName.trim();
    if (!trimmedName) {
      toast.error('Tag name is required');
      return;
    }

    // Validation: Duplicate tag name check
    const isDuplicate = tagsList.some(
      (t) => t.name?.toLowerCase() === trimmedName.toLowerCase() && t.id !== editingTag?.id,
    );
    if (isDuplicate) {
      toast.error(`A tag with name "${trimmedName}" already exists`);
      return;
    }

    setIsTagSubmitting(true);
    try {
      const finalDomains = [...tagDomainList];
      if (tagDomainInput.trim()) {
        const pendingTokens = tagDomainInput
          .split(/[\s,;\n\r\t]+/)
          .map(sanitizeDomainChip)
          .filter(isValidEmailOrDomain);
        for (const token of pendingTokens) {
          if (!finalDomains.includes(token)) {
            finalDomains.push(token);
          }
        }
        setTagDomainList(finalDomains);
        setTagDomainInput('');
      }

      const domainString = finalDomains.join(', ');
      const productString = tagProducts.length > 0 ? tagProducts.join(', ') : null;

      if (editingTag) {
        await ApiClient.patch(`/tags/${editingTag.id}`, {
          name: trimmedName,
          color: tagColor || '#3b82f6',
          domains: domainString || null,
          organization: tagOrganization.trim() || null,
          product: productString,
        });
        toast.success('Tag updated successfully');
      } else {
        await ApiClient.post('/tags', {
          name: trimmedName,
          color: tagColor || '#3b82f6',
          domains: domainString || undefined,
          organization: tagOrganization.trim() || undefined,
          product: productString || undefined,
        });
        toast.success('Tag created successfully');
      }
      setIsTagModalOpen(false);
      const updated = await ApiClient.get('/tags');
      setTagsList(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save tag');
    } finally {
      setIsTagSubmitting(false);
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the tag "${name}"?`)) return;
    try {
      await ApiClient.delete(`/tags/${id}`);
      toast.success('Tag deleted successfully');
      const updated = await ApiClient.get('/tags');
      setTagsList(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete tag');
    }
  };

  // Categories Handlers
  const sanitizeKeywordChip = (str: string) => str.trim().toLowerCase();

  const addCategoryKeywordChip = (input: string) => {
    if (!input || !input.trim()) return;
    const rawTokens = input
      .split(/[,;\n]+/)
      .map(sanitizeKeywordChip)
      .filter((k) => k.length >= 2);

    if (rawTokens.length === 0) return;

    setCategoryKeywordList((prev) => {
      const combined = Array.from<string>(new Set([...prev, ...rawTokens]));
      if (combined.length > 25) {
        toast.info('Category limited to top 25 unique keywords');
        return combined.slice(0, 25);
      }
      return combined;
    });
  };

  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryColor('#6366f1');
    setCategoryKeywordList([]);
    setCategoryKeywordInput('');
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: any) => {
    setEditingCategory(cat);
    setCategoryName(cat.name || '');
    setCategoryColor(cat.color || '#6366f1');
    const existing = cat.keywords
      ? Array.from<string>(
          new Set(
            cat.keywords
              .split(/[,;\n]+/)
              .map(sanitizeKeywordChip)
              .filter((k: string) => k.length >= 2),
          ),
        )
      : [];
    setCategoryKeywordList(existing);
    setCategoryKeywordInput('');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.error('Category name is required');
      return;
    }
    setIsCategorySubmitting(true);
    try {
      let finalKeywords = [...categoryKeywordList];
      const pending = sanitizeKeywordChip(categoryKeywordInput);
      if (pending && pending.length >= 2 && !finalKeywords.includes(pending)) {
        finalKeywords.push(pending);
      }
      finalKeywords = Array.from<string>(new Set(finalKeywords)).slice(0, 25);
      setCategoryKeywordList(finalKeywords);
      setCategoryKeywordInput('');

      const keywordString = finalKeywords.length > 0 ? finalKeywords.join(', ') : null;

      if (editingCategory) {
        await ApiClient.patch(`/categories/${editingCategory.id}`, {
          name: categoryName.trim(),
          color: categoryColor,
          keywords: keywordString,
        });
        toast.success('Category updated successfully');
      } else {
        await ApiClient.post('/categories', {
          name: categoryName.trim(),
          color: categoryColor,
          keywords: keywordString || undefined,
        });
        toast.success('Category created successfully');
      }
      setIsCategoryModalOpen(false);
      const updated = await ApiClient.get('/categories');
      setCategoriesList(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the category "${name}"?`)) return;
    try {
      await ApiClient.delete(`/categories/${id}`);
      toast.success('Category deleted successfully');
      const updated = await ApiClient.get('/categories');
      setCategoriesList(Array.isArray(updated) ? updated : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const openAddOidcModal = () => {
    setSsoProviderType('OIDC');
    setUseGoogleDefaults(true);
    setSsoDisplayName('Google Workspace');
    setSsoIssuer('https://accounts.google.com');
    setSsoClientId('');
    setSsoClientSecret('');
    setSsoAuthorizationUrl('https://accounts.google.com/o/oauth2/v2/auth');
    setSsoTokenUrl('https://oauth2.googleapis.com/token');
    setSsoUserinfoUrl('https://openidconnect.googleapis.com/v1/userinfo');
    setSsoJwksUri('https://www.googleapis.com/oauth2/v3/certs');
    setSsoSamlUrl('');
    setSsoSamlCert('');
    setSsoDomains('');
    setSsoJit(true);
    setIsEditingSso(false);
    setIsCreateSsoOpen(true);
  };

  const handleToggleGoogleDefaults = (checked: boolean) => {
    setUseGoogleDefaults(checked);
    if (checked) {
      setSsoDisplayName('Google Workspace');
      setSsoIssuer('https://accounts.google.com');
      setSsoAuthorizationUrl('https://accounts.google.com/o/oauth2/v2/auth');
      setSsoTokenUrl('https://oauth2.googleapis.com/token');
      setSsoUserinfoUrl('https://openidconnect.googleapis.com/v1/userinfo');
      setSsoJwksUri('https://www.googleapis.com/oauth2/v3/certs');
    } else {
      setSsoDisplayName('');
      setSsoIssuer('');
      setSsoAuthorizationUrl('');
      setSsoTokenUrl('');
      setSsoUserinfoUrl('');
      setSsoJwksUri('');
    }
  };

  const openAddSamlModal = () => {
    setSsoProviderType('SAML');
    setSsoDisplayName('');
    setSsoIssuer('');
    setSsoClientId('');
    setSsoClientSecret('');
    setSsoAuthorizationUrl('');
    setSsoTokenUrl('');
    setSsoUserinfoUrl('');
    setSsoJwksUri('');
    setSsoSamlUrl('');
    setSsoSamlCert('');
    setSsoDomains('');
    setSsoJit(true);
    setIsEditingSso(false);
    setIsCreateSsoOpen(true);
  };

  const handleEditSsoProvider = (p: any) => {
    setSsoProviderType(p.protocol);
    setSsoDisplayName(p.displayName || '');
    setSsoDomains(p.emailDomains ? p.emailDomains.join(', ') : '');
    setSsoJit(p.jitProvisioning ?? true);

    if (p.protocol === 'OIDC') {
      setSsoIssuer(p.issuer || '');
      setSsoClientId(p.clientId || '');
      setSsoClientSecret('');
      setSsoAuthorizationUrl(p.authorizationEndpoint || '');
      setSsoTokenUrl(p.tokenEndpoint || '');
      setSsoUserinfoUrl(p.userinfoEndpoint || '');
      setSsoJwksUri(p.jwksUri || '');
      setUseGoogleDefaults(p.issuer === 'https://accounts.google.com');
    } else {
      setSsoIssuer(p.issuer || '');
      setSsoSamlUrl(p.authorizationEndpoint || '');
      setSsoSamlCert(p.samlCertificate || '');
    }
    setIsEditingSso(true);
    setIsCreateSsoOpen(true);
  };

  // Create SSO Provider Submit
  const handleCreateSsoProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const firstDomain = ssoDomains.split(',')[0]?.trim();
      if (!firstDomain) {
        throw new Error('An email domain is required.');
      }

      if (ssoProviderType === 'OIDC') {
        await ApiClient.post('/admin/sso/oidc', {
          name: ssoDisplayName,
          domain: firstDomain,
          issuer: ssoIssuer,
          clientId: ssoClientId,
          clientSecret: ssoClientSecret,
          authorizationUrl: ssoAuthorizationUrl,
          tokenUrl: ssoTokenUrl,
          userinfoUrl: ssoUserinfoUrl || undefined,
          jwksUri: ssoJwksUri || undefined,
          jitProvisioning: ssoJit,
          isActive: true,
        });
      } else {
        await ApiClient.post('/admin/sso/saml', {
          name: ssoDisplayName,
          domain: firstDomain,
          samlEntityId: ssoIssuer,
          samlSsoUrl: ssoSamlUrl,
          samlCert: ssoSamlCert,
          jitProvisioning: ssoJit,
          isActive: true,
        });
      }
      setIsCreateSsoOpen(false);
      setSsoDisplayName('');
      setSsoIssuer('');
      setSsoClientId('');
      setSsoClientSecret('');
      setSsoAuthorizationUrl('');
      setSsoTokenUrl('');
      setSsoUserinfoUrl('');
      setSsoJwksUri('');
      setSsoSamlUrl('');
      setSsoSamlCert('');
      setSsoDomains('');
      setSsoJit(false);
      loadData();
      toast.success('SSO Provider configured successfully!');
    } catch (err: any) {
      toast.error(`Failed to configure SSO provider: ${err.message}`);
    }
  };

  // Delete SSO Provider
  const handleDeleteSsoProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SSO provider configuration?')) return;
    try {
      await ApiClient.delete(`/admin/sso/${id}`);
      loadData();
      toast.success('SSO Provider deleted successfully!');
    } catch (err: any) {
      toast.error(`Failed to delete SSO provider: ${err.message}`);
    }
  };

  // Create Brand Submit
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/admin/brands', {
        name: brandName,
        slug: brandSlug.toLowerCase(),
        supportEmail: brandSupportEmail || undefined,
        portalDomain: brandPortalDomain || undefined,
        timezone: 'Asia/Kolkata',
        locale: 'en',
        isDefault: brandIsDefault,
      });
      setIsCreateBrandOpen(false);
      setBrandName('');
      setBrandSlug('');
      setBrandSupportEmail('');
      setBrandPortalDomain('');
      setBrandTimezone('Asia/Kolkata');
      setBrandLocale('en');
      loadData();
      await reloadBrands();
      toast.success('Brand created successfully!');
    } catch (err: any) {
      toast.error(`Failed to create brand: ${err.message}`);
    }
  };

  // Edit Brand Setup
  const startEditBrand = (b: any) => {
    setEditingBrand(b);
    setBrandName(b.name);
    setBrandSlug(b.slug);
    setBrandSupportEmail(b.supportEmail || '');
    setBrandPortalDomain(b.portalDomain || '');
    setBrandTimezone('Asia/Kolkata');
    setBrandLocale('en');
    setBrandIsDefault(b.isDefault);
    setIsEditBrandOpen(true);
  };

  // Edit Brand Submit
  const handleUpdateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    try {
      await ApiClient.patch(`/admin/brands/${editingBrand.id}`, {
        name: brandName,
        slug: brandSlug.toLowerCase(),
        supportEmail: brandSupportEmail || undefined,
        portalDomain: brandPortalDomain || undefined,
        timezone: 'Asia/Kolkata',
        locale: 'en',
        isDefault: brandIsDefault,
      });
      setIsEditBrandOpen(false);
      setEditingBrand(null);
      loadData();
      await reloadBrands();
      toast.success('Brand updated successfully!');
    } catch (err: any) {
      toast.error(`Failed to update brand: ${err.message}`);
    }
  };

  const sanitizeOrigin = (input: string): string => {
    let val = input.trim().replace(/,$/, '');
    if (!val) return '';

    if (!/^https?:\/\//i.test(val)) {
      const isLocalOrIp =
        val.startsWith('localhost') || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(val);
      if (isLocalOrIp) {
        val = 'http://' + val;
      } else {
        val = 'https://' + val;
      }
    }

    try {
      const url = new URL(val);
      return url.origin;
    } catch {
      return val.toLowerCase();
    }
  };

  const addOriginTag = (input: string) => {
    const val = sanitizeOrigin(input);
    if (val && !allowedOrigins.includes(val)) {
      setAllowedOrigins([...allowedOrigins, val]);
    }
  };

  // Widget config save submit
  const handleSaveWidgetConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrandId) return;
    setIsWidgetSaving(true);
    try {
      const origins = [...allowedOrigins];
      const finalInput = sanitizeOrigin(domainInput);
      if (finalInput && !origins.includes(finalInput)) {
        origins.push(finalInput);
        setAllowedOrigins(origins);
        setDomainInput('');
      }

      await ApiClient.patch(`/admin/brands/${activeBrandId}/widget-config`, {
        widgetEnabled,
        adminWidgetEnabled,
        allowedOrigins: origins,
        screenshotEnabled,
        annotationEnabled,
        screenRecordingEnabled,
        voiceRecordingEnabled,
        attachmentsEnabled,
        consoleCaptureEnabled,
        networkCaptureEnabled,
        errorCaptureEnabled,
        liveChatEnabled,
        anonymousTicketsEnabled,
        launcherLabel,
        welcomeMessage: welcomeMessage || undefined,
        privacyNotice: privacyNotice || undefined,
      });

      loadData();
      await reloadBrands();
      toast.success('Widget configuration saved successfully!');
    } catch (err: any) {
      toast.error(`Failed to save widget config: ${err.message}`);
    } finally {
      setIsWidgetSaving(false);
    }
  };

  // Rotate widget config secret
  const handleRotateWidgetSecret = async () => {
    if (
      !activeBrandId ||
      !confirm(
        'Are you sure you want to rotate the widget signing secret? Old widget sessions will immediately invalidate.',
      )
    )
      return;
    try {
      const res = await ApiClient.post(`/admin/brands/${activeBrandId}/rotate-widget-secret`);
      setNewSecretVal(res.signingSecret);
      loadData();
      await reloadBrands();
      toast.success('Widget signing secret rotated successfully!');
    } catch (err: any) {
      toast.error(`Failed to rotate secret: ${err.message}`);
    }
  };

  // Create Team Submit
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = teamName.trim();
    if (!trimmedName) return;
    try {
      const generatedSlug =
        trimmedName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `team-${Date.now().toString(36).slice(-4)}`;

      await ApiClient.post('/admin/teams', {
        name: trimmedName,
        slug: generatedSlug,
        tier: teamTier,
        description: teamDescription.trim() || undefined,
        isActive: true,
      });
      setIsCreateTeamOpen(false);
      setTeamName('');
      setTeamSlug('');
      setTeamDescription('');
      loadData();
      toast.success('Team created successfully!');
    } catch (err: any) {
      toast.error(`Failed to create team: ${err.message}`);
    }
  };

  // Quick Assign Staff Member (Drag/Drop or 1-Click +)
  const handleQuickAssignStaff = async (userId: string, customGrade = 'Junior', customShift = 'General Shift') => {
    if (!selectedTeamForMembers || !userId) return;
    setIsAddingMemberLoading(true);
    try {
      const timing = customShift === 'Morning Shift' ? '7:30 AM - 4:30 PM' : customShift === 'Evening Shift' ? '2:00 PM - 11:00 PM' : '10:00 AM - 7:00 PM';
      await ApiClient.post(`/admin/teams/${selectedTeamForMembers.id}/members`, {
        userId,
        isLead: false,
        grade: customGrade,
        defaultShift: customShift,
        timing,
      });
      toast.success('Staff member assigned to team!');
      await loadData();
      const refreshedTeams = await ApiClient.get('/admin/teams');
      const updated = (refreshedTeams || []).find((t: any) => t.id === selectedTeamForMembers.id);
      if (updated) setSelectedTeamForMembers(updated);
    } catch (err: any) {
      toast.error(`Failed to assign member: ${err.message}`);
    } finally {
      setIsAddingMemberLoading(false);
    }
  };

  // Update Member Preferences Inline (Grade, Shift, Lead Status)
  const handleUpdateMemberInline = async (userId: string, updates: any) => {
    if (!selectedTeamForMembers || !userId) return;
    try {
      const existing = (selectedTeamForMembers.members || []).find((m: any) => (m.user?.id || m.userId) === userId);
      await ApiClient.post(`/admin/teams/${selectedTeamForMembers.id}/members`, {
        userId,
        isLead: updates.isLead !== undefined ? updates.isLead : (existing?.isLead || false),
        grade: updates.grade !== undefined ? updates.grade : (existing?.grade || 'Junior'),
        defaultShift: updates.defaultShift !== undefined ? updates.defaultShift : (existing?.defaultShift || 'General Shift'),
        timing: updates.timing !== undefined ? updates.timing : (existing?.timing || '10:00 AM - 7:00 PM'),
      });
      toast.success('Member preferences updated');
      await loadData();
      const refreshedTeams = await ApiClient.get('/admin/teams');
      const updated = (refreshedTeams || []).find((t: any) => t.id === selectedTeamForMembers.id);
      if (updated) setSelectedTeamForMembers(updated);
    } catch (err: any) {
      toast.error(`Failed to update member: ${err.message}`);
    }
  };

  // Remove Member from Team
  const handleRemoveMemberFromTeam = async (userId: string) => {
    if (!selectedTeamForMembers) return;
    try {
      await ApiClient.delete(`/admin/teams/${selectedTeamForMembers.id}/members/${userId}`);
      toast.success('Member removed from team.');
      await loadData();
      const refreshedTeams = await ApiClient.get('/admin/teams');
      const updated = (refreshedTeams || []).find((t: any) => t.id === selectedTeamForMembers.id);
      if (updated) setSelectedTeamForMembers(updated);
    } catch (err: any) {
      toast.error(`Failed to remove team member: ${err.message}`);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (team: any) => {
    if (!confirm(`Are you sure you want to delete team "${team.name}"? All assigned members and associated roster configs will be removed.`)) return;
    try {
      await ApiClient.delete(`/admin/teams/${team.id}`);
      toast.success(`Team "${team.name}" deleted.`);
      loadData();
    } catch (err: any) {
      toast.error(`Failed to delete team: ${err.message}`);
    }
  };

  // Create Queue Submit
  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/admin/queues', {
        name: queueName,
        slug: queueSlug.toLowerCase(),
        tier: queueTier,
        brandId: queueBrandId || undefined,
        teamId: queueTeamId || undefined,
        routing: queueRouting,
        isDefault: queueIsDefault,
        isActive: true,
      });
      setIsCreateQueueOpen(false);
      setQueueName('');
      setQueueSlug('');
      loadData();
      toast.success('Queue created successfully!');
    } catch (err: any) {
      toast.error(`Failed to create queue: ${err.message}`);
    }
  };

  // Send Roster Email Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteRoleId) {
      toast.warning('Please select an assigned support role.');
      return;
    }
    setIsInviting(true);
    try {
      await ApiClient.post('/admin/users/invite', {
        email: inviteEmail,
        roleId: inviteRoleId,
        brandId: inviteBrandId || undefined,
        message: inviteMessage || undefined,
      });
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteFullName('');
      setInviteMessage('');
      loadData();
      toast.success('Invitation email sent successfully!');
    } catch (err: any) {
      toast.error(`Failed to send invite: ${err.message}`);
    } finally {
      setIsInviting(false);
    }
  };

  // Toggle user active status
  const handleToggleUserStatus = async (user: any) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await ApiClient.patch(`/admin/users/${user.id}`, {
        status: nextStatus,
      });
      loadData();
      toast.success(`User status updated to ${nextStatus}!`);
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
    }
  };

  const handleOpenEditStaffRole = (user: any) => {
    setEditingStaffUser(user);
    setEditStaffRoleId(user.roles?.[0]?.role?.id || user.roles?.[0]?.roleId || '');
    setEditStaffBrandId(user.roles?.[0]?.brandId || '');
  };

  const handleSaveStaffRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffUser || !editStaffRoleId) {
      toast.error('Please select a valid role.');
      return;
    }

    setIsUpdatingStaffRole(true);
    try {
      await ApiClient.patch(`/admin/users/${editingStaffUser.id}`, {
        roleId: editStaffRoleId,
        brandId: editStaffBrandId || null,
      });
      toast.success(`Role updated successfully for ${editingStaffUser.fullName || editingStaffUser.email}!`);
      setEditingStaffUser(null);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update staff role.');
    } finally {
      setIsUpdatingStaffRole(false);
    }
  };

  const copyTextToClipboard = async (text: string, onSuccess: () => void, toastMsg: string) => {
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      console.error('Navigator clipboard failed, falling back', err);
    }

    if (!success) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          success = true;
        }
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }

    if (success) {
      onSuccess();
      toast.success(toastMsg);
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const formatRotatedAt = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return `| Rotated: ${d.toLocaleString()}`;
    } catch {
      return '';
    }
  };

  const safeFormatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const currentHost =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? window.location.hostname
      : typeof __CONSOLE_HOST__ !== 'undefined'
        ? __CONSOLE_HOST__
  const apiHostUrl =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? window.location.origin
      : `http://${currentHost}:4000`;
  const widgetEmbedSnippet = `<!-- ABI Desk Customer Support Widget -->
<script
  src="${apiHostUrl}/api/v1/auth/widget.js"
  data-public-key="${activeBrand?.widgetConfig?.publicKey || 'pk_live_default_key'}"
  data-api-url="${apiHostUrl}"
  data-position="bottom-right"
  data-theme="auto"
  async
></script>`;

  const handleCopySnippet = () => {
    copyTextToClipboard(
      widgetEmbedSnippet,
      () => {
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 2000);
      },
      'Embed code snippet copied to clipboard!',
    );
  };

  return (
    <div className="workspace-container admin-page-wrapper" style={{ gap: '20px' }}>
      {/* Mobile & Portrait Tablet Screen Restriction Notice (< 1024px) */}
      <div className="analytics-mobile-restriction">
        <div className="analytics-restriction-card">
          <div className="analytics-restriction-icon-wrapper">
            <div className="analytics-restriction-icon-disc">
              <Settings size={32} />
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
            System Administration & Setup consoles feature multi-brand management, embed snippet builders, queue matrices, staff roles, and webhook integrations designed specifically for larger displays.
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
      <div className="analytics-desktop-content">
        {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Setup</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Configure multi-brand settings, embeddable widgets, routing queues, staff accounts, API
            credentials, and webhooks.
          </p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0px',
          overflowX: 'auto',
          marginBottom: '16px',
          flexShrink: 0,
        }}
      >
        {[
          { id: 'brands', label: 'Brands', icon: Settings },
          { id: 'widget', label: 'Embeddable Widget', icon: Code },
          { id: 'organizations', label: 'Organizations & Accounts', icon: Building2 },
          { id: 'tags', label: 'Tags & Auto-Tagging', icon: TagIcon },
          { id: 'categories', label: 'Categories & Keywords', icon: Folder },
          { id: 'teams', label: 'Teams & Queues', icon: Users },
          { id: 'users', label: 'Staff Directory', icon: UserPlus },
          { id: 'customers', label: 'Customer Directory', icon: UserCheck },
          { id: 'sso', label: 'Single Sign-On (SSO)', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setNewSecretVal(null);
                setSearchQuery('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 4px',
                fontSize: '13px',
                fontWeight: 600,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: `3px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                backgroundColor: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {isLoading ? (
        <LoadingSpinner size={28} text="Loading administrative records..." />
      ) : (
        <>
          {activeTab === 'brands' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Configured Brands</h3>
                  <button
                    onClick={() => setIsCreateBrandOpen(true)}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus size={14} /> Add New Brand
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredBrands.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: b.primaryColor || '#2563EB',
                          }}
                        />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{b.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Slug: {b.slug} | Email: {b.supportEmail || 'N/A'} | Domain:{' '}
                            {b.portalDomain || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {b.isDefault && <span className="badge badge-open">Default Brand</span>}
                        <button
                          onClick={() => startEditBrand(b)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Brand"
                        >
                          <Edit size={12} /> Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'widget' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                    Embeddable Customer Support Widget SDK
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Embed the floating support bubble in any web application to enable 1-click
                    ticket submission, screenshot drawing & redactions, WebM screen recording, and
                    live chat.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                      }}
                    >
                      HTML Script Tag Integration Code
                    </span>
                    <button onClick={handleCopySnippet} className="btn btn-secondary btn-sm">
                      {copiedSnippet ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedSnippet ? 'Copied to Clipboard!' : 'Copy Code Snippet'}</span>
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#080c14',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: '#60a5fa',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {widgetEmbedSnippet}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      Widget Secret Key Protection
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Last 4: {widgetConfig?.signingSecretLast4 || 'N/A'}{' '}
                      {formatRotatedAt(widgetConfig?.signingSecretRotatedAt)}
                    </div>
                  </div>
                  <button onClick={handleRotateWidgetSecret} className="btn btn-secondary btn-sm">
                    <RotateCw size={12} /> Rotate Signing Secret
                  </button>
                </div>

                {newSecretVal && (
                  <div
                    className="card"
                    style={{
                      backgroundColor: 'rgba(16,185,129,0.1)',
                      border: '1px solid #10b981',
                      color: '#10b981',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      ⚠️ Copy New Signing Secret Now:
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        margin: '8px 0',
                        wordBreak: 'break-all',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {newSecretVal}
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      This secret is hashed at rest and will not be displayed again.
                    </div>
                  </div>
                )}
              </div>

              {/* Widget Configuration Form */}
              <form
                onSubmit={handleSaveWidgetConfig}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '10px',
                  }}
                >
                  Widget Configuration Settings
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={adminWidgetEnabled}
                      onChange={(e) => setAdminWidgetEnabled(e.target.checked)}
                    />
                    <div>
                      <div>Enable Widget in Admin Dashboard</div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 400,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Show/hide support launcher in your own workspace.
                      </div>
                    </div>
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={widgetEnabled}
                      onChange={(e) => setWidgetEnabled(e.target.checked)}
                    />
                    <div>
                      <div>Enable Widget on Third-Party Sites</div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 400,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Control widget visibility globally everywhere.
                      </div>
                    </div>
                  </label>
                </div>

                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '6px',
                      }}
                    >
                      Allowed Domains (CORS Origins)
                    </label>
                    <div
                      style={{
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                        padding: '6px 8px',
                        backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.2))',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        alignItems: 'center',
                        minHeight: '42px',
                        cursor: 'text',
                      }}
                      onClick={() => document.getElementById('allowed-domains-input')?.focus()}
                    >
                      {allowedOrigins.map((origin, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '12px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}
                        >
                          <span>{origin}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAllowedOrigins(allowedOrigins.filter((_, i) => i !== index));
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              lineHeight: 1,
                              borderRadius: '50%',
                              width: '14px',
                              height: '14px',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <input
                        id="allowed-domains-input"
                        type="text"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addOriginTag(domainInput);
                            setDomainInput('');
                          }
                        }}
                        onBlur={() => {
                          addOriginTag(domainInput);
                          setDomainInput('');
                        }}
                        placeholder={
                          allowedOrigins.length === 0
                            ? 'e.g. https://app.example.com (Press Enter to add)'
                            : 'Add more...'
                        }
                        style={{
                          flex: 1,
                          minWidth: '120px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          fontSize: '12px',
                          padding: '4px 0',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '6px',
                      }}
                    >
                      Launcher Button Label
                    </label>
                    <input
                      type="text"
                      value={launcherLabel}
                      onChange={(e) => setLauncherLabel(e.target.value)}
                      className="form-control"
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                      }}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '6px',
                      }}
                    >
                      Welcome Message text
                    </label>
                    <textarea
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: 600,
                        marginBottom: '6px',
                      }}
                    >
                      GDPR Privacy Notice Consent Text
                    </label>
                    <textarea
                      value={privacyNotice}
                      onChange={(e) => setPrivacyNotice(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '8px',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                  </div>
                </div>

                <h4 style={{ fontSize: '13px', fontWeight: 700, marginTop: '8px' }}>
                  Toggle Widget Capabilities
                </h4>
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}
                >
                  {[
                    {
                      label: 'Screenshots Capture',
                      checked: screenshotEnabled,
                      setChecked: setScreenshotEnabled,
                    },
                    {
                      label: 'Screenshots Drawing Studio',
                      checked: annotationEnabled,
                      setChecked: setAnnotationEnabled,
                    },
                    {
                      label: 'Screen Video Recording',
                      checked: screenRecordingEnabled,
                      setChecked: setScreenRecordingEnabled,
                    },
                    {
                      label: 'Voice Audio Notes',
                      checked: voiceRecordingEnabled,
                      setChecked: setVoiceRecordingEnabled,
                    },
                    {
                      label: 'Console Logs Terminal Ingestion',
                      checked: consoleCaptureEnabled,
                      setChecked: setConsoleCaptureEnabled,
                    },
                    {
                      label: 'Network HTTP Inspector',
                      checked: networkCaptureEnabled,
                      setChecked: setNetworkCaptureEnabled,
                    },
                    {
                      label: 'JS Uncaught Stacktrace Tracker',
                      checked: errorCaptureEnabled,
                      setChecked: setErrorCaptureEnabled,
                    },
                    {
                      label: 'Attachment Uploader',
                      checked: attachmentsEnabled,
                      setChecked: setAttachmentsEnabled,
                    },
                    {
                      label: 'Real-Time Socket Live Chat',
                      checked: liveChatEnabled,
                      setChecked: setLiveChatEnabled,
                    },
                    {
                      label: 'Anonymous Guest Tickets',
                      checked: anonymousTicketsEnabled,
                      setChecked: setAnonymousTicketsEnabled,
                    },
                  ].map((cap, i) => (
                    <label
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={cap.checked}
                        onChange={(e) => cap.setChecked(e.target.checked)}
                      />
                      <span>{cap.label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="submit" disabled={isWidgetSaving} className="btn btn-primary">
                    <Save size={14} />{' '}
                    {isWidgetSaving ? 'Saving Widget...' : 'Save Widget Configuration'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'organizations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Client Organizations & Accounts Directory
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                      Manage enterprise client accounts, hospital groups, and associate email domains for automated ticket routing & SLA management.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedOrgIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDeleteOrganizations}
                        disabled={isOrgBulkDeleting}
                        className="btn btn-danger"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                      >
                        <Trash2 size={14} />
                        Delete Selected ({selectedOrgIds.size})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleExportOrganizations}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                      title={selectedOrgIds.size > 0 ? `Export ${selectedOrgIds.size} selected organizations to CSV` : 'Export all organizations to CSV'}
                    >
                      <Download size={14} /> {selectedOrgIds.size > 0 ? `Export Selected (${selectedOrgIds.size})` : 'Export CSV'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOrgImportFile(null);
                        setOrgImportPreview([]);
                        setIsOrgImportModalOpen(true);
                      }}
                      className="btn btn-secondary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                      title="Bulk import organizations from CSV"
                    >
                      <Upload size={14} /> Import CSV
                    </button>
                    <button onClick={openCreateOrgModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}>
                      <Plus size={14} /> Create Organization
                    </button>
                  </div>
                </div>

                {/* Bulk Selection Notification Bar */}
                {selectedOrgIds.size > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: 'var(--radius-md, 6px)',
                      padding: '10px 16px',
                      marginBottom: '14px',
                      fontSize: '13px',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <CheckCircle size={16} style={{ color: 'var(--primary, #2563eb)' }} />
                      {isAllFilteredSelected ? (
                        <span>
                          All <strong>{filteredOrganizations.length}</strong> organizations are selected.
                        </span>
                      ) : (
                        <span>
                          All <strong>{selectedOrgIds.size}</strong> organizations on this page are selected.{' '}
                          {filteredOrganizations.length > selectedOrgIds.size && (
                            <button
                              type="button"
                              onClick={selectAllFilteredOrganizations}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--primary, #2563eb)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '0 4px',
                                fontSize: '13px',
                              }}
                            >
                              Select all {filteredOrganizations.length} organizations
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedOrgIds(new Set())}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary, #2563eb)',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                )}

                {/* Product Quick Filter Tabs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '14px',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginRight: '2px',
                    }}
                  >
                    <Filter size={13} style={{ color: 'var(--primary, #2563eb)' }} />
                    <span>Filter by Product:</span>
                  </div>

                  {dynamicOrgProductTabs.map((tab) => {
                    const isSelected = selectedOrgProductFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrgProductFilter(tab.id);
                          setOrgPage(1);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          height: '28px',
                          boxSizing: 'border-box',
                          padding: '0 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected
                            ? `1px solid ${tab.color}`
                            : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                          boxShadow: isSelected ? `0 0 0 1px ${tab.color}` : 'none',
                          backgroundColor: isSelected
                            ? 'rgba(37, 99, 235, 0.12)'
                            : 'var(--bg-subtle, transparent)',
                          color: isSelected ? tab.color : 'var(--text-secondary)',
                        }}
                      >
                        {tab.icon && <span style={{ fontSize: '12px' }}>{tab.icon}</span>}
                        <span>{tab.label}</span>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            lineHeight: '1.2',
                            backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.15)' : 'var(--bg-card, rgba(0, 0, 0, 0.06))',
                            color: isSelected ? tab.color : 'var(--text-muted)',
                          }}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search, Filter & View Mode Controls Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                  }}
                >
                  {/* Search Bar */}
                  <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search by name, domain, contact, notes..."
                      value={orgSearchText}
                      onChange={(e) => {
                        setOrgSearchText(e.target.value);
                        setOrgPage(1);
                      }}
                      className="form-control"
                      style={{
                        paddingLeft: '34px',
                        paddingRight: orgSearchText ? '30px' : '12px',
                        fontSize: '13px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                    {orgSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setOrgSearchText('');
                          if (debouncedSearchQuery) setSearchQuery('');
                          setOrgPage(1);
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Right: Select All, Results Count & View Mode Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Quick Select Checkbox exclusively for Grid View */}
                    {orgViewMode === 'grid' && paginatedOrganizations.length > 0 && (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          padding: '2px 4px',
                          background: 'transparent',
                          border: 'none',
                        }}
                        title="Select or deselect all on current page"
                      >
                        <input
                          type="checkbox"
                          checked={isAllCurrentPageSelected || isAllFilteredSelected}
                          onChange={toggleSelectAllOrgs}
                          style={{ cursor: 'pointer', accentColor: 'var(--primary, #2563eb)' }}
                        />
                        <span>Select All</span>
                      </label>
                    )}

                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
                    </span>

                    {/* View Mode Toggle: List vs Grid */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                        padding: '3px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSetOrgViewMode('list')}
                        title="List View"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: orgViewMode === 'list' ? 600 : 500,
                          color: orgViewMode === 'list' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                          backgroundColor: orgViewMode === 'list' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          border: orgViewMode === 'list' ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                          borderRadius: '4px',
                          boxShadow: orgViewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <List size={13} />
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetOrgViewMode('grid')}
                        title="Grid View"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: orgViewMode === 'grid' ? 600 : 500,
                          color: orgViewMode === 'grid' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                          backgroundColor: orgViewMode === 'grid' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          border: orgViewMode === 'grid' ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                          borderRadius: '4px',
                          boxShadow: orgViewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <LayoutGrid size={13} />
                        Grid
                      </button>
                    </div>
                  </div>
                </div>

                {/* Organizations Content */}
                {filteredOrganizations.length === 0 ? (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                    }}
                  >
                    <Building2 size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.7 }} />
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
                      {orgSearchText || debouncedSearchQuery
                        ? 'No organizations match your search'
                        : 'No client organizations created yet'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      {orgSearchText || debouncedSearchQuery
                        ? 'Try clearing your search query or refine terms.'
                        : 'Create your first client account / organization to organize tickets and configure domain routing.'}
                    </p>
                    {orgSearchText || debouncedSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOrgSearchText('');
                          setSearchQuery('');
                          setOrgPage(1);
                        }}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <X size={14} /> Clear Search
                      </button>
                    ) : (
                      <button
                        onClick={openCreateOrgModal}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={14} /> Create First Organization
                      </button>
                    )}
                  </div>
                ) : orgViewMode === 'list' ? (
                  /* ================= LIST VIEW ================= */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px', width: '40px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isAllCurrentPageSelected || isAllFilteredSelected}
                              onChange={toggleSelectAllOrgs}
                              style={{ cursor: 'pointer', accentColor: 'var(--primary, #2563eb)' }}
                              title="Select / Deselect all"
                            />
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            ORGANIZATION & DETAILS
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            MAPPED EMAIL DOMAINS
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            PRIMARY CONTACT
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrganizations.map((org: any) => {
                          const domains = org.domains
                            ? org.domains
                                .split(/[\s,;]+/)
                                .map((d: string) => d.trim().replace(/^@/, ''))
                                .filter(Boolean)
                            : [];
                          const isExpanded = expandedOrgDomainIds.has(org.id);
                          const displayedDomains = isExpanded ? domains : domains.slice(0, 5);
                          const isSelected = selectedOrgIds.has(org.id);

                          return (
                            <tr
                              key={org.id}
                              style={{
                                borderBottom: '1px solid var(--border-subtle)',
                                backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                                transition: 'background-color 0.1s ease',
                              }}
                            >
                              <td style={{ padding: '12px 14px', verticalAlign: 'top', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => toggleSelectOrg(org.id, e as any)}
                                  style={{ cursor: 'pointer', accentColor: 'var(--primary, #2563eb)' }}
                                />
                              </td>
                              <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                  {/* Modern Organization Avatar Badge */}
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '8px',
                                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                                      border: '1px solid rgba(37, 99, 235, 0.16)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'var(--primary, #2563eb)',
                                      flexShrink: 0,
                                      marginTop: '1px',
                                    }}
                                  >
                                    <Building2 size={16} />
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span
                                        style={{
                                          fontSize: '13.5px',
                                          fontWeight: 650,
                                          color: 'var(--text-primary)',
                                          lineHeight: '1.3',
                                        }}
                                      >
                                        {org.name}
                                      </span>
                                      {org.product && (() => {
                                        const style = getProductBadgeStyle(org.product);
                                        return (
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              backgroundColor: style?.bg || 'rgba(168, 85, 247, 0.12)',
                                              color: style?.color || '#9333ea',
                                              border: `1px solid ${style?.border || 'rgba(168, 85, 247, 0.3)'}`,
                                              borderRadius: '3px',
                                              padding: '1.5px 6px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px',
                                            }}
                                            title={`Associated Product: ${org.product}`}
                                          >
                                            {style?.icon || '📦'} {org.product}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    {org.description && (
                                      <ActionNoteViewer
                                        content={org.description}
                                        style={{
                                          maxWidth: '420px',
                                          margin: '3px 0',
                                        }}
                                      />
                                    )}
                                    {org.website && (
                                      <div style={{ marginTop: '3px' }}>
                                        <a
                                          href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={org.website}
                                          style={{
                                            fontSize: '11px',
                                            color: 'var(--primary, #2563eb)',
                                            textDecoration: 'none',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3.5px',
                                            maxWidth: '280px',
                                            padding: '1.5px 7px',
                                            backgroundColor: 'rgba(37, 99, 235, 0.05)',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(37, 99, 235, 0.12)',
                                            transition: 'all 0.15s ease',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
                                            e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.3)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)';
                                            e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.12)';
                                          }}
                                        >
                                          <Globe size={11} style={{ flexShrink: 0, opacity: 0.8 }} />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                          </span>
                                          <ExternalLink size={9.5} style={{ flexShrink: 0, opacity: 0.6 }} />
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {domains.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                                    {displayedDomains.map((d: string, idx: number) => (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                          color: '#0284c7',
                                          border: '1px solid rgba(56, 189, 248, 0.3)',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {d.includes('@') ? d : `@${d}`}
                                      </span>
                                    ))}
                                    {domains.length > 5 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpandedOrgDomainIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(org.id)) next.delete(org.id);
                                            else next.add(org.id);
                                            return next;
                                          });
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          backgroundColor: isExpanded ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.08)',
                                          color: '#0369a1',
                                          border: '1px dashed rgba(2, 132, 199, 0.4)',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(2, 132, 199, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = isExpanded ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.08)';
                                        }}
                                      >
                                        {isExpanded ? 'Show less' : `+ ${domains.length - 5} more`}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    None configured
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {org.contactName || org.contactEmail || org.contactPhone ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                                    {org.contactName && (
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {org.contactName}
                                      </span>
                                    )}
                                    {org.contactEmail && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        ✉️ {org.contactEmail}
                                      </span>
                                    )}
                                    {org.contactPhone && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        📞 {org.contactPhone}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    —
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    onClick={() => openEditOrgModal(org)}
                                    title="Edit Organization"
                                    style={{
                                      padding: '5px 8px',
                                      border: '1px solid var(--border-subtle)',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrganization(org.id, org.name)}
                                    title="Delete Organization"
                                    style={{
                                      padding: '5px 8px',
                                      border: '1px solid #fee2e2',
                                      borderRadius: '4px',
                                      backgroundColor: '#fff5f5',
                                      cursor: 'pointer',
                                      color: '#ef4444',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ================= GRID VIEW ================= */
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {paginatedOrganizations.map((org: any) => {
                      const domains = org.domains
                        ? org.domains
                            .split(/[\s,;]+/)
                            .map((d: string) => d.trim().replace(/^@/, ''))
                            .filter(Boolean)
                        : [];
                      const isExpanded = expandedOrgDomainIds.has(org.id);
                      const displayedDomains = isExpanded ? domains : domains.slice(0, 4);
                      const isSelected = selectedOrgIds.has(org.id);

                      return (
                        <div
                          key={org.id}
                          style={{
                            backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.03)' : 'var(--bg-surface, #ffffff)',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: isSelected ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '16px',
                            boxShadow: isSelected ? '0 0 0 1px rgba(37, 99, 235, 0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                          }}
                        >
                          {/* Top Section */}
                          <div>
                            {/* Card Header */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '10px',
                                marginBottom: '12px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => toggleSelectOrg(org.id, e as any)}
                                  style={{ cursor: 'pointer', accentColor: 'var(--primary, #2563eb)', marginRight: '2px' }}
                                />
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                                    border: '1px solid rgba(37, 99, 235, 0.16)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--primary, #2563eb)',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Building2 size={18} />
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <h4
                                      style={{
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        margin: 0,
                                        color: 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={org.name}
                                    >
                                      {org.name}
                                    </h4>
                                    {org.product && (() => {
                                      const style = getProductBadgeStyle(org.product);
                                      return (
                                        <span
                                          style={{
                                            fontSize: '10.5px',
                                            fontWeight: 600,
                                            backgroundColor: style?.bg || 'rgba(168, 85, 247, 0.12)',
                                            color: style?.color || '#9333ea',
                                            border: `1px solid ${style?.border || 'rgba(168, 85, 247, 0.3)'}`,
                                            borderRadius: '3px',
                                            padding: '1px 5px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                          }}
                                          title={`Associated Product: ${org.product}`}
                                        >
                                          {style?.icon || '📦'} {org.product}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {org.website && (
                                    <div style={{ marginTop: '2px' }}>
                                      <a
                                        href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={org.website}
                                        style={{
                                          fontSize: '11px',
                                          color: 'var(--primary, #2563eb)',
                                          textDecoration: 'none',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          maxWidth: '190px',
                                        }}
                                      >
                                        <Globe size={11} style={{ flexShrink: 0, opacity: 0.8 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                        </span>
                                        <ExternalLink size={9.5} style={{ flexShrink: 0, opacity: 0.6 }} />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button
                                  onClick={() => openEditOrgModal(org)}
                                  title="Edit Organization"
                                  style={{
                                    padding: '5px 7px',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrganization(org.id, org.name)}
                                  title="Delete Organization"
                                  style={{
                                    padding: '5px 7px',
                                    border: '1px solid #fee2e2',
                                    borderRadius: '4px',
                                    backgroundColor: '#fff5f5',
                                    cursor: 'pointer',
                                    color: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Description / Notes */}
                            {org.description && (
                              <div style={{ marginBottom: '12px' }}>
                                <ActionNoteViewer content={org.description} style={{ fontSize: '11.5px' }} />
                              </div>
                            )}

                            {/* Mapped Domains */}
                            <div style={{ marginBottom: '14px' }}>
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  marginBottom: '5px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                Mapped Domains
                              </div>
                              {domains.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                  {displayedDomains.map((d: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                        color: '#0284c7',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      {d.includes('@') ? d : `@${d}`}
                                    </span>
                                  ))}
                                  {domains.length > 4 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedOrgDomainIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(org.id)) next.delete(org.id);
                                          else next.add(org.id);
                                          return next;
                                        });
                                      }}
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        backgroundColor: isExpanded ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.08)',
                                        color: '#0369a1',
                                        border: '1px dashed rgba(2, 132, 199, 0.4)',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {isExpanded ? 'Less' : `+${domains.length - 4}`}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  None configured
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Footer: Primary Contact */}
                          <div
                            style={{
                              marginTop: 'auto',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              fontSize: '11.5px',
                            }}
                          >
                            {org.contactName || org.contactEmail || org.contactPhone ? (
                              <>
                                {org.contactName && (
                                  <div style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
                                    👤 {org.contactName}
                                  </div>
                                )}
                                {org.contactEmail && (
                                  <div
                                    style={{
                                      color: 'var(--text-secondary)',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={org.contactEmail}
                                  >
                                    ✉️ {org.contactEmail}
                                  </div>
                                )}
                                {org.contactPhone && (
                                  <div style={{ color: 'var(--text-secondary)' }}>
                                    📞 {org.contactPhone}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No primary contact specified
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Smart Pagination Controls */}
                {filteredOrganizations.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginTop: '16px',
                      paddingTop: '14px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Range & Per-page selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Showing <strong>{Math.min((orgPage - 1) * orgPageSize + 1, filteredOrganizations.length)}</strong>–
                        <strong>{Math.min(orgPage * orgPageSize, filteredOrganizations.length)}</strong> of{' '}
                        <strong>{filteredOrganizations.length}</strong>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per page:</span>
                        <select
                          value={orgPageSize}
                          onChange={(e) => {
                            setOrgPageSize(Number(e.target.value));
                            setOrgPage(1);
                          }}
                          style={{
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    {/* Page buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={orgPage <= 1}
                        onClick={() => setOrgPage((p) => Math.max(p - 1, 1))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: orgPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: orgPage <= 1 ? 'not-allowed' : 'pointer',
                          opacity: orgPage <= 1 ? 0.5 : 1,
                        }}
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>

                      {Array.from({ length: totalOrgPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalOrgPages <= 7) return true;
                          if (page === 1 || page === totalOrgPages) return true;
                          return Math.abs(page - orgPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((p, idx) => {
                          if (typeof p === 'string') {
                            return (
                              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                ...
                              </span>
                            );
                          }
                          const isCurrent = p === orgPage;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setOrgPage(p as number)}
                              style={{
                                minWidth: '28px',
                                height: '28px',
                                padding: '0 6px',
                                fontSize: '12px',
                                fontWeight: isCurrent ? 700 : 500,
                                borderRadius: '4px',
                                border: isCurrent ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle)',
                                backgroundColor: isCurrent ? 'var(--primary, #2563eb)' : 'var(--bg-surface)',
                                color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}

                      <button
                        type="button"
                        disabled={orgPage >= totalOrgPages}
                        onClick={() => setOrgPage((p) => Math.min(p + 1, totalOrgPages))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: orgPage >= totalOrgPages ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: orgPage >= totalOrgPages ? 'not-allowed' : 'pointer',
                          opacity: orgPage >= totalOrgPages ? 0.5 : 1,
                        }}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tags' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Ticket Tags & Sender Domain Auto-Rules
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                      Organize tickets with custom color-coded tags and configure sender email domains to automatically tag new tickets on arrival.
                    </p>
                  </div>
                  <button onClick={openCreateTagModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Create Tag
                  </button>
                </div>

                {/* Search, Filter & View Mode Controls Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                  }}
                >
                  {/* Search Bar */}
                  <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search tags by name, domains, organization, product..."
                      value={tagSearchText}
                      onChange={(e) => {
                        setTagSearchText(e.target.value);
                        setTagPage(1);
                      }}
                      className="form-control"
                      style={{
                        paddingLeft: '34px',
                        paddingRight: tagSearchText ? '30px' : '12px',
                        fontSize: '13px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                    {tagSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setTagSearchText('');
                          if (debouncedSearchQuery) setSearchQuery('');
                          setTagPage(1);
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Right: Results Count & View Mode Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {filteredTags.length} {filteredTags.length === 1 ? 'tag' : 'tags'}
                    </span>

                    {/* View Mode Toggle: List vs Grid */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                        padding: '3px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSetTagViewMode('list')}
                        title="List View"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: tagViewMode === 'list' ? 600 : 500,
                          color: tagViewMode === 'list' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                          backgroundColor: tagViewMode === 'list' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          border: tagViewMode === 'list' ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                          borderRadius: '4px',
                          boxShadow: tagViewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <List size={13} />
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetTagViewMode('grid')}
                        title="Grid View"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: tagViewMode === 'grid' ? 600 : 500,
                          color: tagViewMode === 'grid' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                          backgroundColor: tagViewMode === 'grid' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          border: tagViewMode === 'grid' ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                          borderRadius: '4px',
                          boxShadow: tagViewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <LayoutGrid size={13} />
                        Grid
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tags Content */}
                {filteredTags.length === 0 ? (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                    }}
                  >
                    <TagIcon size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.7 }} />
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
                      {tagSearchText || debouncedSearchQuery
                        ? 'No tags match your search'
                        : 'No tags created yet'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      {tagSearchText || debouncedSearchQuery
                        ? 'Try clearing your search query or refine terms.'
                        : 'Create your first tag to organize tickets and set up auto-tagging rules based on sender email domains.'}
                    </p>
                    {tagSearchText || debouncedSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTagSearchText('');
                          setSearchQuery('');
                          setTagPage(1);
                        }}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <X size={14} /> Clear Search
                      </button>
                    ) : (
                      <button
                        onClick={openCreateTagModal}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={14} /> Create First Tag
                      </button>
                    )}
                  </div>
                ) : tagViewMode === 'list' ? (
                  /* ================= LIST VIEW ================= */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            TAG PREVIEW & NAME
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            AUTO-TAG SENDER DOMAINS
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            MAPPED ORG & PRODUCT
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            USAGE
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTags.map((tag: any) => {
                          const domains = tag.domains
                            ? tag.domains
                                .split(/[\s,;]+/)
                                .map((d: string) => d.trim().replace(/^@/, ''))
                                .filter(Boolean)
                            : [];
                          const isExpanded = expandedTagDomainIds.has(tag.id);
                          const displayedDomains = isExpanded ? domains : domains.slice(0, 5);

                          return (
                            <tr key={tag.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span
                                    style={{
                                      backgroundColor: tag.color ? `${tag.color}15` : '#f1f5f9',
                                      color: tag.color || '#334155',
                                      border: `1px solid ${tag.color ? `${tag.color}40` : '#cbd5e1'}`,
                                      borderRadius: '4px',
                                      padding: '3px 9px',
                                      fontSize: '12px',
                                      fontWeight: 650,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: tag.color || '#64748b',
                                      }}
                                    />
                                    {tag.name}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {domains.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {displayedDomains.map((d: string, idx: number) => (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          backgroundColor: '#eff6ff',
                                          color: '#1d4ed8',
                                          border: '1px solid #bfdbfe',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {d.includes('@') ? d : `@${d}`}
                                      </span>
                                    ))}
                                    {domains.length > 5 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpandedTagDomainIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(tag.id)) next.delete(tag.id);
                                            else next.add(tag.id);
                                            return next;
                                          });
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          backgroundColor: isExpanded ? 'rgba(29, 78, 216, 0.15)' : 'rgba(29, 78, 216, 0.08)',
                                          color: '#1d4ed8',
                                          border: '1px dashed rgba(29, 78, 216, 0.4)',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(29, 78, 216, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = isExpanded ? 'rgba(29, 78, 216, 0.15)' : 'rgba(29, 78, 216, 0.08)';
                                        }}
                                      >
                                        {isExpanded ? 'Show less' : `+ ${domains.length - 5} more`}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    None (Manual tagging only)
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                                  {tag.organization && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                        color: '#0284c7',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        borderRadius: '3px',
                                        padding: '2px 6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                      }}
                                      title={`Auto-maps organization: ${tag.organization}`}
                                    >
                                      🏢 {tag.organization}
                                    </span>
                                  )}
                                  {tag.product && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                        color: '#9333ea',
                                        border: '1px solid rgba(168, 85, 247, 0.3)',
                                        borderRadius: '3px',
                                        padding: '2px 6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                      }}
                                      title={`Auto-maps product: ${tag.product}`}
                                    >
                                      📦 {tag.product}
                                    </span>
                                  )}
                                  {!tag.organization && !tag.product && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      —
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {tag.usageCount || 0}
                                </span>{' '}
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>tickets</span>
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    onClick={() => openEditTagModal(tag)}
                                    title="Edit Tag"
                                    style={{
                                      padding: '5px 8px',
                                      border: '1px solid var(--border-subtle)',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTag(tag.id, tag.name)}
                                    title="Delete Tag"
                                    style={{
                                      padding: '5px 8px',
                                      border: '1px solid #fee2e2',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      cursor: 'pointer',
                                      color: '#dc2626',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ================= GRID VIEW ================= */
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {paginatedTags.map((tag: any) => {
                      const domains = tag.domains
                        ? tag.domains
                            .split(/[\s,;]+/)
                            .map((d: string) => d.trim().replace(/^@/, ''))
                            .filter(Boolean)
                        : [];
                      const isExpanded = expandedTagDomainIds.has(tag.id);
                      const displayedDomains = isExpanded ? domains : domains.slice(0, 4);
                      const tagCol = tag.color || '#3b82f6';

                      return (
                        <div
                          key={tag.id}
                          style={{
                            backgroundColor: 'var(--bg-surface, #ffffff)',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Top Section */}
                          <div>
                            {/* Card Header: Tag Preview Badge & Actions */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                marginBottom: '12px',
                              }}
                            >
                              <span
                                style={{
                                  backgroundColor: `${tagCol}15`,
                                  color: tagCol,
                                  border: `1px solid ${tagCol}40`,
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: tagCol,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {tag.name}
                                </span>
                              </span>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button
                                  onClick={() => openEditTagModal(tag)}
                                  title="Edit Tag"
                                  style={{
                                    padding: '5px 7px',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                                  title="Delete Tag"
                                  style={{
                                    padding: '5px 7px',
                                    border: '1px solid #fee2e2',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Mapped Organization & Product */}
                            {(tag.organization || tag.product) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                                {tag.organization && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                      color: '#0284c7',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                      borderRadius: '4px',
                                      padding: '2px 7px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                    title={`Auto-maps organization: ${tag.organization}`}
                                  >
                                    🏢 {tag.organization}
                                  </span>
                                )}
                                {tag.product && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      backgroundColor: 'rgba(168, 85, 247, 0.12)',
                                      color: '#9333ea',
                                      border: '1px solid rgba(168, 85, 247, 0.3)',
                                      borderRadius: '4px',
                                      padding: '2px 7px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                    }}
                                    title={`Auto-maps product: ${tag.product}`}
                                  >
                                    📦 {tag.product}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Auto-Tag Sender Domains */}
                            <div style={{ marginBottom: '12px' }}>
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  marginBottom: '5px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                Auto-Tag Domains
                              </div>
                              {domains.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                  {displayedDomains.map((d: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        border: '1px solid #bfdbfe',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      {d.includes('@') ? d : `@${d}`}
                                    </span>
                                  ))}
                                  {domains.length > 4 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedTagDomainIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(tag.id)) next.delete(tag.id);
                                          else next.add(tag.id);
                                          return next;
                                        });
                                      }}
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        backgroundColor: isExpanded ? 'rgba(29, 78, 216, 0.15)' : 'rgba(29, 78, 216, 0.08)',
                                        color: '#1d4ed8',
                                        border: '1px dashed rgba(29, 78, 216, 0.4)',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {isExpanded ? 'Less' : `+${domains.length - 4}`}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  None (Manual tagging only)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Footer: Usage Count */}
                          <div
                            style={{
                              marginTop: 'auto',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <span>Usage:</span>
                            <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
                              {tag.usageCount || 0} tickets
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Smart Pagination Controls */}
                {filteredTags.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginTop: '16px',
                      paddingTop: '14px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Range & Per-page selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Showing <strong>{Math.min((tagPage - 1) * tagPageSize + 1, filteredTags.length)}</strong>–
                        <strong>{Math.min(tagPage * tagPageSize, filteredTags.length)}</strong> of{' '}
                        <strong>{filteredTags.length}</strong>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per page:</span>
                        <select
                          value={tagPageSize}
                          onChange={(e) => {
                            setTagPageSize(Number(e.target.value));
                            setTagPage(1);
                          }}
                          style={{
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    {/* Page buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={tagPage <= 1}
                        onClick={() => setTagPage((p) => Math.max(p - 1, 1))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: tagPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: tagPage <= 1 ? 'not-allowed' : 'pointer',
                          opacity: tagPage <= 1 ? 0.5 : 1,
                        }}
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>

                      {Array.from({ length: totalTagPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalTagPages <= 7) return true;
                          if (page === 1 || page === totalTagPages) return true;
                          return Math.abs(page - tagPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((p, idx) => {
                          if (typeof p === 'string') {
                            return (
                              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                ...
                              </span>
                            );
                          }
                          const isCurrent = p === tagPage;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setTagPage(p as number)}
                              style={{
                                minWidth: '28px',
                                height: '28px',
                                padding: '0 6px',
                                fontSize: '12px',
                                fontWeight: isCurrent ? 700 : 500,
                                borderRadius: '4px',
                                border: isCurrent ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle)',
                                backgroundColor: isCurrent ? 'var(--primary, #2563eb)' : 'var(--bg-surface)',
                                color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}

                      <button
                        type="button"
                        disabled={tagPage >= totalTagPages}
                        onClick={() => setTagPage((p) => Math.min(p + 1, totalTagPages))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: tagPage >= totalTagPages ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: tagPage >= totalTagPages ? 'not-allowed' : 'pointer',
                          opacity: tagPage >= totalTagPages ? 0.5 : 1,
                        }}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Ticket Categories & Keyword Auto-Matching
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                      Categorize support tickets and define up to 25 keywords per category to automatically classify inbound customer messages.
                    </p>
                  </div>
                  <button onClick={openCreateCategoryModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Create Category
                  </button>
                </div>

                {/* Search, Filter & View Mode Controls Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                  }}
                >
                  {/* Search Bar */}
                  <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search categories by name, keywords, description..."
                      value={catSearchText}
                      onChange={(e) => {
                        setCatSearchText(e.target.value);
                        setCatPage(1);
                      }}
                      className="form-control"
                      style={{
                        paddingLeft: '34px',
                        paddingRight: catSearchText ? '30px' : '12px',
                        fontSize: '13px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                      }}
                    />
                    {catSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatSearchText('');
                          if (debouncedSearchQuery) setSearchQuery('');
                          setCatPage(1);
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Right: Results Count & View Mode Switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
                    </span>

                    {/* View Mode Toggle: List vs Grid */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                        padding: '3px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSetCatViewMode('list')}
                        title="List View"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: catViewMode === 'list' ? 600 : 500,
                          color: catViewMode === 'list' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                          backgroundColor: catViewMode === 'list' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          border: catViewMode === 'list' ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                          borderRadius: '4px',
                          boxShadow: catViewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <List size={13} />
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetCatViewMode('grid')}
                        title="Grid View"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: catViewMode === 'grid' ? 600 : 500,
                          color: catViewMode === 'grid' ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                          backgroundColor: catViewMode === 'grid' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                          border: catViewMode === 'grid' ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                          borderRadius: '4px',
                          boxShadow: catViewMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <LayoutGrid size={13} />
                        Grid
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categories Content */}
                {filteredCategories.length === 0 ? (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-subtle)',
                    }}
                  >
                    <Folder size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.7 }} />
                    <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
                      {catSearchText || debouncedSearchQuery
                        ? 'No categories match your search'
                        : 'No categories created yet'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      {catSearchText || debouncedSearchQuery
                        ? 'Try clearing your search query or refine terms.'
                        : 'Create your first category and add keywords like "billing, payment, refund" to classify incoming tickets.'}
                    </p>
                    {catSearchText || debouncedSearchQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCatSearchText('');
                          setSearchQuery('');
                          setCatPage(1);
                        }}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <X size={14} /> Clear Search
                      </button>
                    ) : (
                      <button
                        onClick={openCreateCategoryModal}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Plus size={14} /> Create First Category
                      </button>
                    )}
                  </div>
                ) : catViewMode === 'list' ? (
                  /* ================= LIST VIEW ================= */
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            CATEGORY & PREVIEW
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            KEYWORD RULES (MAX 25)
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            USAGE
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCategories.map((cat: any) => {
                          const keywords = cat.keywords
                            ? Array.from<string>(
                                new Set(
                                  cat.keywords
                                    .split(/[,;\n]+/)
                                    .map((k: string) => k.trim())
                                    .filter((k: string) => k.length >= 2),
                                ),
                              ).slice(0, 25)
                            : [];

                          const isExpanded = expandedCategoryKeywordIds.has(cat.id);
                          const displayedKeywords = isExpanded ? keywords : keywords.slice(0, 10);
                          const catColor = cat.color || '#6366f1';

                          return (
                            <tr
                              key={cat.id}
                              style={{ borderBottom: '1px solid var(--border-subtle)' }}
                            >
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span
                                    style={{
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      backgroundColor: `${catColor}15`,
                                      color: catColor,
                                      border: `1px solid ${catColor}40`,
                                      padding: '3px 9px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: '7px',
                                        height: '7px',
                                        borderRadius: '50%',
                                        backgroundColor: catColor,
                                      }}
                                    />
                                    {cat.name}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {keywords.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {displayedKeywords.map((k: string, idx: number) => (
                                      <span
                                        key={idx}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          backgroundColor: '#f5f3ff',
                                          color: '#7c3aed',
                                          border: '1px solid #ddd6fe',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        {k}
                                      </span>
                                    ))}
                                    {keywords.length > 10 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setExpandedCategoryKeywordIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(cat.id)) next.delete(cat.id);
                                            else next.add(cat.id);
                                            return next;
                                          });
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          backgroundColor: isExpanded ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
                                          color: '#7c3aed',
                                          border: '1px dashed rgba(124, 58, 237, 0.4)',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = 'rgba(124, 58, 237, 0.2)';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = isExpanded ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)';
                                        }}
                                      >
                                        {isExpanded ? 'Show less' : `+${keywords.length - 10} more`}
                                      </button>
                                    )}
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      ({keywords.length}/25)
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    None (Manual assignment only)
                                  </span>
                                )}
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {cat.usageCount || 0}
                                </span>{' '}
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>tickets</span>
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    onClick={() => openEditCategoryModal(cat)}
                                    title="Edit Category"
                                    style={{
                                      padding: '5px 8px',
                                      border: '1px solid var(--border-subtle)',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      cursor: 'pointer',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                    title="Delete Category"
                                    style={{
                                      padding: '5px 8px',
                                      border: '1px solid #fee2e2',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      cursor: 'pointer',
                                      color: '#dc2626',
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ================= GRID VIEW ================= */
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    {paginatedCategories.map((cat: any) => {
                      const keywords = cat.keywords
                        ? Array.from<string>(
                            new Set(
                              cat.keywords
                                .split(/[,;\n]+/)
                                .map((k: string) => k.trim())
                                .filter((k: string) => k.length >= 2),
                            ),
                          ).slice(0, 25)
                        : [];

                      const isExpanded = expandedCategoryKeywordIds.has(cat.id);
                      const displayedKeywords = isExpanded ? keywords : keywords.slice(0, 8);
                      const catColor = cat.color || '#6366f1';

                      return (
                        <div
                          key={cat.id}
                          style={{
                            backgroundColor: 'var(--bg-surface, #ffffff)',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Top Section */}
                          <div>
                            {/* Card Header: Category Badge & Actions */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                marginBottom: '12px',
                              }}
                            >
                              <span
                                style={{
                                  backgroundColor: `${catColor}15`,
                                  color: catColor,
                                  border: `1px solid ${catColor}40`,
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '13px',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: catColor,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cat.name}
                                </span>
                              </span>

                              {/* Action Buttons */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                <button
                                  onClick={() => openEditCategoryModal(cat)}
                                  title="Edit Category"
                                  style={{
                                    padding: '5px 7px',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                  title="Delete Category"
                                  style={{
                                    padding: '5px 7px',
                                    border: '1px solid #fee2e2',
                                    borderRadius: '4px',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    color: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Keyword Rules */}
                            <div style={{ marginBottom: '12px' }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '10.5px',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  marginBottom: '5px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}
                              >
                                <span>Keyword Rules</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  ({keywords.length}/25)
                                </span>
                              </div>
                              {keywords.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                  {displayedKeywords.map((k: string, idx: number) => (
                                    <span
                                      key={idx}
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        backgroundColor: '#f5f3ff',
                                        color: '#7c3aed',
                                        border: '1px solid #ddd6fe',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      {k}
                                    </span>
                                  ))}
                                  {keywords.length > 8 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedCategoryKeywordIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(cat.id)) next.delete(cat.id);
                                          else next.add(cat.id);
                                          return next;
                                        });
                                      }}
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        backgroundColor: isExpanded ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
                                        color: '#7c3aed',
                                        border: '1px dashed rgba(124, 58, 237, 0.4)',
                                        padding: '1.5px 6px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {isExpanded ? 'Less' : `+${keywords.length - 8}`}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  None (Manual assignment only)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Footer: Usage Count */}
                          <div
                            style={{
                              marginTop: 'auto',
                              paddingTop: '10px',
                              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11.5px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <span>Usage:</span>
                            <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>
                              {cat.usageCount || 0} tickets
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Smart Pagination Controls */}
                {filteredCategories.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginTop: '16px',
                      paddingTop: '14px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Range & Per-page selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        Showing <strong>{Math.min((catPage - 1) * catPageSize + 1, filteredCategories.length)}</strong>–
                        <strong>{Math.min(catPage * catPageSize, filteredCategories.length)}</strong> of{' '}
                        <strong>{filteredCategories.length}</strong>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per page:</span>
                        <select
                          value={catPageSize}
                          onChange={(e) => {
                            setCatPageSize(Number(e.target.value));
                            setCatPage(1);
                          }}
                          style={{
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                    </div>

                    {/* Page buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={catPage <= 1}
                        onClick={() => setCatPage((p) => Math.max(p - 1, 1))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: catPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: catPage <= 1 ? 'not-allowed' : 'pointer',
                          opacity: catPage <= 1 ? 0.5 : 1,
                        }}
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>

                      {Array.from({ length: totalCatPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalCatPages <= 7) return true;
                          if (page === 1 || page === totalCatPages) return true;
                          return Math.abs(page - catPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((p, idx) => {
                          if (typeof p === 'string') {
                            return (
                              <span key={`dots-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                ...
                              </span>
                            );
                          }
                          const isCurrent = p === catPage;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setCatPage(p as number)}
                              style={{
                                minWidth: '28px',
                                height: '28px',
                                padding: '0 6px',
                                fontSize: '12px',
                                fontWeight: isCurrent ? 700 : 500,
                                borderRadius: '4px',
                                border: isCurrent ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle)',
                                backgroundColor: isCurrent ? 'var(--primary, #2563eb)' : 'var(--bg-surface)',
                                color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}

                      <button
                        type="button"
                        disabled={catPage >= totalCatPages}
                        onClick={() => setCatPage((p) => Math.min(p + 1, totalCatPages))}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 500,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface)',
                          color: catPage >= totalCatPages ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: catPage >= totalCatPages ? 'not-allowed' : 'pointer',
                          opacity: catPage >= totalCatPages ? 0.5 : 1,
                        }}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Shift Roster & Product Matrix Callout */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Shift Roster &amp; Multi-Tier Product Mapping
                    </h4>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Map L1/L2/L3 tiers to your organization's products, configure weekly rotations, holiday duties &amp; generate live rosters.
                  </p>
                </div>
                <Link
                  to="/roster"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600', padding: '8px 14px' }}
                >
                  <Calendar size={14} /> Open Roster Console
                </Link>
              </div>

              {/* Teams Section */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Support Teams</h3>
                  <button
                    onClick={() => setIsCreateTeamOpen(true)}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus size={14} /> Create Team
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredTeams.length === 0 ? (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      No support teams configured.
                    </div>
                  ) : (
                    filteredTeams.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          padding: '16px 18px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border-subtle)',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                          gap: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t.name}
                            </span>
                            <code style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                              {t.slug}
                            </code>
                            {t.tier && <span className="tier-pill L1" style={{ fontSize: '11px', padding: '2px 7px' }}>{t.tier} Tier</span>}
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                            {t.description || 'No description provided.'}
                          </div>
                          <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 650, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Users size={13} style={{ color: 'var(--primary)' }} /> {t.members?.length || 0} {t.members?.length === 1 ? 'member' : 'members'}:
                              </span>
                              {t.members && t.members.length > 0 ? (
                                t.members.map((m: any) => (
                                  <span
                                    key={m.id}
                                    style={{
                                      fontSize: '11px',
                                      padding: '3px 9px',
                                      borderRadius: '6px',
                                      background: m.isLead ? '#fef3c7' : '#f8fafc',
                                      color: m.isLead ? '#92400e' : '#334155',
                                      border: m.isLead ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                      fontWeight: m.isLead ? '600' : '500',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {m.isLead && <span style={{ color: '#d97706' }}>⭐ Lead:</span>}
                                    <span>{m.user?.fullName || m.user?.displayName || m.user?.email || 'Staff'}</span>
                                    <span style={{ fontSize: '10px', color: m.isLead ? '#b45309' : '#64748b', opacity: 0.85 }}>({m.grade || 'Junior'})</span>
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No staff assigned yet
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, alignSelf: 'flex-start', marginTop: '2px' }}>
                          <button
                            onClick={() => setSelectedTeamForMembers(t)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap',
                              height: '32px',
                              padding: '0 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            <Users size={13} /> Manage Members
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(t)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#dc2626', height: '32px', width: '32px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Delete Team"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Queues Section */}
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Routing Queues</h3>
                  <button
                    onClick={() => setIsCreateQueueOpen(true)}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus size={14} /> Create Queue
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredQueues.length === 0 ? (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      No routing queues configured.
                    </div>
                  ) : (
                    filteredQueues.map((q) => (
                      <div
                        key={q.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {q.name} (Slug: {q.slug})
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Strategy: {q.routing} | Tier: {q.tier} | Brand: {q.brand?.name || 'All'}{' '}
                            | Team: {q.team?.name || 'Unassigned'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {q.isDefault && <span className="badge badge-open">Default</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="card">
              {/* Directory Sub-Nav Switcher */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '12px',
                  marginBottom: '16px',
                }}
              >
                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UserPlus size={13} />
                  <span>Staff Directory ({totalStaffCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('customers')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UserCheck size={13} />
                  <span>Customers & Guests ({totalCustomerCount})</span>
                </button>
              </div>

              {/* Section Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Staff Directory</h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--primary-surface, #eff6ff)',
                        color: 'var(--primary, #2563eb)',
                        border: '1px solid var(--primary-border, #bfdbfe)',
                      }}
                    >
                      {filteredStaffUsers.length} of {totalStaffCount} Staff
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Administrators, support tiers (L1, L2, L3), developers, and QA specialists with agent workspace access.
                  </p>
                </div>
                <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary btn-sm">
                  <UserPlus size={14} /> Invite New Staff
                </button>
              </div>

              {/* Search & Filters Toolbar */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search staff by name, email, or role..."
                    value={staffSearchText}
                    onChange={(e) => setStaffSearchText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 30px 7px 32px',
                      fontSize: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {staffSearchText && (
                    <button
                      onClick={() => setStaffSearchText('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '2px',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <select
                  value={staffRoleFilter}
                  onChange={(e) => setStaffRoleFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Tenant Admin</option>
                  <option value="L1">L1 Support</option>
                  <option value="L2">L2 Support</option>
                  <option value="L3">L3 Support</option>
                  <option value="DEV">Dev Team</option>
                  <option value="DEVOPS">DevOps / Infra</option>
                  <option value="QA">QA Team</option>
                </select>

                <select
                  value={staffStatusFilter}
                  onChange={(e) => setStaffStatusFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="SUSPENDED">Suspended Only</option>
                </select>
              </div>

              {/* Staff List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredStaffUsers.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '28px 0',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    No staff members found matching search filters.
                  </div>
                ) : (
                  filteredStaffUsers.map((u) => {
                    const roleName = u.roles?.[0]?.role?.name || 'Staff';
                    const tier = u.roles?.[0]?.role?.tier;
                    const isSuspended = u.status === 'SUSPENDED';

                    let tierPillClass = 'tier-pill L1';
                    let customStyle: React.CSSProperties | undefined;

                    if (tier === 'L1' || roleName.toLowerCase().includes('l1')) tierPillClass = 'tier-pill L1';
                    else if (tier === 'L2' || roleName.toLowerCase().includes('l2')) tierPillClass = 'tier-pill L2';
                    else if (tier === 'L3' || roleName.toLowerCase().includes('l3')) tierPillClass = 'tier-pill L3';
                    else if (tier === 'DEV' || (roleName.toLowerCase().includes('dev') && !roleName.toLowerCase().includes('devops'))) tierPillClass = 'tier-pill DEV';
                    else if (tier === 'DEVOPS' || roleName.toLowerCase().includes('devops') || roleName.toLowerCase().includes('infra')) tierPillClass = 'tier-pill DEVOPS';
                    else if (tier === 'QA' || roleName.toLowerCase().includes('qa')) tierPillClass = 'tier-pill QA';
                    else if (roleName.toLowerCase().includes('admin')) {
                      tierPillClass = 'tier-pill';
                      customStyle = {
                        color: '#1d4ed8',
                        backgroundColor: '#eff6ff',
                        borderColor: '#bfdbfe',
                        fontWeight: 600,
                      };
                    }

                    return (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle, #f1f5f9)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {u.fullName || 'Unnamed Staff'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {u.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={tierPillClass} style={customStyle}>
                            {roleName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: isSuspended ? '#ef4444' : '#10b981',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ● {u.status}
                          </span>
                          <button
                            onClick={() => handleOpenEditStaffRole(u)}
                            className="btn btn-sm btn-secondary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Change Role"
                          >
                            <Shield size={12} />
                            Change Role
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`btn btn-sm ${isSuspended ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            {isSuspended ? 'Activate' : 'Suspend'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="card">
              {/* Directory Sub-Nav Switcher */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '12px',
                  marginBottom: '16px',
                }}
              >
                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UserPlus size={13} />
                  <span>Staff Directory ({totalStaffCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('customers')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UserCheck size={13} />
                  <span>Customers & Guests ({totalCustomerCount})</span>
                </button>
              </div>

              {/* Section Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Customer & Guest Directory</h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      {filteredCustomerUsers.length} of {totalCustomerCount} Customers
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    End users, guests, and customers raising tickets or participating via embeddable widget and email.
                  </p>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search customers by name or email..."
                    value={customerSearchText}
                    onChange={(e) => setCustomerSearchText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 30px 7px 32px',
                      fontSize: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  {customerSearchText && (
                    <button
                      onClick={() => setCustomerSearchText('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        padding: '2px',
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <select
                  value={customerStatusFilter}
                  onChange={(e) => setCustomerStatusFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="SUSPENDED">Suspended Only</option>
                </select>
              </div>

              {/* Customer List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredCustomerUsers.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '28px 0',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    No customers found matching search filters.
                  </div>
                ) : (
                  filteredCustomerUsers.map((u) => {
                    const roleName = u.roles?.[0]?.role?.name || 'Guest User / Customer';
                    const isSuspended = u.status === 'SUSPENDED';

                    return (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle, #f1f5f9)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {u.fullName || 'Customer User'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {u.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span
                            style={{
                              color: '#475569',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {roleName}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: isSuspended ? '#ef4444' : '#10b981',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            ● {u.status}
                          </span>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`btn btn-sm ${isSuspended ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            {isSuspended ? 'Activate' : 'Suspend'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'sso' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
                      Single Sign-On (SSO) Configurations
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Configure enterprise identity providers using OpenID Connect (OIDC) or SAML
                      2.0.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={openAddOidcModal} className="btn btn-primary btn-sm">
                      <Plus size={14} /> Add OIDC Provider
                    </button>
                    <button onClick={openAddSamlModal} className="btn btn-primary btn-sm">
                      <Plus size={14} /> Add SAML Provider
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredSsoProviders.length === 0 ? (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '24px 0',
                      }}
                    >
                      No SSO providers configured yet. Create one to enable passwordless enterprise
                      login.
                    </div>
                  ) : (
                    filteredSsoProviders.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{p.displayName}</div>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--border-subtle)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {p.protocol}
                            </span>
                            <span className="badge badge-open">
                              {p.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: 'var(--text-muted)',
                              marginTop: '4px',
                            }}
                          >
                            Issuer: <span style={{ fontFamily: 'monospace' }}>{p.issuer}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Email Domains: {p.emailDomains?.join(', ')}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Auto-Provisioning (JIT): {p.jitProvisioning ? 'Enabled' : 'Disabled'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEditSsoProvider(p)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Edit size={12} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSsoProvider(p.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create SSO Provider Modal */}
      <Modal
        isOpen={isCreateSsoOpen}
        onClose={() => setIsCreateSsoOpen(false)}
        title={`Configure New ${ssoProviderType} SSO Provider`}
      >
        <form
          onSubmit={handleCreateSsoProvider}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          {ssoProviderType === 'OIDC' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 0',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '8px',
              }}
            >
              <input
                type="checkbox"
                id="googleDefaults"
                checked={useGoogleDefaults}
                onChange={(e) => handleToggleGoogleDefaults(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label
                htmlFor="googleDefaults"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--primary)',
                }}
              >
                Use Standard Google Workspace URLs (Locks static endpoints)
              </label>
            </div>
          )}

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Display Name *
            </label>
            <input
              type="text"
              value={ssoDisplayName}
              onChange={(e) => setSsoDisplayName(e.target.value)}
              placeholder="e.g. Okta Corporate SSO"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor:
                  ssoProviderType === 'OIDC' && useGoogleDefaults ? '#e2e8f0' : '#f8fafc',
                color: ssoProviderType === 'OIDC' && useGoogleDefaults ? '#64748b' : '#0f172a',
              }}
              readOnly={ssoProviderType === 'OIDC' && useGoogleDefaults}
              required
            />
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Issuer (Entity ID) *
            </label>
            <input
              type="text"
              value={ssoIssuer}
              onChange={(e) => setSsoIssuer(e.target.value)}
              placeholder="e.g. https://identity.yourcompany.com"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor:
                  ssoProviderType === 'OIDC' && useGoogleDefaults ? '#e2e8f0' : '#f8fafc',
                color: ssoProviderType === 'OIDC' && useGoogleDefaults ? '#64748b' : '#0f172a',
              }}
              readOnly={ssoProviderType === 'OIDC' && useGoogleDefaults}
              required
            />
          </div>

          {ssoProviderType === 'OIDC' ? (
            <>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  Client ID *
                </label>
                <input
                  type="text"
                  value={ssoClientId}
                  onChange={(e) => setSsoClientId(e.target.value)}
                  placeholder="OAuth Client ID"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  {isEditingSso
                    ? 'Client Secret (leave blank to keep existing)'
                    : 'Client Secret *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showClientSecret ? 'text' : 'password'}
                    value={ssoClientSecret}
                    onChange={(e) => setSsoClientSecret(e.target.value)}
                    placeholder={isEditingSso ? '•••••••• (unchanged)' : 'OAuth Client Secret'}
                    className="form-control"
                    style={{
                      width: '100%',
                      padding: '8px 40px 8px 8px',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                    }}
                    required={!isEditingSso}
                  />
                  <button
                    type="button"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showClientSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  Authorization Endpoint URL *
                </label>
                <input
                  type="text"
                  value={ssoAuthorizationUrl}
                  onChange={(e) => setSsoAuthorizationUrl(e.target.value)}
                  placeholder="https://identity.yourcompany.com/oauth2/v1/authorize"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: useGoogleDefaults ? '#e2e8f0' : '#f8fafc',
                    color: useGoogleDefaults ? '#64748b' : '#0f172a',
                  }}
                  readOnly={useGoogleDefaults}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  Token Endpoint URL *
                </label>
                <input
                  type="text"
                  value={ssoTokenUrl}
                  onChange={(e) => setSsoTokenUrl(e.target.value)}
                  placeholder="https://identity.yourcompany.com/oauth2/v1/token"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: useGoogleDefaults ? '#e2e8f0' : '#f8fafc',
                    color: useGoogleDefaults ? '#64748b' : '#0f172a',
                  }}
                  readOnly={useGoogleDefaults}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  Userinfo Endpoint URL
                </label>
                <input
                  type="text"
                  value={ssoUserinfoUrl}
                  onChange={(e) => setSsoUserinfoUrl(e.target.value)}
                  placeholder="https://identity.yourcompany.com/oauth2/v1/userinfo (optional)"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: useGoogleDefaults ? '#e2e8f0' : '#f8fafc',
                    color: useGoogleDefaults ? '#64748b' : '#0f172a',
                  }}
                  readOnly={useGoogleDefaults}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  JWKS URI
                </label>
                <input
                  type="text"
                  value={ssoJwksUri}
                  onChange={(e) => setSsoJwksUri(e.target.value)}
                  placeholder="https://identity.yourcompany.com/oauth2/v1/keys (optional)"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: useGoogleDefaults ? '#e2e8f0' : '#f8fafc',
                    color: useGoogleDefaults ? '#64748b' : '#0f172a',
                  }}
                  readOnly={useGoogleDefaults}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  SAML SSO Endpoint URL *
                </label>
                <input
                  type="text"
                  value={ssoSamlUrl}
                  onChange={(e) => setSsoSamlUrl(e.target.value)}
                  placeholder="https://identity.yourcompany.com/saml2/sso"
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}
                >
                  {isEditingSso
                    ? 'X.509 Public Certificate (leave blank to keep existing)'
                    : 'X.509 Public Certificate *'}
                </label>
                <textarea
                  value={ssoSamlCert}
                  onChange={(e) => setSsoSamlCert(e.target.value)}
                  placeholder={
                    isEditingSso
                      ? '•••••••• (unchanged)'
                      : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
                  }
                  className="form-control"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                  }}
                  required={!isEditingSso}
                />
              </div>
            </>
          )}

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Email Domain *
            </label>
            <input
              type="text"
              value={ssoDomains}
              onChange={(e) => setSsoDomains(e.target.value)}
              placeholder="e.g. yourcompany.com"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <input
              type="checkbox"
              id="ssoJit"
              checked={ssoJit}
              onChange={(e) => setSsoJit(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label
              htmlFor="ssoJit"
              style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Enable JIT Provisioning (Automatically create user accounts on login)
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '10px',
              marginTop: '8px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Save Configuration
          </button>
        </form>
      </Modal>

      {/* Create Brand Modal */}
      <Modal
        isOpen={isCreateBrandOpen}
        onClose={() => setIsCreateBrandOpen(false)}
        title="Create New Product Brand"
      >
        <form
          onSubmit={handleCreateBrand}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Brand Name *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Acme Billing"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              URL Slug *
            </label>
            <input
              type="text"
              value={brandSlug}
              onChange={(e) => setBrandSlug(e.target.value)}
              placeholder="e.g. billing (alphanumeric & hyphens)"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Support Email
            </label>
            <input
              type="email"
              value={brandSupportEmail}
              onChange={(e) => setBrandSupportEmail(e.target.value)}
              placeholder="e.g. billing-support@acme.com"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Portal Custom Domain
            </label>
            <input
              type="text"
              value={brandPortalDomain}
              onChange={(e) => setBrandPortalDomain(e.target.value)}
              placeholder="e.g. billing-help.acme.com"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            <input
              type="checkbox"
              checked={brandIsDefault}
              onChange={(e) => setBrandIsDefault(e.target.checked)}
            />
            <span>Set as Default Brand for this tenant</span>
          </label>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
          >
            <button
              type="button"
              onClick={() => setIsCreateBrandOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Create Brand
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Brand Modal */}
      <Modal
        isOpen={isEditBrandOpen}
        onClose={() => setIsEditBrandOpen(false)}
        title="Edit Product Brand"
      >
        <form
          onSubmit={handleUpdateBrand}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Brand Name *
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              URL Slug *
            </label>
            <input
              type="text"
              value={brandSlug}
              onChange={(e) => setBrandSlug(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Support Email
            </label>
            <input
              type="email"
              value={brandSupportEmail}
              onChange={(e) => setBrandSupportEmail(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Portal Custom Domain
            </label>
            <input
              type="text"
              value={brandPortalDomain}
              onChange={(e) => setBrandPortalDomain(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            <input
              type="checkbox"
              checked={brandIsDefault}
              onChange={(e) => setBrandIsDefault(e.target.checked)}
            />
            <span>Set as Default Brand for this tenant</span>
          </label>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
          >
            <button
              type="button"
              onClick={() => setIsEditBrandOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Staff Role Modal */}
      <Modal
        isOpen={!!editingStaffUser}
        onClose={() => setEditingStaffUser(null)}
        title="Change Staff Role"
      >
        <div style={{ position: 'relative' }}>
          {isUpdatingStaffRole && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <LoadingSpinner size={24} text="Updating role..." />
            </div>
          )}

          {editingStaffUser && (
            <form
              onSubmit={handleSaveStaffRole}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* User Summary Card */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {editingStaffUser.fullName || 'Unnamed Staff'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {editingStaffUser.email}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  Current: {editingStaffUser.roles?.[0]?.role?.name || 'Staff'}
                </span>
              </div>

              <div>
                <label
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
                >
                  New Support Role *
                </label>
                <select
                  value={editStaffRoleId}
                  onChange={(e) => setEditStaffRoleId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                  required
                >
                  <option value="">Select a Role...</option>
                  {[...roles]
                    .filter((r) => r.isStaff)
                    .sort((a, b) => {
                      const ROLE_ORDER: Record<string, number> = {
                        TENANT_ADMIN: 1,
                        L1_SUPPORT: 2,
                        L2_SUPPORT: 3,
                        L3_SUPPORT: 4,
                        DEV_TEAM: 5,
                        DEVOPS_TEAM: 6,
                        QA_TEAM: 7,
                      };
                      const orderA = ROLE_ORDER[a.key] || 99;
                      const orderB = ROLE_ORDER[b.key] || 99;
                      return orderA - orderB;
                    })
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
                >
                  Assigned Brand (Optional)
                </label>
                <select
                  value={editStaffBrandId}
                  onChange={(e) => setEditStaffBrandId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                >
                  <option value="">All Brands (Tenant Wide)</option>
                  {brandsList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setEditingStaffUser(null)}
                  className="btn btn-secondary btn-sm"
                  disabled={isUpdatingStaffRole}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isUpdatingStaffRole || !editStaffRoleId}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Shield size={13} />
                  {isUpdatingStaffRole ? 'Updating...' : 'Save & Update Role'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Staff Member"
      >
        <div style={{ position: 'relative' }}>
          {isInviting && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <LoadingSpinner size={24} text="Sending invitation..." />
            </div>
          )}
          <form
            onSubmit={handleSendInvite}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Full Name *
              </label>
              <input
                type="text"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                required
              />
            </div>

            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Email Address *
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                required
              />
            </div>

            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Assigned Support Role *
              </label>
              <select
                value={inviteRoleId}
                onChange={(e) => setInviteRoleId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
                required
              >
                <option value="">Select a Database Role...</option>
                {[...roles]
                  .filter((r) => r.isStaff)
                  .sort((a, b) => {
                    const ROLE_ORDER: Record<string, number> = {
                      TENANT_ADMIN: 1,
                      L1_SUPPORT: 2,
                      L2_SUPPORT: 3,
                      L3_SUPPORT: 4,
                      DEV_TEAM: 5,
                      DEVOPS_TEAM: 6,
                      QA_TEAM: 7,
                    };
                    const orderA = ROLE_ORDER[a.key] || 99;
                    const orderB = ROLE_ORDER[b.key] || 99;
                    return orderA - orderB;
                  })
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Assigned Product Brand (Optional)
              </label>
              <select
                value={inviteBrandId}
                onChange={(e) => setInviteBrandId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">All Brands (Tenant Wide)</option>
                {brandsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Personal Message (Optional)
              </label>
              <textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="e.g. Welcome to the helpdesk team!"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  minHeight: '60px',
                }}
              />
            </div>

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
            >
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="btn btn-secondary btn-sm"
                disabled={isInviting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isInviting}>
                {isInviting ? 'Sending...' : 'Send Email Invite'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Create Team Modal */}
      <Modal
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        title="Create Support Team"
      >
        <form
          onSubmit={handleCreateTeam}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>
              Team Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Technical Escalations, Customer Success, QA"
              className="form-control"
              required
            />
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>
              Support Tier
            </label>
            <select
              value={teamTier}
              onChange={(e) => setTeamTier(e.target.value)}
              className="form-select"
            >
              <option value="L1">L1 - Frontline Support</option>
              <option value="L2">L2 - Technical Support</option>
              <option value="L3">L3 - Product Specialists</option>
              <option value="DEV">DEV - Product Developers</option>
              <option value="QA">QA - Quality Testing</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: '5px' }}>
              Description
            </label>
            <textarea
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="Brief summary of this team's responsibilities..."
              className="form-textarea"
              rows={3}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '8px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setIsCreateTeamOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Create Team
            </button>
          </div>
        </form>
      </Modal>

      {/* Manage Team Members Drag & Drop Wizard Modal */}
      <Modal
        isOpen={!!selectedTeamForMembers}
        onClose={() => setSelectedTeamForMembers(null)}
        title={`Manage Members · ${selectedTeamForMembers?.name || 'Support Team'}`}
        maxWidth="940px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Team Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 18px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {selectedTeamForMembers?.name}
                </span>
                <span className={`tier-pill ${selectedTeamForMembers?.tier || 'L1'}`}>
                  {selectedTeamForMembers?.tier || 'General'} Tier
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedTeamForMembers?.description || 'Frontline support & ticket routing team.'}
              </div>
            </div>
            <Link
              to="/roster"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
            >
              <Calendar size={13} /> Open Roster Console
            </Link>
          </div>

          {/* Dual-Column Interactive Wizard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 330px) 1fr', gap: '16px', minHeight: '430px' }}>
            {/* Left Column: Available Staff Directory (Draggable Source) */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} style={{ color: 'var(--primary)' }} />
                    Staff Directory
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '1px 7px', borderRadius: '10px', background: 'var(--bg-app)', color: 'var(--text-muted)' }}>
                    {availableStaff.length} available
                  </span>
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search staff name or email..."
                    className="form-control"
                    style={{ paddingLeft: '28px', fontSize: '11.5px', height: '30px' }}
                  />
                </div>
              </div>

              {/* Draggable Staff Cards List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px' }} className="custom-scrollbar">
                {availableStaff.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <UserCheck size={24} style={{ color: 'var(--border-strong)', margin: '0 auto 6px', display: 'block' }} />
                    {memberSearchQuery ? 'No staff matching search.' : 'All staff members are already assigned to this team!'}
                  </div>
                ) : (
                  availableStaff.map((u: any) => {
                    const name = u.fullName || u.displayName || u.email;
                    const initials = name.slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={u.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', u.id);
                          setDraggedStaffId(u.id);
                        }}
                        onDragEnd={() => setDraggedStaffId(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#fbfcfd',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'grab',
                          transition: 'all 0.15s ease',
                        }}
                        title="Drag this card to the right or click + Add to assign"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontWeight: '700', fontSize: '10.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: '650', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {name}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuickAssignStaff(u.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11px', height: '26px', flexShrink: 0 }}
                          title="Assign to team"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                💡 Drag card &rarr; drop into team or click <b>+ Add</b>
              </div>
            </div>

            {/* Right Column: Assigned Team Drop Zone & Member Config */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverDropZone(true);
              }}
              onDragLeave={() => setIsDragOverDropZone(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOverDropZone(false);
                const userId = e.dataTransfer.getData('text/plain') || draggedStaffId;
                if (userId) handleQuickAssignStaff(userId);
              }}
              style={{
                background: isDragOverDropZone ? 'rgba(37, 99, 235, 0.04)' : '#ffffff',
                border: isDragOverDropZone ? '2px dashed var(--primary)' : '1px solid var(--border-subtle)',
                borderRadius: '10px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={15} style={{ color: '#16a34a' }} />
                  Assigned Team Members ({(selectedTeamForMembers?.members || []).length})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Drag staff from left to assign
                </span>
              </div>

              {/* Assigned Members List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px' }} className="custom-scrollbar">
                {(!selectedTeamForMembers?.members || selectedTeamForMembers.members.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', borderRadius: '8px', background: '#fafbfc' }}>
                    <Users size={32} style={{ color: 'var(--border-strong)', margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ fontSize: '13px', fontWeight: '650', color: 'var(--text-secondary)', margin: '0 0 4px' }}>
                      Drop Staff Members Here
                    </p>
                    <p style={{ fontSize: '11.5px', margin: 0 }}>
                      Drag staff cards from the left panel or click <b>+ Add</b> to assign them to {selectedTeamForMembers?.name}.
                    </p>
                  </div>
                ) : (
                  selectedTeamForMembers.members.map((m: any) => {
                    const name = m.user?.fullName || m.user?.displayName || m.user?.email || 'Staff';
                    const initials = name.slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: '#ffffff',
                          border: m.isLead ? '1px solid #fde68a' : '1px solid var(--border-subtle)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {/* Top Row: User Identity & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: m.isLead ? '#fef3c7' : '#eff6ff', border: m.isLead ? '1px solid #fde68a' : '1px solid #bfdbfe', color: m.isLead ? '#b45309' : '#2563eb', fontWeight: '700', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {initials}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span>{name}</span>
                                {m.isLead && <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: '700' }}>⭐ Lead</span>}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.user?.email || m.userId}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateMemberInline(m.user?.id || m.userId, { isLead: !m.isLead })}
                              className={`btn btn-sm ${m.isLead ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ fontSize: '11px', height: '28px', padding: '0 10px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title={m.isLead ? 'Click to remove Team Lead status' : 'Promote to Team Lead'}
                            >
                              ⭐ {m.isLead ? 'Team Lead' : 'Make Lead'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveMemberFromTeam(m.user?.id || m.userId)}
                              className="btn btn-ghost btn-sm"
                              style={{ color: '#dc2626', height: '28px', width: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Remove member from team"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Bottom Row: Symmetrical 2-Column Controls Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)' }}>
                          <div>
                            <div style={{ fontSize: '10.5px', fontWeight: '650', color: 'var(--text-muted)', marginBottom: '3px' }}>
                              Classification / Grade
                            </div>
                            <select
                              value={m.grade || 'Junior'}
                              onChange={(e) => handleUpdateMemberInline(m.user?.id || m.userId, { grade: e.target.value })}
                              className="form-select"
                              style={{ fontSize: '11.5px', height: '30px', padding: '2px 24px 2px 8px', width: '100%' }}
                            >
                              <option value="Senior">Senior</option>
                              <option value="Junior">Junior</option>
                              <option value="Permanent General Shift">Permanent General Shift</option>
                            </select>
                          </div>

                          <div>
                            <div style={{ fontSize: '10.5px', fontWeight: '650', color: 'var(--text-muted)', marginBottom: '3px' }}>
                              Default Shift &amp; Hours
                            </div>
                            <select
                              value={m.defaultShift || 'General Shift'}
                              onChange={(e) => {
                                const s = e.target.value;
                                const timing = s === 'Morning Shift' ? '7:30 AM - 4:30 PM' : s === 'Evening Shift' ? '2:00 PM - 11:00 PM' : '10:00 AM - 7:00 PM';
                                handleUpdateMemberInline(m.user?.id || m.userId, { defaultShift: s, timing });
                              }}
                              className="form-select"
                              style={{ fontSize: '11.5px', height: '30px', padding: '2px 24px 2px 8px', width: '100%' }}
                            >
                              <option value="General Shift">General (10:00 AM - 7:00 PM)</option>
                              <option value="Morning Shift">Morning (7:30 AM - 4:30 PM)</option>
                              <option value="Evening Shift">Evening (2:00 PM - 11:00 PM)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Changes sync instantly to PostgreSQL in real-time.
            </div>
            <button
              type="button"
              onClick={() => setSelectedTeamForMembers(null)}
              className="btn btn-primary btn-sm"
              style={{ padding: '7px 20px', fontSize: '12.5px', fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Queue Modal */}
      <Modal
        isOpen={isCreateQueueOpen}
        onClose={() => setIsCreateQueueOpen(false)}
        title="Create Routing Queue"
      >
        <form
          onSubmit={handleCreateQueue}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Queue Name *
            </label>
            <input
              type="text"
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              placeholder="e.g. Critical Billing Queue"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Queue Slug *
            </label>
            <input
              type="text"
              value={queueSlug}
              onChange={(e) => setQueueSlug(e.target.value)}
              placeholder="e.g. billing-p1"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Support Tier
              </label>
              <select
                value={queueTier}
                onChange={(e) => setQueueTier(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <option value="L1">L1 Tier</option>
                <option value="L2">L2 Tier</option>
                <option value="L3">L3 Tier</option>
                <option value="DEV">DEV Tier</option>
                <option value="QA">QA Tier</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Routing Method
              </label>
              <select
                value={queueRouting}
                onChange={(e) => setQueueRouting(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <option value="LEAST_LOADED">Least Loaded</option>
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="MANUAL">Manual Triage</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Link to Brand
              </label>
              <select
                value={queueBrandId}
                onChange={(e) => setQueueBrandId(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <option value="">All Brands</option>
                {brandsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Assign to Team
              </label>
              <select
                value={queueTeamId}
                onChange={(e) => setQueueTeamId(e.target.value)}
                className="form-control"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <option value="">No Team Assigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '4px',
            }}
          >
            <input
              type="checkbox"
              checked={queueIsDefault}
              onChange={(e) => setQueueIsDefault(e.target.checked)}
            />
            <span>Set as Default Queue (tickets with no brand land here)</span>
          </label>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
          >
            <button
              type="button"
              onClick={() => setIsCreateQueueOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Create Queue
            </button>
          </div>
        </form>
      </Modal>

      {/* Create / Edit Organization Modal */}
      <Modal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        title={editingOrg ? 'Edit Client Organization / Account' : 'Create New Client Organization'}
      >
        <form onSubmit={handleSaveOrganization} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
              Organization / Company Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apollo Hospitals, Kusum Dhirajlal Hospital, Acme Corp"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
              Associated Sender Email Domains <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                padding: '6px 10px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                alignItems: 'center',
                minHeight: '42px',
                cursor: 'text',
              }}
              onClick={() => document.getElementById('org-domains-input')?.focus()}
            >
              {orgDomainList.map((domain, index) => (
                <div
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    color: '#0284c7',
                    fontWeight: 600,
                  }}
                >
                  <span>{domain.includes('@') ? domain : `@${domain}`}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrgDomainList(orgDomainList.filter((_, i) => i !== index));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0284c7',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      lineHeight: 1,
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#0284c7';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <input
                id="org-domains-input"
                type="text"
                value={orgDomainInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(',') || val.includes(';') || val.includes('\n')) {
                    addOrgDomainChip(val);
                    setOrgDomainInput('');
                  } else {
                    setOrgDomainInput(val);
                  }
                }}
                onPaste={(e) => {
                  const pasteData = e.clipboardData.getData('text');
                  if (pasteData) {
                    e.preventDefault();
                    addOrgDomainChip(pasteData);
                    setOrgDomainInput('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addOrgDomainChip(orgDomainInput);
                    setOrgDomainInput('');
                  }
                }}
                onBlur={() => {
                  if (orgDomainInput.trim()) {
                    addOrgDomainChip(orgDomainInput);
                    setOrgDomainInput('');
                  }
                }}
                placeholder={
                  orgDomainList.length === 0
                    ? 'e.g. apollohospitals.com, support@company.com (Press Enter, comma, or paste bulk)'
                    : 'Add or paste more domains/emails...'
                }
                style={{
                  flex: 1,
                  minWidth: '130px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '12px',
                  padding: '4px 0',
                }}
              />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Press <strong>Enter</strong>, <strong>Comma (,)</strong>, or <strong>Paste bulk emails/domains</strong> (separated by comma, space, or newlines) to add. Incoming tickets from customers with these email domains will automatically link to this Organization.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
                Website <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. https://apollohospitals.com"
                value={orgWebsite}
                onChange={(e) => setOrgWebsite(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
                Primary Contact Name <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Rajesh Sharma"
                value={orgContactName}
                onChange={(e) => setOrgContactName(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
                Contact Email <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="e.g. contact@apollohospitals.com"
                value={orgContactEmail}
                onChange={(e) => setOrgContactEmail(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
                Contact Phone <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={orgContactPhone}
                onChange={(e) => setOrgContactPhone(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          {/* Associated Product */}
          <div ref={orgProductDropdownRef} style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                <Box size={14} style={{ color: '#a855f7' }} />
                Product / Application{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsOrgProductOpen(!isOrgProductOpen);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #6366f1)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {orgProduct ? 'Change' : 'Select'}
                <ChevronDown size={12} />
              </button>
            </div>

            <div
              onClick={() => {
                setIsOrgProductOpen(!isOrgProductOpen);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                backgroundColor: orgProduct
                  ? 'rgba(168, 85, 247, 0.08)'
                  : 'var(--bg-surface)',
                border: orgProduct
                  ? '1px solid rgba(168, 85, 247, 0.35)'
                  : '1px dashed var(--border-medium)',
                minHeight: '38px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Box
                  size={15}
                  style={{
                    color: orgProduct ? '#a855f7' : 'var(--text-muted, #94a3b8)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: orgProduct ? 600 : 400,
                    color: orgProduct
                      ? 'var(--text-primary, #f8fafc)'
                      : 'var(--text-muted, #94a3b8)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {orgProduct || 'No Product selected'}
                </span>
              </div>

              {orgProduct && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrgProduct('');
                  }}
                  title="Clear Product"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Product Dropdown Popup Menu */}
            {isOrgProductOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '6px',
                  backgroundColor: 'var(--bg-surface, #1e293b)',
                  border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5), 0 -8px 10px -6px rgba(0, 0, 0, 0.4)',
                  zIndex: 100,
                  padding: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                    marginBottom: '8px',
                  }}
                >
                  <Search size={13} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
                  <input
                    ref={orgProductSearchRef}
                    type="text"
                    value={orgProductSearch}
                    onChange={(e) => setOrgProductSearch(e.target.value)}
                    placeholder="Search products..."
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  {orgProductSearch && (
                    <button
                      type="button"
                      onClick={() => setOrgProductSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {orgProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrgProduct('');
                        setIsOrgProductOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                      }}
                    >
                      <X size={12} /> Clear selection (No Product)
                    </button>
                  )}
                  {availableProducts.filter((p: any) => {
                    const name = typeof p === 'string' ? p : p?.name || '';
                    return name.toLowerCase().includes(orgProductSearch.toLowerCase());
                  }).length === 0 ? (
                    <div>
                      <div
                        style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {availableProducts.length === 0
                          ? 'No products configured yet.'
                          : 'No matching products'}
                      </div>
                      {orgProductSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrgProduct(orgProductSearch.trim());
                            setIsOrgProductOpen(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: 'none',
                            border: '1px dashed var(--border-subtle, rgba(255,255,255,0.15))',
                            color: 'var(--primary, #6366f1)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={12} /> Use "{orgProductSearch.trim()}"
                        </button>
                      )}
                    </div>
                  ) : (
                    availableProducts
                      .filter((p: any) => {
                        const name = typeof p === 'string' ? p : p?.name || '';
                        return name.toLowerCase().includes(orgProductSearch.toLowerCase());
                      })
                      .map((p: any) => {
                        const prodName = typeof p === 'string' ? p : p.name;
                        const prodKey = typeof p === 'string' ? p : p.id || prodName;
                        const isSelected = prodName === orgProduct;
                        return (
                          <button
                            key={prodKey}
                            type="button"
                            onClick={() => {
                              setOrgProduct(prodName);
                              setIsOrgProductOpen(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: isSelected
                                ? 'rgba(168, 85, 247, 0.15)'
                                : 'transparent',
                              border: 'none',
                              color: isSelected ? '#c084fc' : 'var(--text-primary, #f8fafc)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-input, rgba(255, 255, 255, 0.05))';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prodName}
                            </span>
                            {isSelected && <Check size={14} style={{ color: '#c084fc', flexShrink: 0 }} />}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Associate this client organization with a specific product or application suite.
            </p>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Account Notes / SLA Details <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <ActionNoteBox
              value={orgDescription}
              onChange={setOrgDescription}
              placeholder="e.g. • Tier-1 enterprise account\n• 2-hour priority SLA response window\n• Designated TAM: John Doe"
              minRows={4}
              accentColor="#0284c7"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsOrgModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" disabled={isOrgSubmitting} className="btn btn-primary btn-sm">
              {isOrgSubmitting ? 'Saving...' : editingOrg ? 'Save Changes' : 'Create Organization'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Organizations Modal */}
      <Modal
        isOpen={isOrgImportModalOpen}
        onClose={() => {
          if (!isOrgImporting) {
            setIsOrgImportModalOpen(false);
            setOrgImportFile(null);
            setOrgImportPreview([]);
          }
        }}
        title="Bulk Import Client Organizations from CSV"
        maxWidth="820px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md, 6px)',
              backgroundColor: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.18)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '12.5px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                CSV Format Instructions:
              </div>
              Your CSV should include columns: <code style={{ color: 'var(--primary)', fontWeight: 600 }}>Organization Name</code>, <code style={{ color: 'var(--primary)' }}>Product</code>, <code style={{ color: 'var(--primary)' }}>Sender Domains</code>, <code style={{ color: 'var(--primary)' }}>Website</code>, <code style={{ color: 'var(--primary)' }}>Contact Name</code>, <code style={{ color: 'var(--primary)' }}>Contact Email</code>, <code style={{ color: 'var(--primary)' }}>Contact Phone</code>.
              Existing organizations will have new domains merged safely without overwriting data.
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleOrgCsv}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0, fontSize: '11.5px' }}
            >
              <Download size={13} /> Sample CSV
            </button>
          </div>

          {/* File Upload Box */}
          <div
            style={{
              border: '2px dashed var(--border-medium, rgba(255, 255, 255, 0.15))',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-subtle, rgba(0, 0, 0, 0.02))',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => document.getElementById('org-csv-file-input')?.click()}
          >
            <input
              id="org-csv-file-input"
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleOrgImportFileChange}
            />
            <FileSpreadsheet size={34} style={{ color: 'var(--primary, #2563eb)', marginBottom: '8px', opacity: 0.85 }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {orgImportFile ? orgImportFile.name : 'Click to select CSV file or drag and drop'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              {orgImportFile ? `${(orgImportFile.size / 1024).toFixed(1)} KB • CSV Document` : 'Supports UTF-8 CSV exports and spreadsheet files'}
            </div>
          </div>

          {/* Live Preview Table */}
          {orgImportPreview.length > 0 && (() => {
            const previewProductCounts: Record<string, number> = {};
            for (const item of orgImportPreview) {
              const p = item.product?.trim() || 'Unassigned';
              previewProductCounts[p] = (previewProductCounts[p] || 0) + 1;
            }

            const filteredPreview = orgImportPreview.filter((item: any) => {
              if (!orgImportSearchText.trim()) return true;
              const q = orgImportSearchText.trim().toLowerCase();
              return (
                item.name?.toLowerCase().includes(q) ||
                item.product?.toLowerCase().includes(q) ||
                item.domains?.toLowerCase().includes(q) ||
                item.contactName?.toLowerCase().includes(q) ||
                item.contactEmail?.toLowerCase().includes(q)
              );
            });

            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      Preview: {orgImportPreview.length} Ready
                    </span>
                    {(() => {
                      const sortedEntries = Object.entries(previewProductCounts).sort((a, b) => b[1] - a[1]);
                      const visibleEntries = sortedEntries.slice(0, 3);
                      const overflowEntries = sortedEntries.slice(3);
                      const overflowTotal = overflowEntries.reduce((sum, [, c]) => sum + c, 0);

                      return (
                        <>
                          {visibleEntries.map(([pName, pCount]) => {
                            const badge = getProductBadgeStyle(pName === 'Unassigned' ? null : pName);
                            return (
                              <span
                                key={pName}
                                style={{
                                  fontSize: '11px',
                                  padding: '1px 7px',
                                  borderRadius: '10px',
                                  backgroundColor: badge ? badge.bg : 'rgba(100, 116, 139, 0.12)',
                                  color: badge ? badge.color : 'var(--text-muted)',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {badge ? badge.icon : '⚪'} {pName}: {pCount}
                              </span>
                            );
                          })}
                          {overflowEntries.length > 0 && (
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '1px 7px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-subtle, rgba(0, 0, 0, 0.05))',
                                color: 'var(--text-secondary, #64748b)',
                                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                                fontWeight: 600,
                                cursor: 'help',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                whiteSpace: 'nowrap',
                              }}
                              title={overflowEntries.map(([name, count]) => `${name}: ${count}`).join(' • ')}
                            >
                              +{overflowEntries.length} more ({overflowTotal})
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Search inside preview */}
                  <div style={{ position: 'relative', width: '190px', flexShrink: 0 }}>
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search preview..."
                      value={orgImportSearchText}
                      onChange={(e) => setOrgImportSearchText(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '4px 8px 4px 26px',
                        fontSize: '11.5px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderBottom: '1.5px solid var(--border-medium, #cbd5e1)', textAlign: 'left' }}>
                        <th style={{ padding: '5px 8px', width: '30px', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card, #ffffff)' }}>#</th>
                        <th style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-primary)', backgroundColor: 'var(--bg-card, #ffffff)' }}>NAME</th>
                        <th style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-primary)', backgroundColor: 'var(--bg-card, #ffffff)', whiteSpace: 'nowrap', width: '120px' }}>PRODUCT</th>
                        <th style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-primary)', backgroundColor: 'var(--bg-card, #ffffff)' }}>DOMAINS</th>
                        <th style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--text-primary)', backgroundColor: 'var(--bg-card, #ffffff)' }}>CONTACT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreview.map((row, idx) => {
                        const style = getProductBadgeStyle(row.product);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>{idx + 1}</td>
                            <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</td>
                            <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                              {row.product ? (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    backgroundColor: style?.bg || 'rgba(168, 85, 247, 0.12)',
                                    color: style?.color || '#9333ea',
                                    border: `1px solid ${style?.border || 'rgba(168, 85, 247, 0.3)'}`,
                                    borderRadius: '3px',
                                    padding: '1.5px 6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                    lineHeight: '1.2',
                                  }}
                                >
                                  <span>{style?.icon || '📦'}</span>
                                  <span>{row.product}</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.domains || '—'}
                            </td>
                            <td style={{ padding: '4px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {row.contactEmail || row.contactName || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => {
                setIsOrgImportModalOpen(false);
                setOrgImportFile(null);
                setOrgImportPreview([]);
              }}
              disabled={isOrgImporting}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteOrgImport}
              disabled={isOrgImporting || orgImportPreview.length === 0}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isOrgImporting ? (
                <>
                  <RotateCw size={13} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={13} />
                  Import {orgImportPreview.length} Organizations
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Tag Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={editingTag ? 'Edit Ticket Tag' : 'Create New Ticket Tag'}
      >
        <form onSubmit={handleSaveTag} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Tag Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. VIP Enterprise, Billing, Partner"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Tag Color <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="color"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
                style={{
                  width: '38px',
                  height: '38px',
                  padding: '2px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  cursor: 'pointer',
                }}
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setTagColor(hex)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: hex,
                      border: tagColor === hex ? '2px solid #0f172a' : '2px solid transparent',
                      cursor: 'pointer',
                      boxShadow: tagColor === hex ? '0 0 0 1px white inset' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
              Auto-Tag Sender Emails / Domains <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                padding: '6px 10px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                alignItems: 'center',
                minHeight: '42px',
                cursor: 'text',
              }}
              onClick={() => document.getElementById('tag-domains-input')?.focus()}
            >
              {tagDomainList.map((domain, index) => (
                <div
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    color: '#1d4ed8',
                    fontWeight: 600,
                  }}
                >
                  <span>{domain.includes('@') ? domain : `@${domain}`}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagDomainList(tagDomainList.filter((_, i) => i !== index));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#60a5fa',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      lineHeight: 1,
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#60a5fa';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <input
                id="tag-domains-input"
                type="text"
                value={tagDomainInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(',') || val.includes(';') || val.includes('\n')) {
                    addTagDomainChip(val);
                    setTagDomainInput('');
                  } else {
                    setTagDomainInput(val);
                  }
                }}
                onPaste={(e) => {
                  const pasteData = e.clipboardData.getData('text');
                  if (pasteData) {
                    e.preventDefault();
                    addTagDomainChip(pasteData);
                    setTagDomainInput('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTagDomainChip(tagDomainInput);
                    setTagDomainInput('');
                  }
                }}
                onBlur={() => {
                  if (tagDomainInput.trim()) {
                    addTagDomainChip(tagDomainInput);
                    setTagDomainInput('');
                  }
                }}
                placeholder={
                  tagDomainList.length === 0
                    ? 'e.g. user@gmail.com, company.com (Press Enter, comma, or paste bulk)'
                    : 'Add or paste more emails or domains...'
                }
                style={{
                  flex: 1,
                  minWidth: '130px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '12px',
                  padding: '4px 0',
                }}
              />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Press <strong>Enter</strong>, <strong>Comma (,)</strong>, or <strong>Paste bulk emails/domains</strong> to add multiple emails or domains. Any incoming ticket submitted by customers matching these exact emails or email domains will automatically have this tag attached.
            </p>
          </div>

          {/* Associated Organization */}
          <div ref={tagOrgDropdownRef} style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                <Building2 size={14} style={{ color: '#38bdf8' }} />
                Auto-Map Organization / Client{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsTagOrgOpen(!isTagOrgOpen);
                  setIsTagProductOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #6366f1)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {tagOrganization ? 'Change' : 'Select'}
                <ChevronDown size={12} />
              </button>
            </div>

            <div
              onClick={() => {
                setIsTagOrgOpen(!isTagOrgOpen);
                setIsTagProductOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                backgroundColor: tagOrganization
                  ? 'rgba(56, 189, 248, 0.08)'
                  : 'var(--bg-surface)',
                border: tagOrganization
                  ? '1px solid rgba(56, 189, 248, 0.35)'
                  : '1px dashed var(--border-medium)',
                minHeight: '38px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Building2
                  size={15}
                  style={{
                    color: tagOrganization ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: tagOrganization ? 600 : 400,
                    color: tagOrganization
                      ? 'var(--text-primary, #f8fafc)'
                      : 'var(--text-muted, #94a3b8)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tagOrganization || 'No Organization selected'}
                </span>
              </div>

              {tagOrganization && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagOrganization('');
                  }}
                  title="Clear Organization"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Organization Dropdown Popup Menu */}
            {isTagOrgOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-surface, #1e293b)',
                  border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
                  zIndex: 100,
                  padding: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                    marginBottom: '8px',
                  }}
                >
                  <Search size={13} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
                  <input
                    ref={tagOrgSearchRef}
                    type="text"
                    value={tagOrgSearch}
                    onChange={(e) => setTagOrgSearch(e.target.value)}
                    placeholder="Search organizations..."
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  {tagOrgSearch && (
                    <button
                      type="button"
                      onClick={() => setTagOrgSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {tagOrganization && (
                    <button
                      type="button"
                      onClick={() => {
                        setTagOrganization('');
                        setIsTagOrgOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                      }}
                    >
                      <X size={12} /> Clear selection (No Organization)
                    </button>
                  )}
                  {organizationsList.filter(
                    (o) =>
                      o.name?.toLowerCase().includes(tagOrgSearch.toLowerCase()) ||
                      (o.domains && o.domains.toLowerCase().includes(tagOrgSearch.toLowerCase())),
                  ).length === 0 ? (
                    <div>
                      <div
                        style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {organizationsList.length === 0
                          ? 'No organizations configured yet.'
                          : 'No matching organizations'}
                      </div>
                      {tagOrgSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setTagOrganization(tagOrgSearch.trim());
                            setIsTagOrgOpen(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: 'none',
                            border: '1px dashed var(--border-subtle, rgba(255,255,255,0.15))',
                            color: 'var(--primary, #6366f1)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={12} /> Use "{tagOrgSearch.trim()}"
                        </button>
                      )}
                    </div>
                  ) : (
                    organizationsList
                      .filter(
                        (o) =>
                          o.name?.toLowerCase().includes(tagOrgSearch.toLowerCase()) ||
                          (o.domains && o.domains.toLowerCase().includes(tagOrgSearch.toLowerCase())),
                      )
                      .map((org) => {
                        const isSelected = org.name === tagOrganization;
                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => {
                              setTagOrganization(org.name);
                              setIsTagOrgOpen(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: isSelected
                                ? 'rgba(56, 189, 248, 0.15)'
                                : 'transparent',
                              border: 'none',
                              color: isSelected ? '#38bdf8' : 'var(--text-primary, #f8fafc)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-input, rgba(255, 255, 255, 0.05))';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {org.name}
                              </span>
                              {org.domains && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {org.domains}
                                </span>
                              )}
                            </div>
                            {isSelected && <Check size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              When an email/ticket arrives from the sender domains above, it will automatically have this Organization assigned.
            </p>
          </div>

          {/* Associated Products Multi-Select */}
          <div ref={tagProductDropdownRef} style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <label
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  fontSize: '13px',
                  margin: 0,
                }}
              >
                <Box size={14} style={{ color: '#a855f7' }} />
                Auto-Map Product / Application{' '}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsTagProductOpen(!isTagProductOpen);
                  setIsTagOrgOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary, #6366f1)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {tagProducts.length > 0 ? `Manage (${tagProducts.length})` : 'Select'}
                <ChevronDown size={12} />
              </button>
            </div>

            <div
              onClick={() => {
                setIsTagProductOpen(!isTagProductOpen);
                setIsTagOrgOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                backgroundColor: tagProducts.length > 0
                  ? 'rgba(168, 85, 247, 0.08)'
                  : 'var(--bg-surface)',
                border: tagProducts.length > 0
                  ? '1px solid rgba(168, 85, 247, 0.35)'
                  : '1px dashed var(--border-medium)',
                minHeight: '38px',
                gap: '8px',
                flexWrap: 'wrap',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                <Box
                  size={15}
                  style={{
                    color: tagProducts.length > 0 ? '#a855f7' : 'var(--text-muted, #94a3b8)',
                    flexShrink: 0,
                  }}
                />
                {tagProducts.length === 0 ? (
                  <span style={{ fontSize: '13px', color: 'var(--text-muted, #94a3b8)' }}>
                    All Products
                  </span>
                ) : (
                  tagProducts.map((p) => (
                    <span
                      key={p}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid rgba(168, 85, 247, 0.35)',
                        color: '#c084fc',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      <span>{p}</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagProducts(tagProducts.filter((tp) => tp !== p));
                        }}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8 }}
                        title={`Remove ${p}`}
                      >
                        <X size={12} />
                      </span>
                    </span>
                  ))
                )}
              </div>

              {tagProducts.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagProducts([]);
                  }}
                  title="Clear All Products (Make Common)"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #94a3b8)')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Product Dropdown Popup Menu */}
            {isTagProductOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '6px',
                  backgroundColor: 'var(--bg-surface, #1e293b)',
                  border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5), 0 -8px 10px -6px rgba(0, 0, 0, 0.4)',
                  zIndex: 100,
                  padding: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.25))',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                    marginBottom: '8px',
                  }}
                >
                  <Search size={13} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
                  <input
                    ref={tagProductSearchRef}
                    type="text"
                    value={tagProductSearch}
                    onChange={(e) => setTagProductSearch(e.target.value)}
                    placeholder="Search products (Click to multi-select)..."
                    style={{
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary, #f8fafc)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  {tagProductSearch && (
                    <button
                      type="button"
                      onClick={() => setTagProductSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {tagProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTagProducts([]);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px',
                      }}
                    >
                      <X size={12} /> Clear selection (No Product)
                    </button>
                  )}
                  {availableProducts.filter((p: any) => {
                    const name = typeof p === 'string' ? p : p?.name || '';
                    return name.toLowerCase().includes(tagProductSearch.toLowerCase());
                  }).length === 0 ? (
                    <div>
                      <div
                        style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          fontSize: '12px',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        {availableProducts.length === 0
                          ? 'No products configured yet.'
                          : 'No matching products'}
                      </div>
                      {tagProductSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = tagProductSearch.trim();
                            if (!tagProducts.includes(trimmed)) {
                              setTagProducts([...tagProducts, trimmed]);
                            }
                            setTagProductSearch('');
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: 'none',
                            border: '1px dashed var(--border-subtle, rgba(255,255,255,0.15))',
                            color: 'var(--primary, #6366f1)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={12} /> Add "{tagProductSearch.trim()}"
                        </button>
                      )}
                    </div>
                  ) : (
                    availableProducts
                      .filter((p: any) => {
                        const name = typeof p === 'string' ? p : p?.name || '';
                        return name.toLowerCase().includes(tagProductSearch.toLowerCase());
                      })
                      .map((p: any) => {
                        const prodName = typeof p === 'string' ? p : p.name;
                        const prodKey = typeof p === 'string' ? p : p.id || prodName;
                        const isSelected = tagProducts.includes(prodName);
                        return (
                          <button
                            key={prodKey}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setTagProducts(tagProducts.filter((tp) => tp !== prodName));
                              } else {
                                setTagProducts([...tagProducts, prodName]);
                              }
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              backgroundColor: isSelected
                                ? 'rgba(168, 85, 247, 0.15)'
                                : 'transparent',
                              border: 'none',
                              color: isSelected ? '#c084fc' : 'var(--text-primary, #f8fafc)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'background-color 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-input, rgba(255, 255, 255, 0.05))';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prodName}
                            </span>
                            {isSelected && <Check size={14} style={{ color: '#c084fc', flexShrink: 0 }} />}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Select 1 or more specific products, or leave unselected to make this tag common across all products.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsTagModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" disabled={isTagSubmitting} className="btn btn-primary btn-sm">
              {isTagSubmitting ? 'Saving...' : editingTag ? 'Save Changes' : 'Create Tag'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Create / Edit Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create New Category'}
      >
        <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '4px', fontWeight: 600, fontSize: '13px' }}>
              Category Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Billing & Payments, Bug Reports, Account Access"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Category Color <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {[
                '#6366f1',
                '#3b82f6',
                '#0ea5e9',
                '#10b981',
                '#8b5cf6',
                '#ec4899',
                '#f59e0b',
                '#ef4444',
                '#64748b',
                '#14b8a6',
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryColor(c)}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: categoryColor === c ? '2px solid #ffffff' : 'none',
                    boxShadow: categoryColor === c ? `0 0 0 2px ${c}` : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
              <input
                type="color"
                value={categoryColor}
                onChange={(e) => setCategoryColor(e.target.value)}
                style={{
                  width: '28px',
                  height: '28px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
                title="Custom Color"
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', margin: 0 }}>
                Keyword Matching Rules (Max 25) <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>
              <span style={{ fontSize: '11px', color: categoryKeywordList.length >= 25 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                {categoryKeywordList.length} / 25 keywords
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                padding: '6px 10px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                alignItems: 'center',
                minHeight: '42px',
                cursor: 'text',
              }}
              onClick={() => document.getElementById('category-keywords-input')?.focus()}
            >
              {categoryKeywordList.map((kw, index) => (
                <div
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    color: '#7c3aed',
                    fontWeight: 600,
                  }}
                >
                  <span>{kw}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryKeywordList(categoryKeywordList.filter((_, i) => i !== index));
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#a78bfa',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      lineHeight: 1,
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#a78bfa';
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <input
                id="category-keywords-input"
                type="text"
                value={categoryKeywordInput}
                disabled={categoryKeywordList.length >= 25}
                onChange={(e) => setCategoryKeywordInput(e.target.value)}
                onPaste={(e) => {
                  const pasteData = e.clipboardData.getData('text');
                  if (pasteData && (pasteData.includes(',') || pasteData.includes(';') || pasteData.includes('\n'))) {
                    e.preventDefault();
                    addCategoryKeywordChip(pasteData);
                    setCategoryKeywordInput('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addCategoryKeywordChip(categoryKeywordInput);
                    setCategoryKeywordInput('');
                  }
                }}
                onBlur={() => {
                  addCategoryKeywordChip(categoryKeywordInput);
                  setCategoryKeywordInput('');
                }}
                placeholder={
                  categoryKeywordList.length >= 25
                    ? 'Maximum 25 keywords reached'
                    : categoryKeywordList.length === 0
                    ? 'e.g. refund, payment, invoice (Press Enter, comma, or paste)'
                    : 'Add more keyword...'
                }
                style={{
                  flex: 1,
                  minWidth: '130px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '12px',
                  padding: '4px 0',
                }}
              />
            </div>
            {categoryKeywordList.length > 25 && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#b91c1c',
                }}
              >
                <span>⚠️ Category currently has {categoryKeywordList.length} keywords. Max allowed is 25.</span>
                <button
                  type="button"
                  onClick={() => setCategoryKeywordList((prev) => prev.slice(0, 25))}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Trim to Top 25
                </button>
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Press <strong>Enter</strong> or <strong>Comma (,)</strong> to add up to 25 keywords. Any incoming email or ticket matching these keywords in the subject, message body, or metadata will be automatically classified into this category.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCategorySubmitting || categoryKeywordList.length > 25}
              className="btn btn-primary btn-sm"
            >
              {isCategorySubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
      </div>
    </div>
  );
};

