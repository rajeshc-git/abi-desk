import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  X,
  AlertCircle,
  Building2,
  Box,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Loader2,
  User,
} from 'lucide-react';
import { ApiClient } from '../../api/client';

export interface SplitTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentTicket: {
    id: string;
    number: string;
    subject: string;
    priority?: string;
    tier?: string;
    organization?: string;
    product?: string;
    customFields?: {
      organization?: string;
      product?: string;
      [key: string]: any;
    };
    requester?: { fullName?: string; email?: string } | null;
  };
  commentToSplit: {
    id: string;
    body: string;
    createdAt?: string;
    author?: { fullName?: string; email?: string; kind?: string } | null;
  } | null;
  onConfirmSplit: (data: {
    commentId: string;
    subject: string;
    description?: string;
    priority?: string;
    tier?: string;
    organization?: string;
    product?: string;
  }) => Promise<any>;
}

const getCleanPlainText = (content?: string | null): string => {
  if (!content) return '';
  try {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const unwanted = doc.querySelectorAll('script, style, meta, head, link');
    unwanted.forEach((el) => el.remove());

    // Insert newlines for line breaks and block elements
    const blockElements = doc.querySelectorAll('br, p, div, tr, li, h1, h2, h3, h4, h5, h6, blockquote, hr');
    blockElements.forEach((el) => {
      el.after('\n');
    });

    const rawText = doc.body.textContent || doc.body.innerText || '';
    return rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
      .join('\n')
      .trim();
  } catch {
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();
  }
};

