import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Inbox,
  MessageSquare,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Sparkles,
  Palette,
  Save,
  Check,
  Building2,
  User,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ZohoDeskLogo } from '../common/ZohoDeskLogo';
import { Modal } from '../common/Modal';
import { ApiClient } from '../../api/client';
import { THEME_PRESETS, applyPrimaryTheme } from '../../styles/theme-utils';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, logout, activeBrandId, brands, reloadBrands, updatePersonalTheme } = useAuth();

  const canManageBrand =
    user?.permissions?.includes('admin:brand:manage') ||
    user?.roles?.includes('TENANT_ADMIN') ||
    user?.roles?.includes('ADMIN');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [logoutCountdown, setLogoutCountdown] = useState(10);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'theme'>('theme');
  const [saveTarget, setSaveTarget] = useState<'PERSONAL' | 'COMPANY'>('PERSONAL');

  useEffect(() => {
    let timer: any;
    if (isLogoutModalOpen) {
      setLogoutCountdown(10);
      timer = setInterval(() => {
        setLogoutCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            logout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLogoutModalOpen, logout]);
  const [brandThemeColor, setBrandThemeColor] = useState<string>(() => {
    const activeBrand = brands.find((b) => b.id === activeBrandId);
    return activeBrand?.primaryColor || '#2563eb';
  });
  const [personalThemeColor, setPersonalThemeColor] = useState<string>(
    () => user?.preferences?.themeColor || '#2563eb',
  );
  const [isThemeSaving, setIsThemeSaving] = useState(false);

  useEffect(() => {
    if (canManageBrand) {
      setSaveTarget('COMPANY');
    } else {
      setSaveTarget('PERSONAL');
    }
  }, [canManageBrand]);

  useEffect(() => {
    const activeBrand = brands.find((b) => b.id === activeBrandId);
    if (activeBrand?.primaryColor) {
      setBrandThemeColor(activeBrand.primaryColor);
    }
    const personalColor = user?.preferences?.themeColor;
    if (personalColor) {
      setPersonalThemeColor(personalColor);
    } else if (activeBrand?.primaryColor) {
      setPersonalThemeColor(activeBrand.primaryColor);
    }
  }, [isSettingsOpen, user?.preferences?.themeColor, activeBrandId, brands]);

  const selectedThemeColor = saveTarget === 'COMPANY' ? brandThemeColor : personalThemeColor;

  const handleColorChange = (newColor: string) => {
    if (saveTarget === 'COMPANY') {
      setBrandThemeColor(newColor);
      if (!user?.preferences?.themeColor) {
        applyPrimaryTheme(newColor);
      }
    } else {
      setPersonalThemeColor(newColor);
      applyPrimaryTheme(newColor);
    }
  };

  const handleSaveTheme = async () => {
    setIsThemeSaving(true);
    try {
      if (saveTarget === 'COMPANY' && canManageBrand) {
        if (!activeBrandId) {
          alert('Please select an active brand in the top header first.');
          return;
        }
        await ApiClient.patch(`/admin/brands/${activeBrandId}`, {
          primaryColor: brandThemeColor,
          accentColor: brandThemeColor,
        });
        await reloadBrands();
      } else {
        await updatePersonalTheme(personalThemeColor);
      }
      setIsSettingsOpen(false);
    } catch (err: any) {
      alert(`Failed to save theme: ${err.message}`);
    } finally {
      setIsThemeSaving(false);
    }
  };

  const handleResetToBrandTheme = async () => {
    setIsThemeSaving(true);
    try {
      await updatePersonalTheme(null);
      const activeBrand = brands.find((b) => b.id === activeBrandId);
      if (activeBrand?.primaryColor) {
        setPersonalThemeColor(activeBrand.primaryColor);
      }
      setIsSettingsOpen(false);
    } catch (err: any) {
      alert(`Failed to reset theme: ${err.message}`);
    } finally {
      setIsThemeSaving(false);
    }
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    // Restore saved effective theme
    const personalColor = user?.preferences?.themeColor;
    if (personalColor) {
      applyPrimaryTheme(personalColor);
    } else {
      const activeBrand = brands.find((b) => b.id === activeBrandId);
      if (activeBrand?.primaryColor) {
        applyPrimaryTheme(activeBrand.primaryColor);
      }
    }
  };

  const navItems = [
    {
      title: 'Ticket Desk',
      path: '/inbox',
      icon: Inbox,
      roles: [
        'TENANT_ADMIN',
        'L1_SUPPORT',
        'L2_SUPPORT',
        'L3_SUPPORT',
        'DEV_TEAM',
        'QA_TEAM',
        'GUEST_CUSTOMER',
      ],
    },
    {
      title: 'Live Chat',
      path: '/chat',
      icon: MessageSquare,
      roles: ['TENANT_ADMIN', 'L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM'],
      permissions: ['chat:participate', 'chat:respond', 'chat:start'],
    },
    {
      title: 'Analytics & SLA',
      path: '/analytics',
      icon: BarChart3,
      roles: ['TENANT_ADMIN', 'L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM', 'QA_TEAM'],
      permissions: ['report:view:tenant', 'report:view:own'],
    },
    {
      title: 'Setup',
      path: '/admin',
      icon: Settings,
      roles: ['TENANT_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      permissions: ['admin:brand:manage', 'admin:user:manage', 'admin:team:manage', 'admin:sso:manage'],
    },
  ];

  const userRoles = user?.roles || [];
  const primaryRole = userRoles[0] || 'USER';

  return (
    <>
      <aside className="app-sidebar">
        <div className="sidebar-header" style={{ padding: '14px 16px' }}>
        <ZohoDeskLogo size={32} showText={true} />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Support Operations</div>
        {navItems.map((item) => {
          const isTenantAdmin =
            userRoles.includes('TENANT_ADMIN') ||
            userRoles.includes('ADMIN') ||
            userRoles.includes('PLATFORM_ADMIN');

          let isAllowed = false;
          if (isTenantAdmin) {
            isAllowed = true;
          } else if (item.permissions && user?.permissions && user.permissions.length > 0) {
            isAllowed =
              item.permissions.some((p) => user.permissions!.includes(p)) ||
              item.roles.some((r) => userRoles.includes(r));
          } else {
            isAllowed = item.roles.some((r) => userRoles.includes(r));
          }
          if (!isAllowed) return null;

          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <Link key={item.path} to={item.path} className={`nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div
          className="user-avatar"
          onClick={() => setIsProfileOpen(true)}
          style={{ cursor: 'pointer' }}
          title="View Profile"
        >
          {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'AD'}
        </div>
        <div
          className="user-info"
          onClick={() => setIsProfileOpen(true)}
          style={{ cursor: 'pointer' }}
          title="View Profile"
        >
          <div className="user-name">{user?.fullName || 'Support Agent'}</div>
          <div className="user-role-badge">{primaryRole.replace(/_/g, ' ')}</div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Console Settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            title="Sign out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>

      <Modal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
        title="Console Settings"
        maxWidth="900px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Settings Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '20px',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '0px',
              overflowX: 'auto',
              marginBottom: '4px',
            }}
          >
            {[{ id: 'theme', label: 'Console Theme', icon: Palette }].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSettingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSettingsTab(tab.id as any)}
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

          {activeSettingsTab === 'theme' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {canManageBrand ? (
                <div
                  style={{
                    display: 'flex',
                    gap: '24px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '0px',
                    marginBottom: '6px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSaveTarget('COMPANY');
                      if (!user?.preferences?.themeColor) {
                        applyPrimaryTheme(brandThemeColor);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 4px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: saveTarget === 'COMPANY' ? 'var(--primary)' : 'var(--text-secondary)',
                      border: 'none',
                      borderBottom: `2.5px solid ${saveTarget === 'COMPANY' ? 'var(--primary)' : 'transparent'}`,
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Building2 size={14} />
                    <span>Brand (Global + Widget)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveTarget('PERSONAL');
                      applyPrimaryTheme(personalThemeColor);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 4px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: saveTarget === 'PERSONAL' ? 'var(--primary)' : 'var(--text-secondary)',
                      border: 'none',
                      borderBottom: `2.5px solid ${saveTarget === 'PERSONAL' ? 'var(--primary)' : 'transparent'}`,
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <User size={14} />
                    <span>My Personal</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  🎨 <strong>Personal Appearance:</strong> Select your personal theme accent. Company-wide branding is managed by Tenant Admins.
                </div>
              )}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '12px',
                  }}
                >
                  {saveTarget === 'COMPANY' ? 'Choose Brand Theme Preset (Applies to all users & widget):' : 'Choose Personal Theme Preset (Applies to your console only):'}
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {THEME_PRESETS.map((preset) => {
                    const isSelected =
                      selectedThemeColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.name}
                        onClick={() => handleColorChange(preset.hex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: `2px solid ${isSelected ? preset.hex : 'var(--border-subtle)'}`,
                          backgroundColor: isSelected ? preset.surface : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: preset.hex,
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: isSelected ? preset.hex : 'var(--text-primary)',
                              }}
                            >
                              {preset.name}
                            </span>
                            {isSelected && <Check size={14} style={{ color: preset.hex }} />}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {preset.hex}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      marginBottom: '6px',
                    }}
                  >
                    Or Pick a Custom HEX Color:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="color"
                      value={selectedThemeColor}
                      onChange={(e) => handleColorChange(e.target.value)}
                      style={{
                        width: '40px',
                        height: '36px',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                    />
                    <input
                      type="text"
                      value={selectedThemeColor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (saveTarget === 'COMPANY') {
                          setBrandThemeColor(v);
                        } else {
                          setPersonalThemeColor(v);
                        }
                        if (/^#[0-9A-F]{6}$/i.test(v)) {
                          handleColorChange(v);
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-medium)',
                        fontSize: '13px',
                        width: '120px',
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-input)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {saveTarget === 'PERSONAL' && user?.preferences?.themeColor && (
                    <button
                      onClick={handleResetToBrandTheme}
                      disabled={isThemeSaving}
                      className="btn btn-secondary"
                      title="Reset to Company Brand Theme"
                    >
                      Reset to Brand Default
                    </button>
                  )}
                  <button
                    onClick={handleSaveTheme}
                    disabled={isThemeSaving}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Save size={14} />
                    <span>{isThemeSaving ? 'Saving...' : saveTarget === 'COMPANY' ? 'Save Brand Theme' : 'Save Personal Theme'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="My Profile"
        maxWidth="450px"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 0',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 700,
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            }}
          >
            {user?.fullName ? user.fullName.slice(0, 2).toUpperCase() : 'AD'}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Full Name
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.fullName || 'Support Agent'}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Email Address
              </span>
              <span
                style={{ fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'monospace' }}
              >
                {user?.email || 'N/A'}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Organization Name
              </span>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.tenantName || 'My Organization'}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Tenant ID
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {user?.tenantId || 'N/A'}
              </span>
            </div>

            <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                User Type
              </span>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor:
                    user?.kind === 'STAFF' ? 'var(--primary-subtle)' : 'var(--border-subtle)',
                  color: user?.kind === 'STAFF' ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                {user?.kind || 'STAFF'}
              </span>
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                Assigned Roles
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {user?.roles && user.roles.length > 0 ? (
                  user.roles.map((r: string) => (
                    <span
                      key={r}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {r.replace(/_/g, ' ')}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    None assigned
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Sign Out Confirmation"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 8px 4px', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            }}
          >
            <LogOut size={26} />
          </div>

          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Are you sure you want to sign out?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              You will be signed out of your workspace session and returned to the sign-in screen.
            </p>
          </div>

          {/* 10-second reverse countdown badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary, #475569)',
            }}
          >
            <Clock size={13} style={{ color: '#ef4444' }} />
            <span>Auto signing out in <strong style={{ color: '#ef4444' }}>{logoutCountdown}s</strong>...</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(false)}
              className="btn btn-secondary"
              style={{ flex: 1, height: '40px', fontWeight: 600 }}
            >
              Stay Signed In
            </button>
            <button
              type="button"
              onClick={logout}
              className="btn btn-primary"
              style={{ flex: 1, height: '40px', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff', fontWeight: 600 }}
            >
              Sign Out Now
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
