import React, { useEffect, useState } from 'react';
import {
  Settings,
  Users,
  Key,
  Webhook,
  Shield,
  UserPlus,
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
    'brands' | 'widget' | 'teams' | 'users' | 'keys' | 'webhooks' | 'compliance' | 'sso'
  >('brands');
  const [selectedThemeColor, setSelectedThemeColor] = useState(
    () => localStorage.getItem('abidesk_theme_color') || '#2563eb',
  );

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
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [dsrList, setDsrList] = useState<any[]>([]);

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

  const filteredUsers = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return usersList;
    const query = debouncedSearchQuery.toLowerCase();
    return usersList.filter((u) => {
      const roleName = u.roles?.[0]?.role?.name || '';
      return (
        u.fullName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        roleName.toLowerCase().includes(query)
      );
    });
  }, [usersList, debouncedSearchQuery]);

  const filteredApiKeys = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return apiKeys;
    const query = debouncedSearchQuery.toLowerCase();
    return apiKeys.filter(
      (k) => k.name.toLowerCase().includes(query) || k.prefix.toLowerCase().includes(query),
    );
  }, [apiKeys, debouncedSearchQuery]);

  const filteredWebhooks = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return webhooks;
    const query = debouncedSearchQuery.toLowerCase();
    return webhooks.filter(
      (w) =>
        w.url.toLowerCase().includes(query) ||
        (w.events && w.events.some((e: string) => e.toLowerCase().includes(query))),
    );
  }, [webhooks, debouncedSearchQuery]);

  const filteredDsrList = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return dsrList;
    const query = debouncedSearchQuery.toLowerCase();
    return dsrList.filter(
      (d) =>
        d.email.toLowerCase().includes(query) ||
        d.requestType.toLowerCase().includes(query) ||
        d.status.toLowerCase().includes(query),
    );
  }, [dsrList, debouncedSearchQuery]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Modals visibility state
  const [isCreateBrandOpen, setIsCreateBrandOpen] = useState(false);
  const [isEditBrandOpen, setIsEditBrandOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isCreateQueueOpen, setIsCreateQueueOpen] = useState(false);
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [isDsrOpen, setIsDsrOpen] = useState(false);

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

  // Create API Key Form
  const [keyName, setKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Create Webhook Form
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'ticket.created',
    'ticket.updated',
  ]);

  // DSR Form
  const [dsrEmail, setDsrEmail] = useState('');
  const [dsrType, setDsrType] = useState<'EXPORT' | 'ERASURE'>('EXPORT');
  const [dsrReason, setDsrReason] = useState('');

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
      } else if (activeTab === 'users') {
        const [usersData, rolesData, brandsData] = await Promise.all([
          ApiClient.get('/admin/users'),
          ApiClient.get('/admin/roles'),
          ApiClient.get('/admin/brands'),
        ]);
        setUsersList(usersData?.users || usersData || []);
        setRoles(rolesData || []);
        setBrandsList(brandsData || []);
      } else if (activeTab === 'keys') {
        const res = await ApiClient.get('/admin/api-keys');
        setApiKeys(res?.apiKeys || res || []);
      } else if (activeTab === 'webhooks') {
        const res = await ApiClient.get('/admin/webhooks');
        setWebhooks(res?.endpoints || res || []);
      } else if (activeTab === 'compliance') {
        const dsrRes = await ApiClient.get('/compliance/dsr');
        setDsrList(dsrRes || []);
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

  // Create API Key Submit
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await ApiClient.post('/admin/api-keys', {
        name: keyName,
        scopes: ['ticket:create', 'ticket:read:tenant', 'ticket:update:tenant'],
      });
      setCreatedRawKey(res.secretKey);
      loadData();
      toast.success('API Key created successfully!');
    } catch (err: any) {
      toast.error(`API Key error: ${err.message}`);
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

  const handleCopyKey = () => {
    if (createdRawKey) {
      copyTextToClipboard(
        createdRawKey,
        () => {
          setCopiedKey(true);
          setTimeout(() => setCopiedKey(false), 2000);
        },
        'API key copied to clipboard!',
      );
    }
  };

  // Revoke API Key Submit
  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    try {
      await ApiClient.delete(`/admin/api-keys/${id}`);
      loadData();
      toast.success('API Key revoked successfully!');
    } catch (err: any) {
      toast.error(`Error revoking key: ${err.message}`);
    }
  };

  // Create Webhook Submit
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/admin/webhooks', {
        url: webhookUrl,
        events: webhookEvents,
      });
      setIsWebhookOpen(false);
      setWebhookUrl('');
      loadData();
      toast.success('Webhook created successfully!');
    } catch (err: any) {
      toast.error(`Webhook error: ${err.message}`);
    }
  };

  // Delete Webhook Submit
  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await ApiClient.delete(`/admin/webhooks/${id}`);
      loadData();
      toast.success('Webhook deleted successfully!');
    } catch (err: any) {
      toast.error(`Webhook delete failed: ${err.message}`);
    }
  };

  // Create GDPR DSR request
  const handleCreateDsr = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/compliance/dsr', {
        email: dsrEmail,
        requestType: dsrType,
        reason: dsrReason || undefined,
      });
      setIsDsrOpen(false);
      setDsrEmail('');
      setDsrReason('');
      loadData();
      toast.success('GDPR DSR request registered successfully!');
    } catch (err: any) {
      toast.error(`Failed to create request: ${err.message}`);
    }
  };

  // Run GDPR Retention Policy
  const handleExecuteRetention = async (scope: string) => {
    if (
      !confirm(
        `Are you sure you want to run the retention purge for ${scope}? This will permanently delete records older than your configured limits.`,
      )
    )
      return;
    try {
      await ApiClient.post(`/compliance/retention/${scope}/run`);
      loadData();
      toast.success(`GDPR Retention policy run successfully for ${scope}!`);
    } catch (err: any) {
      toast.error(`Failed to run retention: ${err.message}`);
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
          { id: 'teams', label: 'Teams & Queues', icon: Users },
          { id: 'users', label: 'Staff Directory', icon: UserPlus },
          { id: 'sso', label: 'Single Sign-On (SSO)', icon: Shield },
          { id: 'keys', label: 'API Keys', icon: Key },
          { id: 'webhooks', label: 'Webhooks', icon: Webhook },
          { id: 'compliance', label: 'GDPR & Compliance', icon: Shield },
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Staff Directory</h3>
                <button onClick={() => setIsInviteOpen(true)} className="btn btn-primary btn-sm">
                  <UserPlus size={14} /> Invite New Staff
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredUsers.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    No staff members found matching search.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const roleName = u.roles?.[0]?.role?.name || 'Staff';
                    const isSuspended = u.status === 'SUSPENDED';
                    return (
                      <div
                        key={u.id}
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
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{u.fullName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {u.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="tier-pill L1">{roleName}</span>
                          <span
                            style={{
                              fontSize: '11px',
                              color: isSuspended ? '#ef4444' : '#10b981',
                              fontWeight: 600,
                            }}
                          >
                            ● {u.status}
                          </span>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`btn btn-sm ${isSuspended ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '4px 8px', fontSize: '11px' }}
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

          {activeTab === 'keys' && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Server API Keys</h3>
                <button
                  onClick={() => {
                    setCreatedRawKey(null);
                    setIsKeyOpen(true);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Plus size={14} /> Generate API Key
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredApiKeys.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    No API keys configured or matching search.
                  </div>
                ) : (
                  filteredApiKeys.map((k) => (
                    <div
                      key={k.id}
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
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{k.name}</div>
                        <div
                          style={{
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Key: {k.prefix}... | Uses: {k.useCount?.toString() || '0'} | Created:{' '}
                          {safeFormatDate(k.createdAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {k.revokedAt ? (
                          <span className="badge badge-closed">Revoked</span>
                        ) : (
                          <>
                            <span className="badge badge-open">Active</span>
                            <button
                              onClick={() => handleRevokeApiKey(k.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#ef4444' }}
                            >
                              <Trash2 size={12} /> Revoke
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
                  Outbound Webhooks (HMAC-SHA256)
                </h3>
                <button onClick={() => setIsWebhookOpen(true)} className="btn btn-primary btn-sm">
                  <Plus size={14} /> Add Webhook
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredWebhooks.length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    No webhooks configured or matching search.
                  </div>
                ) : (
                  filteredWebhooks.map((w) => (
                    <div
                      key={w.id}
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
                        <div style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' }}>
                          {w.url}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Events: {(w.events || ['*']).join(', ')} | Status:{' '}
                          {w.isActive ? 'Active' : 'Disabled'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-open">
                          {w.isActive ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          onClick={() => handleDeleteWebhook(w.id)}
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
          )}

          {activeTab === 'compliance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* GDP & DPDPA controls */}
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
                      GDPR & DPDPA Compliance Requests
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Submit and monitor Art. 15 Data Subject Access requests or Art. 17 Erasure
                      requests.
                    </p>
                  </div>
                  <button onClick={() => setIsDsrOpen(true)} className="btn btn-primary btn-sm">
                    <Plus size={14} /> Submit Request
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredDsrList.length === 0 ? (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      No compliance requests submitted or matching search.
                    </div>
                  ) : (
                    filteredDsrList.map((d) => (
                      <div
                        key={d.id}
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
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.email}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Type: {d.requestType} | Submitted: {safeFormatDate(d.createdAt)}
                          </div>
                        </div>
                        <span
                          className={`badge ${d.status === 'COMPLETED' ? 'badge-open' : 'badge-closed'}`}
                        >
                          {d.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Data retention purge triggers */}
              <div className="card">
                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                  Execute Data Retention Policies
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Immediately run cleanups of records exceeding the data retention limits configured
                  for your tenant.
                </p>
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}
                >
                  {[
                    { label: 'Purge Old Tickets', scope: 'TICKET' },
                    { label: 'Purge Diagnostic Telemetry', scope: 'DIAGNOSTIC' },
                    { label: 'Purge Attachments & Media', scope: 'MEDIA' },
                    { label: 'Purge Audit Logs', scope: 'AUDIT' },
                    { label: 'Purge Chat Records', scope: 'CHAT' },
                    { label: 'Purge Webhook Logs', scope: 'WEBHOOK_DELIVERY' },
                  ].map((pol, i) => (
                    <button
                      key={i}
                      onClick={() => handleExecuteRetention(pol.scope)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '12px', justifyContent: 'center' }}
                    >
                      {pol.label}
                    </button>
                  ))}
                </div>
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

      {/* Generate API Key Modal */}
      <Modal
        isOpen={isKeyOpen}
        onClose={() => {
          setIsKeyOpen(false);
          setCreatedRawKey(null);
          setKeyName('');
        }}
        title="Generate Server API Key"
      >
        {createdRawKey ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: '1.5',
              }}
            >
              Please save this secret key somewhere safe. For security reasons,{' '}
              <strong>you will not be able to view it again</strong> through the Setup panel. If you
              lose this key, you will need to revoke it and create a new one.
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Key Name / Description
              </label>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {keyName}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '6px',
                }}
              >
                Secret Key
              </label>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={createdRawKey}
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'text',
                  }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopyKey}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: copiedKey ? '#10b981' : 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedKey) e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedKey) e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                  title="Copy to clipboard"
                >
                  {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setIsKeyOpen(false);
                  setCreatedRawKey(null);
                  setKeyName('');
                }}
                className="btn btn-primary"
                style={{ padding: '8px 24px', fontSize: '13px', fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleCreateApiKey}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div>
              <label
                style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
              >
                Key Description / Name
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. CI Integration Key"
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
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsKeyOpen(false);
                  setCreatedRawKey(null);
                  setKeyName('');
                }}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Generate Key
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add Webhook Modal */}
      <Modal
        isOpen={isWebhookOpen}
        onClose={() => {
          setIsWebhookOpen(false);
          setWebhookUrl('');
          setWebhookEvents(['ticket.created', 'ticket.updated']);
        }}
        title="Register Webhook Endpoint"
      >
        <form
          onSubmit={handleCreateWebhook}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Payload URL *
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="e.g. https://api.mycompany.com/webhook"
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
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
            >
              Event Subscriptions
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'ticket.created - Raised support tickets', val: 'ticket.created' },
                { label: 'ticket.updated - Field updates', val: 'ticket.updated' },
                { label: 'ticket.commented - Replies & Notes added', val: 'ticket.commented' },
                { label: 'ticket.resolved - Resolution confirmations', val: 'ticket.resolved' },
              ].map((ev) => {
                const isChecked = webhookEvents.includes(ev.val);
                return (
                  <label
                    key={ev.val}
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
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setWebhookEvents([...webhookEvents, ev.val]);
                        } else {
                          setWebhookEvents(webhookEvents.filter((item) => item !== ev.val));
                        }
                      }}
                    />
                    <span>{ev.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
          >
            <button
              type="button"
              onClick={() => setIsWebhookOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Add Webhook
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit DSR Modal */}
      <Modal
        isOpen={isDsrOpen}
        onClose={() => setIsDsrOpen(false)}
        title="Submit GDPR Data Subject Request"
      >
        <form
          onSubmit={handleCreateDsr}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              User Email Address *
            </label>
            <input
              type="email"
              value={dsrEmail}
              onChange={(e) => setDsrEmail(e.target.value)}
              placeholder="e.g. customer@example.com"
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
              DSR Request Type *
            </label>
            <select
              value={dsrType}
              onChange={(e) => setDsrType(e.target.value as any)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <option value="EXPORT">Art. 15 Personal Data Export (JSON format)</option>
              <option value="ERASURE">
                Art. 17 In-place PII Anonymization (Right to be Forgotten)
              </option>
            </select>
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Reason / Notes
            </label>
            <textarea
              value={dsrReason}
              onChange={(e) => setDsrReason(e.target.value)}
              placeholder="e.g. Requested by customer support ticket."
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
              onClick={() => setIsDsrOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
