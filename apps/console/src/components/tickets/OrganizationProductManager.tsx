import React, { useState, useEffect, useRef } from 'react';
import { Building2, Box, Check, X, ChevronDown, Search } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface OrganizationItem {
  id: string;
  name: string;
  slug?: string;
  domains?: string | null;
}

interface OrganizationProductManagerProps {
  ticketId: string;
  organization?: string | null;
  product?: string | null;
  onOrganizationChange?: (org: string | null) => void;
  onProductChange?: (prod: string | null) => void;
  readonly?: boolean;
}

export const OrganizationProductManager: React.FC<OrganizationProductManagerProps> = ({
  ticketId,
  organization,
  product,
  onOrganizationChange,
  onProductChange,
  readonly = false,
}) => {
  const toast = useToast();

  // Organization state
  const [isOrgOpen, setIsOrgOpen] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<OrganizationItem[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [isUpdatingOrg, setIsUpdatingOrg] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const orgSearchRef = useRef<HTMLInputElement>(null);

  // Product state
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isUpdatingProd, setIsUpdatingProd] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  // Fetch registered organizations and products from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgsRes, prodsRes] = await Promise.all([
          ApiClient.get<any[]>('/organizations').catch(() => []),
          ApiClient.get<any[]>('/admin/roster/products').catch(() => []),
        ]);

        if (Array.isArray(orgsRes)) {
          setAvailableOrgs(orgsRes);
        }
        if (Array.isArray(prodsRes)) {
          const names = prodsRes.map((p) => p.name).filter(Boolean);
          setAvailableProducts(names);
        }
      } catch {
        // non-blocking
      }
    };
    fetchData();
  }, []);

  // Close modals on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setIsOrgOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setIsProductOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus inputs on open
  useEffect(() => {
    if (isOrgOpen) {
      setOrgSearch('');
      setTimeout(() => orgSearchRef.current?.focus(), 50);
    }
  }, [isOrgOpen]);

  useEffect(() => {
    if (isProductOpen) {
      setProductSearch('');
      setTimeout(() => productSearchRef.current?.focus(), 50);
    }
  }, [isProductOpen]);

  // Handle Save Organization
  const handleSelectOrg = async (selectedOrg: string | null) => {
    if (isUpdatingOrg || readonly) return;
    if (selectedOrg === (organization || null)) {
      setIsOrgOpen(false);
      return;
    }

    setIsUpdatingOrg(true);
    const prev = organization;
    onOrganizationChange?.(selectedOrg);
    setIsOrgOpen(false);

    try {
      await ApiClient.patch(`/tickets/${ticketId}`, { organization: selectedOrg });
      toast.success(selectedOrg ? `Organization set to "${selectedOrg}"` : 'Organization cleared');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update organization');
      onOrganizationChange?.(prev || null);
    } finally {
      setIsUpdatingOrg(false);
    }
  };

  // Handle Save Product
  const handleSelectProduct = async (selectedProd: string | null) => {
    if (isUpdatingProd || readonly) return;
    if (selectedProd === (product || null)) {
      setIsProductOpen(false);
      return;
    }

    setIsUpdatingProd(true);
    const prev = product;
    onProductChange?.(selectedProd);
    setIsProductOpen(false);

    try {
      await ApiClient.patch(`/tickets/${ticketId}`, { product: selectedProd });
      toast.success(selectedProd ? `Product set to "${selectedProd}"` : 'Product cleared');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update product');
      onProductChange?.(prev || null);
    } finally {
      setIsUpdatingProd(false);
    }
  };

  const filteredOrgs = availableOrgs.filter(
    (o) =>
      o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (o.domains && o.domains.toLowerCase().includes(orgSearch.toLowerCase())),
  );

  const filteredProducts = availableProducts.filter((p) =>
    p.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: 'var(--radius-lg, 10px)',
        backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.03))',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
      }}
    >
      {/* 1. Client Organization / Account Dropdown */}
      <div ref={orgDropdownRef} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Building2 size={13} style={{ color: '#38bdf8' }} />
            Organization / Account
          </span>

          {!readonly && (
            <button
              type="button"
              onClick={() => setIsOrgOpen(!isOrgOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary, #6366f1)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 4px',
                borderRadius: '4px',
              }}
            >
              {organization ? 'Change' : 'Select'}
              <ChevronDown size={11} />
            </button>
          )}
        </div>

        <div
          onClick={() => {
            if (!readonly) setIsOrgOpen(!isOrgOpen);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: readonly ? 'default' : 'pointer',
            backgroundColor: organization
              ? 'rgba(56, 189, 248, 0.08)'
              : 'var(--bg-input, rgba(0,0,0,0.2))',
            border: organization
              ? '1px solid rgba(56, 189, 248, 0.25)'
              : '1px dashed var(--border-subtle, rgba(255,255,255,0.1))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            <Building2
              size={14}
              style={{ color: organization ? '#38bdf8' : 'var(--text-muted, #94a3b8)', flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: organization ? 600 : 400,
                color: organization
                  ? 'var(--text-primary, #f8fafc)'
                  : 'var(--text-muted, #94a3b8)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {organization || 'No Organization selected'}
            </span>
          </div>

          {organization && !readonly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectOrg(null);
              }}
              title="Clear Organization"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Organization Dropdown Menu */}
        {isOrgOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              zIndex: 50,
              padding: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.3))',
                marginBottom: '6px',
              }}
            >
              <Search size={12} style={{ color: 'var(--text-muted, #94a3b8)' }} />
              <input
                ref={orgSearchRef}
                type="text"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="Search organizations..."
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {availableOrgs.length === 0 ? (
                <div
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  No organizations found. Add in Admin Settings → Organizations.
                </div>
              ) : filteredOrgs.length === 0 ? (
                <div
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  No matching organizations
                </div>
              ) : (
                filteredOrgs.map((org) => {
                  const isSelected = org.name === organization;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => handleSelectOrg(org.name)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'none',
                        border: 'none',
                        color: isSelected ? '#38bdf8' : 'var(--text-primary, #f8fafc)',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'none';
                      }}
                    >
                      <div style={{ minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {org.name}
                        </div>
                        {org.domains && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)' }}>
                            {org.domains}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check size={12} style={{ flexShrink: 0 }} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Product Name Dropdown */}
      <div ref={productDropdownRef} style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Box size={13} style={{ color: '#a855f7' }} />
            Product Name
          </span>

          {!readonly && (
            <button
              type="button"
              onClick={() => setIsProductOpen(!isProductOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary, #6366f1)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 4px',
                borderRadius: '4px',
              }}
            >
              {product ? 'Change' : 'Select'}
              <ChevronDown size={11} />
            </button>
          )}
        </div>

        <div
          onClick={() => {
            if (!readonly) setIsProductOpen(!isProductOpen);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: readonly ? 'default' : 'pointer',
            backgroundColor: product
              ? 'rgba(168, 85, 247, 0.08)'
              : 'var(--bg-input, rgba(0,0,0,0.2))',
            border: product
              ? '1px solid rgba(168, 85, 247, 0.25)'
              : '1px dashed var(--border-subtle, rgba(255,255,255,0.1))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            <Box
              size={14}
              style={{ color: product ? '#a855f7' : 'var(--text-muted, #94a3b8)', flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: '12px',
                fontWeight: product ? 600 : 400,
                color: product ? 'var(--text-primary, #f8fafc)' : 'var(--text-muted, #94a3b8)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {product || 'No Product selected'}
            </span>
          </div>

          {product && !readonly && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectProduct(null);
              }}
              title="Clear Product"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Product Dropdown Menu */}
        {isProductOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg-surface, #1e293b)',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              zIndex: 50,
              padding: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.3))',
                marginBottom: '6px',
              }}
            >
              <Search size={12} style={{ color: 'var(--text-muted, #94a3b8)' }} />
              <input
                ref={productSearchRef}
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {availableProducts.length === 0 ? (
                <div
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  No products found in shift roster matrix.
                </div>
              ) : filteredProducts.length === 0 ? (
                <div
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  No matching products
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = p === product;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'none',
                        border: 'none',
                        color: isSelected ? '#c084fc' : 'var(--text-primary, #f8fafc)',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'none';
                      }}
                    >
                      <span>{p}</span>
                      {isSelected && <Check size={12} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
