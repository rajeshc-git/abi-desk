import React, { useEffect, useState } from 'react';
import {
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
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
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
    'brands' | 'widget' | 'tags' | 'categories' | 'teams' | 'users' | 'customers' | 'sso'
  >('brands');
  const [selectedThemeColor, setSelectedThemeColor] = useState(
    () => localStorage.getItem('abidesk_theme_color') || '#2563eb',
  );

  // Tags State
  const [tagsList, setTagsList] = useState<any[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [tagDomainList, setTagDomainList] = useState<string[]>([]);
  const [tagDomainInput, setTagDomainInput] = useState('');
  const [isTagSubmitting, setIsTagSubmitting] = useState(false);

  // Categories State
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#6366f1');
  const [categoryKeywordList, setCategoryKeywordList] = useState<string[]>([]);
  const [categoryKeywordInput, setCategoryKeywordInput] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

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

  const filteredTags = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return tagsList;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return tagsList.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.domains && t.domains.toLowerCase().includes(q)),
    );
  }, [tagsList, debouncedSearchQuery]);

  const filteredCategories = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return categoriesList;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return categoriesList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.keywords && c.keywords.toLowerCase().includes(q)),
    );
  }, [categoriesList, debouncedSearchQuery]);

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
    if (u.kind === 'CUSTOMER') return true;
    const roleKey = u.roles?.[0]?.role?.key || '';
    const roleName = (u.roles?.[0]?.role?.name || '').toLowerCase();
    if (roleKey === 'GUEST_CUSTOMER') return true;
    if (roleName.includes('guest') || roleName.includes('customer')) return true;
    return false;
  };

  const isStaffUser = (u: any) => !isCustomerUser(u);

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
        const [teamsData, queuesData, brandsData] = await Promise.all([
          ApiClient.get('/admin/teams'),
          ApiClient.get('/admin/queues'),
          ApiClient.get('/admin/brands'),
        ]);
        setTeams(teamsData || []);
        setQueuesList(queuesData || []);
        setBrandsList(brandsData || []);
      } else if (activeTab === 'users' || activeTab === 'customers') {
        const [usersData, rolesData, brandsData] = await Promise.all([
          ApiClient.get('/admin/users'),
          ApiClient.get('/admin/roles'),
          ApiClient.get('/admin/brands'),
        ]);
        setUsersList(usersData?.users || usersData || []);
        setRoles(rolesData || []);
        setBrandsList(brandsData || []);
      } else if (activeTab === 'tags') {
        const tagsData = await ApiClient.get('/tags');
        setTagsList(Array.isArray(tagsData) ? tagsData : []);
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

  const sanitizeDomainChip = (str: string) =>
    str
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');

  const addTagDomainChip = (input: string) => {
    const val = sanitizeDomainChip(input);
    if (val && !tagDomainList.includes(val)) {
      setTagDomainList((prev) => [...prev, val]);
    }
  };

  const openCreateTagModal = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor('#3b82f6');
    setTagDomainList([]);
    setTagDomainInput('');
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
          .filter(Boolean)
      : [];
    setTagDomainList(existing);
    setTagDomainInput('');
    setIsTagModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }
    setIsTagSubmitting(true);
    try {
      const finalDomains = [...tagDomainList];
      const pending = sanitizeDomainChip(tagDomainInput);
      if (pending && !finalDomains.includes(pending)) {
        finalDomains.push(pending);
        setTagDomainList(finalDomains);
        setTagDomainInput('');
      }

      const domainString = finalDomains.join(', ');

      if (editingTag) {
        await ApiClient.patch(`/tags/${editingTag.id}`, {
          name: tagName.trim(),
          color: tagColor,
          domains: domainString || null,
        });
        toast.success('Tag updated successfully');
      } else {
        await ApiClient.post('/tags', {
          name: tagName.trim(),
          color: tagColor,
          domains: domainString || undefined,
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
    const val = sanitizeKeywordChip(input);
    if (!val) return;
    if (categoryKeywordList.includes(val)) return;
    if (categoryKeywordList.length >= 10) {
      toast.error('Maximum 10 keywords allowed per category');
      return;
    }
    setCategoryKeywordList((prev) => [...prev, val]);
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
      ? cat.keywords
          .split(/[\s,;]+/)
          .map(sanitizeKeywordChip)
          .filter(Boolean)
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
      const finalKeywords = [...categoryKeywordList];
      const pending = sanitizeKeywordChip(categoryKeywordInput);
      if (pending && !finalKeywords.includes(pending) && finalKeywords.length < 10) {
        finalKeywords.push(pending);
        setCategoryKeywordList(finalKeywords);
        setCategoryKeywordInput('');
      }

      const keywordString = finalKeywords.join(', ');

      if (editingCategory) {
        await ApiClient.patch(`/categories/${editingCategory.id}`, {
          name: categoryName.trim(),
          color: categoryColor,
          keywords: keywordString || null,
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
    try {
      await ApiClient.post('/admin/teams', {
        name: teamName,
        slug: teamSlug.toLowerCase(),
        tier: teamTier,
        description: teamDescription || undefined,
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
        : 'localhost';
  const apiHostUrl = `http://${currentHost}:4000`;
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
    <div className="workspace-container" style={{ gap: '20px' }}>
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

          {activeTab === 'tags' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
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
                      {debouncedSearchQuery ? 'No tags match your search' : 'No tags created yet'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      {debouncedSearchQuery
                        ? 'Try clearing your search query.'
                        : 'Create your first tag to organize tickets and set up auto-tagging rules based on sender email domains.'}
                    </p>
                    {!debouncedSearchQuery && (
                      <button onClick={openCreateTagModal} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={14} /> Create First Tag
                      </button>
                    )}
                  </div>
                ) : (
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
                            USAGE
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTags.map((tag: any) => {
                          const domains = tag.domains
                            ? tag.domains
                                .split(/[\s,;]+/)
                                .map((d: string) => d.trim().replace(/^@/, ''))
                                .filter(Boolean)
                            : [];

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
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    slug: {tag.slug}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {domains.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {domains.map((d: string, idx: number) => (
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
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    None (Manual tagging only)
                                  </span>
                                )}
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
                )}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '16px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                      Ticket Categories & Keyword Auto-Matching
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                      Categorize support tickets and define up to 10 keywords per category to automatically classify inbound customer messages.
                    </p>
                  </div>
                  <button onClick={openCreateCategoryModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Create Category
                  </button>
                </div>

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
                      {debouncedSearchQuery ? 'No categories match your search' : 'No categories created yet'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                      {debouncedSearchQuery
                        ? 'Try clearing your search query.'
                        : 'Create your first category and add keywords like "billing, payment, refund" to classify incoming tickets.'}
                    </p>
                    {!debouncedSearchQuery && (
                      <button onClick={openCreateCategoryModal} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={14} /> Create First Category
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            CATEGORY & PREVIEW
                          </th>
                          <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            KEYWORD RULES (MAX 10)
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
                        {filteredCategories.map((cat: any) => {
                          const keywords = cat.keywords
                            ? cat.keywords
                                .split(/[\s,;]+/)
                                .map((k: string) => k.trim())
                                .filter(Boolean)
                            : [];

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
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    slug: {cat.slug}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {keywords.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                    {keywords.map((k: string, idx: number) => (
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
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      ({keywords.length}/10)
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
                )}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {t.name} (Slug: {t.slug})
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {t.description || 'No description provided.'} | Members:{' '}
                            {t.members?.length || 0}
                          </div>
                        </div>
                        {t.tier && <span className="tier-pill L1">{t.tier} Tier</span>}
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
                    else if (tier === 'DEV' || roleName.toLowerCase().includes('dev')) tierPillClass = 'tier-pill DEV';
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                      QA_TEAM: 6,
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
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Team Name *
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. L2 Technical Escalations"
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
              Slug *
            </label>
            <input
              type="text"
              value={teamSlug}
              onChange={(e) => setTeamSlug(e.target.value)}
              placeholder="e.g. l2-tech (alphanumeric & hyphens)"
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
              Support Tier
            </label>
            <select
              value={teamTier}
              onChange={(e) => setTeamTier(e.target.value)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="L1">L1 - Frontline Support</option>
              <option value="L2">L2 - Technical Support</option>
              <option value="L3">L3 - Product Specialists</option>
              <option value="DEV">DEV - Product Developers</option>
              <option value="QA">QA - Quality Testing</option>
            </select>
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Description
            </label>
            <textarea
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            />
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
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

      {/* Create / Edit Tag Modal */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={editingTag ? 'Edit Ticket Tag' : 'Create New Ticket Tag'}
      >
        <form onSubmit={handleSaveTag} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Tag Name *
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
              Tag Color
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
              Auto-Tag Sender Emails / Domains (Optional)
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
                onChange={(e) => setTagDomainInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTagDomainChip(tagDomainInput);
                    setTagDomainInput('');
                  }
                }}
                onBlur={() => {
                  addTagDomainChip(tagDomainInput);
                  setTagDomainInput('');
                }}
                placeholder={
                  tagDomainList.length === 0
                    ? 'e.g. user@gmail.com, company.com (Press Enter or comma to add)'
                    : 'Add more email or domain...'
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
              Press <strong>Enter</strong> or <strong>Comma (,)</strong> to add multiple emails or domains. Any incoming ticket submitted by customers matching these exact emails or email domains will automatically have this tag attached.
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
              Category Name *
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
              Category Color
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
                Keyword Matching Rules (Max 10)
              </label>
              <span style={{ fontSize: '11px', color: categoryKeywordList.length >= 10 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
                {categoryKeywordList.length} / 10 keywords
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
                disabled={categoryKeywordList.length >= 10}
                onChange={(e) => setCategoryKeywordInput(e.target.value)}
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
                  categoryKeywordList.length >= 10
                    ? 'Maximum 10 keywords reached'
                    : categoryKeywordList.length === 0
                    ? 'e.g. refund, payment, invoice (Press Enter or comma to add)'
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
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
              Press <strong>Enter</strong> or <strong>Comma (,)</strong> to add up to 10 keywords. Any incoming email or ticket matching these keywords in the subject, message body, or metadata will be automatically classified into this category.
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
            <button type="submit" disabled={isCategorySubmitting} className="btn btn-primary btn-sm">
              {isCategorySubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

