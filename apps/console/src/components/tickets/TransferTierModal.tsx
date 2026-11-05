import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X, Lock, Paperclip, FileText, Loader2 } from 'lucide-react';
import { TierBadge } from '../common/Badge';
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

interface TransferTierModalProps {
  isOpen: boolean;
  ticketNumber: string;
  fromTier: string;
  toTier: string;
  onClose: () => void;
  onConfirm: (reason: string, attachmentIds?: string[]) => Promise<void>;
}

export const TransferTierModal: React.FC<TransferTierModalProps> = ({
  isOpen,
  ticketNumber,
  fromTier,
  toTier,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!reason.trim() || isUploadingAny) return;

    setIsSubmitting(true);
    try {
      const readyAttachmentIds = uploadedFiles
        .filter((f) => !f.isUploading && !f.error && !f.id.startsWith('temp-'))
        .map((f) => f.id);

      await onConfirm(
        reason.trim(),
        readyAttachmentIds.length > 0 ? readyAttachmentIds : undefined,
      );

      uploadedFiles.forEach((f) => {
        if (f.previewUrl && f.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      setUploadedFiles([]);
      setReason('');
      onClose();
    } catch {
      // Error handled by parent
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
    setReason('');
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
              Transfer Support Tier — #{ticketNumber}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <TierBadge tier={fromTier} />
              <ArrowRight size={13} color="var(--text-muted, #94a3b8)" />
              <TierBadge tier={toTier} />
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
                color: 'var(--text-primary, #1e293b)',
                marginBottom: '6px',
              }}
            >
              Transfer Reason & Hand-off Note <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <ActionNoteBox
              autoFocus
              minRows={4}
              required
              value={reason}
              onChange={setReason}
              placeholder={`Explain why this ticket is being moved to tier ${toTier} (e.g. • Reproduction steps confirmed\n• Escalating for backend server logs)...`}
              accentColor="#3b82f6"
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

          {/* Privacy Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 12px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '8px',
              color: '#92400e',
              fontSize: '12px',
              lineHeight: '1.4',
            }}
          >
            <Lock size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#b45309' }} />
            <div>
              <strong>Internal Support Note:</strong> This hand-off note and any attachments will be safely recorded as a private internal team record in the conversation timeline and will <u>not</u> be sent to the customer.
            </div>
          </div>

          {/* Action Buttons */}
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
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingAny || !reason.trim()}
              className="btn btn-primary btn-sm"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Transferring...
                </>
              ) : isUploadingAny ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading attachments...
                </>
              ) : (
                `Move to ${toTier}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
