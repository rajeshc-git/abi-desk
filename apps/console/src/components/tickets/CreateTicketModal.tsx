import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  AlertCircle,
  Building2,
  Box,
  Search,
  ChevronDown,
  X,
  Check,
} from 'lucide-react';
import { TicketsApi } from '../../api/tickets';
import { ApiClient } from '../../api/client';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (ticket: any) => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { activeBrandId } = useAuth();

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL'>(
    'NORMAL',
  );
  const [tier, setTier] = useState<'L1' | 'L2' | 'L3' | 'DEV' | 'DEVOPS' | 'QA'>('L1');
  const [organization, setOrganization] = useState('');
  const [product, setProduct] = useState('');
  const [availableOrgs, setAvailableOrgs] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Searchable Organization Dropdown State & Refs
  const [isOrgOpen, setIsOrgOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const orgSearchRef = useRef<HTMLInputElement>(null);

  // Searchable Product Dropdown State & Refs
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      try {
        const [orgsRes, prodsRes] = await Promise.all([
          ApiClient.get<any[]>('/organizations').catch(() => []),
          ApiClient.get<any[]>('/admin/roster/products').catch(() => []),
        ]);
        if (Array.isArray(orgsRes)) setAvailableOrgs(orgsRes);
        if (Array.isArray(prodsRes)) {
          setAvailableProducts(prodsRes.map((p) => p.name).filter(Boolean));
        }
      } catch {
        // non-blocking
      }
    };
    loadData();
  }, [isOpen]);

  // Click outside to close dropdowns
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

  // Focus search inputs when dropdown opens
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedSubject = subject.trim();
    const trimmedName = requesterName.trim();
    const trimmedEmail = requesterEmail.trim();
    const trimmedDescription = description.trim();

    if (!trimmedSubject) {
      setError('Ticket Subject is required.');
      return;
    }
    if (!trimmedName) {
      setError('Customer Full Name is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      setError('Customer Email is required.');
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please provide a valid Customer Email address.');
      return;
    }
    if (!trimmedDescription) {
      setError('Description & Investigation Notes are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await TicketsApi.create({
        subject: trimmedSubject,
        description: trimmedDescription,
        requesterName: trimmedName,
        requesterEmail: trimmedEmail,
        priority,
        tier,
        organization: organization.trim() || undefined,
        product: product.trim() || undefined,
        brandId: activeBrandId || undefined,
      });

      onCreated(res);
      onClose();
      // Reset
      setSubject('');
      setDescription('');
      setRequesterName('');
      setRequesterEmail('');
      setOrganization('');
      setProduct('');
      setIsOrgOpen(false);
      setIsProductOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Support Ticket" maxWidth="600px">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label
            style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
          >
            Ticket Subject <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Database connection timeout on billing portal"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
            >
              Customer Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              required
            />
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
            >
              Customer Email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="alex@customer.com"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              required
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
            >
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
            >
              Support Tier
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="L1">L1 Frontline</option>
              <option value="L2">L2 Technical</option>
              <option value="L3">L3 Product</option>
              <option value="DEV">Dev Engineering</option>
              <option value="DEVOPS">DevOps & Infra</option>
              <option value="QA">QA Verification</option>
            </select>
          </div>
        </div>

        <div>
          <label
            style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
          >
            Description & Investigation Notes <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the customer issue..."
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'vertical',
            }}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Organization / Client Searchable Dropdown */}
          <div ref={orgDropdownRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  fontSize: '12px',
                  margin: 0,
                }}
              >
                <Building2 size={13} style={{ color: '#38bdf8' }} />
                Organization / Client <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsOrgOpen(!isOrgOpen);
                  setIsProductOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '1px 4px',
                  borderRadius: '4px',
                }}
              >
                {organization ? 'Change' : 'Select'}
                <ChevronDown size={11} />
              </button>
            </div>

            <div
              onClick={() => {
                setIsOrgOpen(!isOrgOpen);
                setIsProductOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                backgroundColor: organization
                  ? 'rgba(56, 189, 248, 0.08)'
                  : 'var(--bg-input)',
                border: organization
                  ? '1px solid rgba(56, 189, 248, 0.35)'
                  : '1px dashed var(--border-medium)',
                minHeight: '38px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Building2
                  size={14}
                  style={{
                    color: organization ? '#38bdf8' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: organization ? 600 : 400,
                    color: organization
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {organization || 'No Organization selected'}
                </span>
              </div>

              {organization && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrganization('');
                  }}
                  title="Clear Organization"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Organization Dropdown Popup */}
            {isOrgOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '6px',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.2), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                  padding: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    marginBottom: '6px',
                  }}
                >
                  <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  {orgSearch && (
                    <button
                      type="button"
                      onClick={() => setOrgSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {organization && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrganization('');
                        setIsOrgOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px',
                      }}
                    >
                      <X size={11} /> Clear selection (No Organization)
                    </button>
                  )}
                  {availableOrgs.filter(
                    (o) =>
                      o.name?.toLowerCase().includes(orgSearch.toLowerCase()) ||
                      (o.domains && o.domains.toLowerCase().includes(orgSearch.toLowerCase())),
                  ).length === 0 ? (
                    <div>
                      <div
                        style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {availableOrgs.length === 0 ? 'No organizations found.' : 'No matching organizations'}
                      </div>
                      {orgSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrganization(orgSearch.trim());
                            setIsOrgOpen(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: 'none',
                            border: '1px dashed var(--border-subtle)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={12} /> Use "{orgSearch.trim()}"
                        </button>
                      )}
                    </div>
                  ) : (
                    availableOrgs
                      .filter(
                        (o) =>
                          o.name?.toLowerCase().includes(orgSearch.toLowerCase()) ||
                          (o.domains && o.domains.toLowerCase().includes(orgSearch.toLowerCase())),
                      )
                      .map((org) => {
                        const isSelected = org.name === organization;
                        return (
                          <button
                            key={org.id || org.name}
                            type="button"
                            onClick={() => {
                              setOrganization(org.name);
                              setIsOrgOpen(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              backgroundColor: isSelected
                                ? 'rgba(56, 189, 248, 0.15)'
                                : 'transparent',
                              border: 'none',
                              color: isSelected ? '#0284c7' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {org.name}
                              </span>
                              {org.domains && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {org.domains}
                                </span>
                              )}
                            </div>
                            {isSelected && <Check size={13} style={{ color: '#0284c7', flexShrink: 0 }} />}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Product / Application Searchable Dropdown */}
          <div ref={productDropdownRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                  fontSize: '12px',
                  margin: 0,
                }}
              >
                <Box size={13} style={{ color: '#a855f7' }} />
                Product / Application <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setIsProductOpen(!isProductOpen);
                  setIsOrgOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '1px 4px',
                  borderRadius: '4px',
                }}
              >
                {product ? 'Change' : 'Select'}
                <ChevronDown size={11} />
              </button>
            </div>

            <div
              onClick={() => {
                setIsProductOpen(!isProductOpen);
                setIsOrgOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md, 6px)',
                cursor: 'pointer',
                backgroundColor: product
                  ? 'rgba(168, 85, 247, 0.08)'
                  : 'var(--bg-input)',
                border: product
                  ? '1px solid rgba(168, 85, 247, 0.35)'
                  : '1px dashed var(--border-medium)',
                minHeight: '38px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <Box
                  size={14}
                  style={{
                    color: product ? '#a855f7' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: product ? 600 : 400,
                    color: product
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {product || 'No Product selected'}
                </span>
              </div>

              {product && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProduct('');
                  }}
                  title="Clear Product"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Product Dropdown Popup */}
            {isProductOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '6px',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  borderRadius: 'var(--radius-md, 8px)',
                  boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.2), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                  padding: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input, #f8fafc)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    marginBottom: '6px',
                  }}
                >
                  <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                      }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {product && (
                    <button
                      type="button"
                      onClick={() => {
                        setProduct('');
                        setIsProductOpen(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px',
                      }}
                    >
                      <X size={11} /> Clear selection (No Product)
                    </button>
                  )}
                  {availableProducts.filter((p) =>
                    p.toLowerCase().includes(productSearch.toLowerCase()),
                  ).length === 0 ? (
                    <div>
                      <div
                        style={{
                          padding: '8px',
                          textAlign: 'center',
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {availableProducts.length === 0 ? 'No products found.' : 'No matching products'}
                      </div>
                      {productSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setProduct(productSearch.trim());
                            setIsProductOpen(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: 'none',
                            border: '1px dashed var(--border-subtle)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={12} /> Use "{productSearch.trim()}"
                        </button>
                      )}
                    </div>
                  ) : (
                    availableProducts
                      .filter((p) => p.toLowerCase().includes(productSearch.toLowerCase()))
                      .map((p) => {
                        const isSelected = p === product;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setProduct(p);
                              setIsProductOpen(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              backgroundColor: isSelected
                                ? 'rgba(168, 85, 247, 0.15)'
                                : 'transparent',
                              border: 'none',
                              color: isSelected ? '#9333ea' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                            }}
                          >
                            <span style={{ fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p}
                            </span>
                            {isSelected && <Check size={13} style={{ color: '#9333ea', flexShrink: 0 }} />}
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
            {isSubmitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