export const SplitTicketModal: React.FC<SplitTicketModalProps> = ({
  isOpen,
  onClose,
  parentTicket,
  commentToSplit,
  onConfirmSplit,
}) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL'>('NORMAL');
  const [tier, setTier] = useState<'L1' | 'L2' | 'L3' | 'DEV' | 'DEVOPS' | 'QA'>('L1');
  const [organization, setOrganization] = useState('');
  const [product, setProduct] = useState('');
  const [availableOrgs, setAvailableOrgs] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);
  const [isFullThreadLoaded, setIsFullThreadLoaded] = useState(true);

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

  // Load organizations and products list
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

  const cleanBodyText = React.useMemo(() => {
    return getCleanPlainText(commentToSplit?.body);
  }, [commentToSplit?.body]);

  // Initialize fields when modal opens
  useEffect(() => {
    if (isOpen && commentToSplit) {
      const plain = getCleanPlainText(commentToSplit.body);

      // Try to extract an inner subject header if it's a forwarded/nested reply
      const subjectMatch = plain.match(/Subject:\s*([^\n\r]+)/i);
      let suggestedSubject = '';

      if (subjectMatch && subjectMatch[1]?.trim().length > 3) {
        const extracted = subjectMatch[1].trim();
        suggestedSubject = extracted.startsWith('Split:') ? extracted : `Split: ${extracted}`;
      } else if (parentTicket.subject) {
        suggestedSubject = parentTicket.subject.startsWith('Split:')
          ? parentTicket.subject
          : `Split: ${parentTicket.subject}`;
      } else {
        suggestedSubject = 'Split Ticket';
      }

      setSubject(suggestedSubject);
      
      const isLong = (plain || '').length > 300;
      if (isLong) {
        setDescription(plain.slice(0, 300).trim() + '...');
        setIsFullThreadLoaded(false);
      } else {
        setDescription(plain || commentToSplit.body || '');
        setIsFullThreadLoaded(true);
      }
      setIsQuoteExpanded(false);

      setPriority(
        (['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'].includes(parentTicket.priority || '')
          ? parentTicket.priority
          : 'NORMAL') as any,
      );
      setTier(
        (['L1', 'L2', 'L3', 'DEV', 'DEVOPS', 'QA'].includes(parentTicket.tier || '')
          ? parentTicket.tier
          : 'L1') as any,
      );

      const initialOrg =
        parentTicket.customFields?.organization || parentTicket.organization || '';
      const initialProd = parentTicket.customFields?.product || parentTicket.product || '';
      setOrganization(initialOrg);
      setProduct(initialProd);
      setError(null);
    }
  }, [isOpen, commentToSplit, parentTicket]);

  if (!isOpen || !commentToSplit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedDesc = description.trim();

    if (!trimmedSubject) {
      setError('Ticket Subject is required.');
      return;
    }
    if (!trimmedDesc) {
      setError('Description & Investigation Notes are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmSplit({
        commentId: commentToSplit.id,
        subject: trimmedSubject,
        description: trimmedDesc,
        priority,
        tier,
        organization: organization.trim() || undefined,
        product: product.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to split ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requesterName =
    commentToSplit.author?.fullName ||
    commentToSplit.author?.email ||
    parentTicket.requester?.fullName ||
    parentTicket.requester?.email ||
    'Customer';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-medium, #e2e8f0)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-app, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scissors size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Split as New Ticket
              </h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Fork this message thread into a separate standalone ticket
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Error Message */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '6px',
                  color: '#ef4444',
                  fontSize: '12.5px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Source Reference Banner */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-app, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>SOURCE TICKET</span>
                <span style={{ fontWeight: 700, color: '#2563eb' }}>#{parentTicket.number}</span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {parentTicket.subject}
              </div>

              {/* Message Quote Preview */}
              <div
                style={{
                  marginTop: '4px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  borderLeft: '3px solid #2563eb',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  maxHeight: isQuoteExpanded ? '200px' : '70px',
                  overflowY: 'auto',
                  lineHeight: '1.45',
                  fontStyle: 'italic',
                  transition: 'max-height 0.2s ease',
                }}
              >
                "{isQuoteExpanded || cleanBodyText.length <= 180 ? cleanBodyText || commentToSplit.body : cleanBodyText.slice(0, 180).trim() + '...'}"
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={11} />
                  <span>Message by <strong>{requesterName}</strong></span>
                </div>
                {cleanBodyText.length > 180 && (
                  <button
                    type="button"
                    onClick={() => setIsQuoteExpanded(!isQuoteExpanded)}
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
                      padding: 0,
                    }}
                  >
                    {isQuoteExpanded ? <>Show less <ChevronUp size={11} /></> : <>Show more <ChevronDown size={11} /></>}
                  </button>
                )}
              </div>
            </div>

            {/* Ticket Subject */}
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
                  borderRadius: 'var(--radius-md, 6px)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: '13px',
                }}
                required
              />
            </div>

            {/* Priority & Support Tier (2 columns) */}
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
                    borderRadius: 'var(--radius-md, 6px)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
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
                    borderRadius: 'var(--radius-md, 6px)',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
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

            {/* Description & Investigation Notes * */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <label
                  style={{ display: 'block', fontSize: '12px', fontWeight: 600, margin: 0 }}
                >
                  Description & Investigation Notes <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {cleanBodyText.length > 300 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isFullThreadLoaded) {
                        setDescription(cleanBodyText.slice(0, 300).trim() + '...');
                        setIsFullThreadLoaded(false);
                      } else {
                        setDescription(cleanBodyText);
                        setIsFullThreadLoaded(true);
                      }
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
                      gap: '3px',
                      padding: '1px 4px',
                      borderRadius: '4px',
                    }}
                  >
                    {isFullThreadLoaded ? (
                      <>
                        <ChevronUp size={11} /> Collapse snippet
                      </>
                    ) : (
                      <>
                        <ChevronDown size={11} /> Load full thread
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsFullThreadLoaded(true);
                }}
                placeholder="Detailed description of the customer issue..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md, 6px)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  resize: 'vertical',
                  fontSize: '13px',
                }}
                required
              />
              {cleanBodyText.length > 300 && (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '6px 10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.06)',
                    border: '1px dashed rgba(37, 99, 235, 0.25)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    {isFullThreadLoaded
                      ? `Showing full message thread (${description.length} chars)`
                      : `Showing preview snippet (${description.length} of ${cleanBodyText.length} chars)`}
                  </span>
                </div>
              )}
            </div>

            {/* Organization / Client & Product / Application Pickers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Organization Searchable Dropdown */}
              <div ref={orgDropdownRef} style={{ position: 'relative' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 600,
                      fontSize: '12px',
                      margin: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Building2 size={13} style={{ color: '#38bdf8', flexShrink: 0 }} />
                    <span>Organization / Client</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                      (Optional)
                    </span>
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
                      boxShadow:
                        '0 -10px 25px -5px rgba(0, 0, 0, 0.2), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
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

                    <div
                      style={{
                        maxHeight: '160px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
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
                            {availableOrgs.length === 0
                              ? 'No organizations found.'
                              : 'No matching organizations'}
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
                              (o.domains &&
                                o.domains.toLowerCase().includes(orgSearch.toLowerCase())),
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
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minWidth: 0,
                                    flex: 1,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: isSelected ? 600 : 400,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {org.name}
                                  </span>
                                  {org.domains && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        color: 'var(--text-muted)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {org.domains}
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                                )}
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 600,
                      fontSize: '12px',
                      margin: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Box size={13} style={{ color: '#a855f7', flexShrink: 0 }} />
                    <span>Product / Application</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                      (Optional)
                    </span>
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
                      boxShadow:
                        '0 -10px 25px -5px rgba(0, 0, 0, 0.2), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
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

                    <div
                      style={{
                        maxHeight: '160px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
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
                            {availableProducts.length === 0
                              ? 'No products found.'
                              : 'No matching products'}
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
                                <span
                                  style={{
                                    fontWeight: isSelected ? 600 : 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {p}
                                </span>
                                {isSelected && (
                                  <Check size={13} style={{ color: '#9333ea', flexShrink: 0 }} />
                                )}
                              </button>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm"
              style={{ padding: '7px 14px', fontSize: '12.5px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !description.trim()}
              className="btn btn-primary btn-sm"
              style={{
                padding: '7px 18px',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Creating Split Ticket...</span>
                </>
              ) : (
                <>
                  <Scissors size={13} />
                  <span>Create Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
