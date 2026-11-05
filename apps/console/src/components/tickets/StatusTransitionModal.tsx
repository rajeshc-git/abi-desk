import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X, Lock, CheckCircle2, Paperclip, Upload, FileText, Loader2, Send } from 'lucide-react';
import { getStatusMeta } from './StatusPopover';
import { ActionNoteBox } from '../common/ActionNoteBox';
import { TicketsApi } from '../../api/tickets';

interface UploadedFileItem {
  id: string;
  name: string;
  sizeBytes?: number;
  previewUrl?: string;
  isUploading: boolean;
  error?: string;
}

interface StatusTransitionModalProps {
  isOpen: boolean;
  ticketNumber: string | number;
  fromStatus: string;
  toStatus: string;
  onClose: () => void;
  onConfirm: (comment?: string, attachmentIds?: string[]) => Promise<void>;
  requiresComment?: boolean;
}

export const StatusTransitionModal: React.FC<StatusTransitionModalProps> = ({
  isOpen,
  ticketNumber,
  fromStatus,
  toStatus,
  onClose,
  onConfirm,
  requiresComment = false,
}) => {
  const [comment, setComment] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount or close
  useEffect(() => {
    return () => {
      uploadedFiles.forEach((f) => {
        if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
  }, []);

  if (!isOpen) return null;

  const fromMeta = getStatusMeta(fromStatus);
  const toMeta = getStatusMeta(toStatus);
  const isCustomerFacing = [
    'PENDING_CUSTOMER',
    'AWAITING_CUSTOMER_CONFIRMATION',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
  ].includes(toStatus);

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
        sizeBytes: file.size,
        isUploading: true,
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
    Array.from(files).forEach((file) => uploadSingleFile(file));
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

  const isUploadingAny = uploadedFiles.some((f) => f.isUploading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingAny) return;
    if (requiresComment && !comment.trim()) return;

    setIsSubmitting(true);
    try {
      const readyAttachmentIds = uploadedFiles
        .filter((f) => !f.isUploading && !f.error && !f.id.startsWith('temp-'))
        .map((f) => f.id);

      await onConfirm(
        comment.trim() || undefined,
        readyAttachmentIds.length > 0 ? readyAttachmentIds : undefined,
      );

      // Clean up preview URLs
      uploadedFiles.forEach((f) => {
        if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      setUploadedFiles([]);
      setComment('');
      onClose();
    } catch {
      // Error handled by parent toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    uploadedFiles.forEach((f) => {
      if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setUploadedFiles([]);
    setComment('');
    onClose();
  };

  return createPortal(
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
    >
      <div
        onPaste={handlePaste}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '14px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-medium, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-app, #f8fafc)',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Update Status — #{ticketNumber}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: fromMeta.color,
                  }}
                />
                {fromMeta.label}
              </span>
              <ArrowRight size={13} color="var(--text-muted, #94a3b8)" />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: toMeta.color,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: toMeta.color,
                  }}
                />
                {toMeta.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary, #0f172a)',
                marginBottom: '6px',
              }}
            >
              Transition Note / Action Rationale{' '}
              {requiresComment ? (
                <span style={{ color: '#ef4444' }}>*</span>
              ) : (
                <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              )}
            </label>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>
              {toStatus === 'PENDING_CUSTOMER'
                ? 'Specify the information or action required from the customer. SLA timers will pause.'
                : toStatus === 'ON_HOLD'
                ? 'Specify the reason this ticket is put on hold (e.g., waiting for third-party vendor).'
                : toStatus === 'CANCELLED'
                ? 'Provide the reason for cancelling this ticket.'
                : toStatus === 'RESOLVED'
                ? 'Provide resolution summary and details for resolving this ticket.'
                : toStatus === 'CLOSED'
                ? 'Provide final closure notes and resolution confirmation for closing this ticket.'
                : toStatus === 'REOPENED'
                ? 'Explain why this ticket is being reopened and what needs further investigation.'
                : toStatus === 'ESCALATED_L2'
                ? 'Add internal hand-off note and findings for L2 Support team.'
                : toStatus === 'ESCALATED_L3'
                ? 'Add technical debugging details, reproduction steps, and logs for L3 Engineering.'
                : toStatus === 'IN_DEVELOPMENT'
                ? 'Provide engineering context, issue summary, or Jira reference for Development Team.'
                : toStatus === 'IN_QA'
                ? 'Provide test cases, deployment URLs, or verification instructions for QA Testing Team.'
                : toStatus === 'PENDING_RELEASE'
                ? 'Specify release window, PR/build reference, or deployment prerequisites.'
                : toStatus === 'RELEASED'
                ? 'Add deployment version, release notes, or deployment verification details.'
                : toStatus === 'PENDING_VERIFICATION'
                ? 'Specify verification criteria and check-list for production verification.'
                : toStatus === 'AWAITING_CUSTOMER_CONFIRMATION'
                ? 'Summarize the proposed resolution for the customer to confirm.'
                : `Add a hand-off note or action rationale for moving to ${toMeta.label}.`}
            </p>
            <ActionNoteBox
              required={requiresComment}
              value={comment}
              onChange={setComment}
              placeholder={`Write transition note, bullet points, or next steps for ${toMeta.label}...`}
              minRows={4}
              autoFocus
              accentColor={toMeta.color || '#f59e0b'}
            />
          </div>

          {/* Optional Attachments Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Attachments <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              {uploadedFiles.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {uploadedFiles.length} {uploadedFiles.length === 1 ? 'file' : 'files'} attached
                </span>
              )}
            </div>

            {/* Click/Drag Attachment Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) handleFilesUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed var(--primary, #2563eb)' : '1px dashed var(--border-medium, #cbd5e1)',
                borderRadius: '8px',
                backgroundColor: isDragging ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-app, #f8fafc)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
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
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary, #2563eb)',
                  flexShrink: 0,
                }}
              >
                <Paperclip size={13} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--primary, #2563eb)' }}>Click to upload</strong> or drag & drop files
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                  (Images, PDFs, logs up to 25 MB)
                </span>
              </div>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '6px',
                  marginTop: '2px',
                }}
              >
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                      border: file.error
                        ? '1px solid #fca5a5'
                        : '1px solid var(--border-medium, #e2e8f0)',
                      fontSize: '11.5px',
                    }}
                  >
                    {/* Thumbnail / Icon */}
                    {file.previewUrl ? (
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
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
                          width: '26px',
                          height: '26px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary, #2563eb)',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={13} />
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: file.error ? '#dc2626' : 'var(--text-primary)',
                        }}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <span style={{ fontSize: '10px', color: file.error ? '#dc2626' : 'var(--text-muted)' }}>
                        {file.isUploading ? (
                          <span style={{ color: 'var(--primary, #2563eb)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Uploading...
                          </span>
                        ) : file.error ? (
                          file.error
                        ) : (
                          formatFileSize(file.sizeBytes)
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '3px',
                        display: 'flex',
                        borderRadius: '4px',
                      }}
                      title="Remove attachment"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Informative Banner */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: isCustomerFacing ? 'rgba(37, 99, 235, 0.05)' : '#f8fafc',
              borderRadius: '8px',
              border: isCustomerFacing ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: isCustomerFacing ? '#1e40af' : '#475569',
            }}
          >
            {isCustomerFacing ? (
              <Send size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
            ) : (
              <Lock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            )}
            <span>
              {isCustomerFacing
                ? 'This note and any attachments will be emailed directly to the customer and logged in the conversation timeline.'
                : 'This note and any attachments will be safely logged as an internal record in the ticket conversation timeline.'}
            </span>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '4px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleModalClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingAny || (requiresComment && !comment.trim())}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Updating...
                </>
              ) : isUploadingAny ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  Uploading attachments...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Confirm Status → {toMeta.label}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
