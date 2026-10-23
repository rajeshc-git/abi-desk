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
  Paperclip,
  Upload,
  FileText,
  Loader2,
} from 'lucide-react';
import { TicketsApi } from '../../api/tickets';
import { ApiClient } from '../../api/client';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';

interface UploadedAttachment {
  id: string;
  name: string;
  previewUrl?: string;
  isUploading?: boolean;
  sizeBytes?: number;
  error?: string;
}

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

  // Attachments State & Refs
  const [uploadedFiles, setUploadedFiles] = useState<UploadedAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadSingleFile = async (file: File) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isImg = file.type.startsWith('image/');
    const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

    setUploadedFiles((prev) => [
      ...prev,
      {
        id: tempId,
        name: file.name,
        previewUrl,
        isUploading: true,
        sizeBytes: file.size,
      },
    ]);

    try {
      const result = await TicketsApi.uploadFile(file);
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                id: result.id,
                name: result.originalFilename || file.name,
                isUploading: false,
              }
            : f,
        ),
      );
    } catch (err: any) {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === tempId
            ? {
                ...f,
                isUploading: false,
                error: err.message || 'Upload failed',
              }
            : f,
        ),
      );
    }
  };

  const handleFilesUpload = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      uploadSingleFile(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl && file.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) filesToUpload.push(file);
      }
    }
    if (filesToUpload.length > 0) {
      handleFilesUpload(filesToUpload);
    }
  };

  const resetForm = () => {
    setSubject('');
    setDescription('');
    setRequesterName('');
    setRequesterEmail('');
    setOrganization('');
    setProduct('');
    setIsOrgOpen(false);
    setIsProductOpen(false);
    uploadedFiles.forEach((f) => {
      if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setUploadedFiles([]);
    setIsDragging(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedSubject = subject.trim();
    const trimmedName = requesterName.trim();
    const trimmedEmail = requesterEmail.trim();
    const trimmedDescription = description.trim();
    const trimmedProduct = product.trim();

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
    if (!trimmedProduct) {
      setError('Product / Application is required.');
      return;
    }

    if (uploadedFiles.some((f) => f.isUploading)) {
      setError('Please wait for all attachments to finish uploading.');
      return;
    }

    const readyAttachmentIds = uploadedFiles
      .filter((f) => !f.isUploading && !f.error && !f.id.startsWith('temp-'))
      .map((f) => f.id);

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
        attachmentIds: readyAttachmentIds.length > 0 ? readyAttachmentIds : undefined,
      });

      onCreated(res);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Support Ticket" maxWidth="620px">
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
            onPaste={handlePaste}
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
                Product / Application <span style={{ color: '#ef4444' }}>*</span>
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
                  : (error && !product)
                  ? 'rgba(239, 68, 68, 0.05)'
                  : 'var(--bg-input)',
                border: product
                  ? '1px solid rgba(168, 85, 247, 0.35)'
                  : (error && !product)
                  ? '1px solid #ef4444'
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

        {/* Attachments Drag & Drop Area */}
        <div>
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
              <Paperclip size={13} style={{ color: 'var(--primary, #2563eb)' }} />
              Attachments <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            {uploadedFiles.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {uploadedFiles.length} {uploadedFiles.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files) handleFilesUpload(e.target.files);
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                handleFilesUpload(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '16px 14px',
              borderRadius: 'var(--radius-md, 8px)',
              border: isDragging
                ? '2px dashed var(--primary, #2563eb)'
                : '1.5px dashed var(--border-medium, #cbd5e1)',
              backgroundColor: isDragging
                ? 'rgba(37, 99, 235, 0.08)'
                : 'var(--bg-input, rgba(248, 250, 252, 0.5))',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              textAlign: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isDragging
                  ? 'rgba(37, 99, 235, 0.15)'
                  : 'var(--bg-surface-elevated, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDragging ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={16} />
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
              <span style={{ fontWeight: 600, color: 'var(--primary, #2563eb)' }}>Click to upload</span> or drag and drop
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Images, PDFs, documents, logs, screen recordings up to 25 MB
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '8px',
                marginTop: '10px',
              }}
            >
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-md, 6px)',
                    backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                    border: file.error
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid var(--border-medium, #e2e8f0)',
                    fontSize: '12px',
                    position: 'relative',
                  }}
                >
                  {/* Thumbnail / Icon */}
                  {file.previewUrl ? (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        backgroundColor: '#f1f5f9',
                        flexShrink: 0,
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                      }}
                    >
                      <img
                        src={file.previewUrl}
                        alt={file.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: 'var(--primary, #2563eb)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={16} />
                    </div>
                  )}

                  {/* File Info */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-primary)',
                      }}
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px' }}>
                      {file.isUploading ? (
                        <span style={{ color: 'var(--primary, #2563eb)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Loader2 size={10} className="animate-spin" /> Uploading...
                        </span>
                      ) : file.error ? (
                        <span style={{ color: '#ef4444' }}>{file.error}</span>
                      ) : (
                        <>
                          <span style={{ color: 'var(--text-muted)' }}>{formatFileSize(file.sizeBytes)}</span>
                          <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                            <Check size={10} /> Ready
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    disabled={file.isUploading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: file.isUploading ? 'not-allowed' : 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title="Remove file"
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={handleClose} className="btn btn-secondary btn-sm">
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
