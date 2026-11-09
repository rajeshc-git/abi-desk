import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Megaphone,
  CheckCircle2,
  RotateCw,
  Sparkles,
  Download,
  FileText,
  FileSpreadsheet,
  File,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { ApiClient } from '../../api/client';

export interface BroadcastAttachment {
  id: string;
  name: string;
  sizeBytes?: number;
  mimeType?: string;
  previewUrl?: string;
  url?: string;
}

export interface BroadcastData {
  id?: string;
  title?: string;
  message?: string;
  adminName: string;
  targetAgentIds?: string[];
  broadcastAt?: string;
  attachments?: BroadcastAttachment[];
}

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BroadcastData | null;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileType = (name: string, mime?: string) => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (m.includes('pdf') || ext === 'pdf') {
    return 'pdf';
  }
  if (m.includes('csv') || m.includes('spreadsheet') || m.includes('excel') || ['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) {
    return 'csv';
  }
  return 'file';
};

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  // Fetch inline viewable URLs for images attached to this broadcast
  useEffect(() => {
    if (!isOpen || !data?.attachments || data.attachments.length === 0) return;

    data.attachments.forEach(async (att) => {
      const type = getFileType(att.name, att.mimeType);
      if (type === 'image' && !att.previewUrl && !imageUrls[att.id]) {
        try {
          const res = await ApiClient.post<{ url: string }>(`/media/${att.id}/download`, {
            disposition: 'inline',
          });
          if (res?.url) {
            setImageUrls((prev) => ({ ...prev, [att.id]: res.url }));
          } else {
            setImageErrors((prev) => ({ ...prev, [att.id]: true }));
          }
        } catch (e) {
          console.error('Failed to load image preview:', e);
          setImageErrors((prev) => ({ ...prev, [att.id]: true }));
        }
      }
    });
  }, [isOpen, data?.attachments]);

  if (!isOpen || !data) return null;

  const handleDownloadAttachment = async (att: BroadcastAttachment, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDownloadingIds((prev) => new Set(prev).add(att.id));
    try {
      let downloadUrl = att.url;
      if (!downloadUrl) {
        const res = await ApiClient.post<{ url: string }>(`/media/${att.id}/download`, {
          disposition: 'attachment',
        });
        downloadUrl = res?.url;
      }
      if (downloadUrl) {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = att.name;
        a.target = '_blank';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(att.id);
        return next;
      });
    }
  };

  const formattedTime = data.broadcastAt
    ? new Date(data.broadcastAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Just now';

  const msgText = (data.message || '').trim();
  const isRefreshRecommendation =
    msgText.toLowerCase().includes('refresh') ||
    msgText.toLowerCase().includes('reload') ||
    msgText.toLowerCase().includes('update');

  const handleHardRefresh = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys().catch(() => []);
        await Promise.all(keys.map((k) => caches.delete(k))).catch(() => {});
      }
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  };

  const attachments = data.attachments || [];

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Festive Header Banner with Brand Theme Colors */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-hover, #1d4ed8) 100%)',
            padding: '24px 24px 18px',
            textAlign: 'center',
            position: 'relative',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 10px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#713f12',
              boxShadow: '0 6px 16px rgba(234, 179, 8, 0.4)',
            }}
          >
            <Megaphone size={28} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(4px)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            <Sparkles size={12} /> Team Announcement
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            {data.title || 'Notice from Administrator'}
          </h2>
          <div style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '3px' }}>
            Broadcast by {data.adminName} • {formattedTime}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {/* Main Broadcast Message (if text was provided) */}
          {msgText && (
            <div
              style={{
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: 'var(--text-primary, #0f172a)',
                backgroundColor: 'var(--bg-app, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '16px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msgText}
            </div>
          )}

          {/* Attachments Section */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 750,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted, #64748b)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                Attached {attachments.length === 1 ? 'File' : `Files (${attachments.length})`}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attachments.map((att) => {
                  const fileType = getFileType(att.name, att.mimeType);
                  const isDownloading = downloadingIds.has(att.id);
                  const imgSrc = imageUrls[att.id] || att.previewUrl || att.url;

                  if (fileType === 'image') {
                    return (
                      <div
                        key={att.id}
                        style={{
                          borderRadius: '10px',
                          border: '1px solid var(--border-medium, #cbd5e1)',
                          backgroundColor: 'var(--bg-app, #f8fafc)',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                      >
                        {/* Image Preview Container */}
                        <div
                          style={{
                            width: '100%',
                            maxHeight: '220px',
                            minHeight: '120px',
                            backgroundColor: '#0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={att.name}
                              onError={() => setImageErrors((prev) => ({ ...prev, [att.id]: true }))}
                              style={{
                                width: '100%',
                                maxHeight: '220px',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          ) : imageErrors[att.id] ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '12px' }}>
                              <span>Preview unavailable</span>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Click Download below to open</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px' }}>
                              <Loader2 size={18} className="animate-spin" /> Loading image preview...
                            </div>
                          )}
                        </div>

                        {/* Image File Meta Bar */}
                        <div
                          style={{
                            padding: '10px 14px',
                            backgroundColor: 'var(--bg-surface, #ffffff)',
                            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={att.name}
                            >
                              {att.name}
                            </div>
                            {att.sizeBytes ? (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {formatFileSize(att.sizeBytes)}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {imgSrc && (
                              <a
                                href={imgSrc}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: 650,
                                  backgroundColor: 'var(--bg-app, #f1f5f9)',
                                  color: 'var(--text-secondary, #475569)',
                                  border: '1px solid var(--border-medium, #cbd5e1)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                <ExternalLink size={12} /> View
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDownloadAttachment(att, e)}
                              disabled={isDownloading}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                backgroundColor: 'var(--primary, #2563eb)',
                                color: '#ffffff',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: isDownloading ? 'wait' : 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {isDownloading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                              Download
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // PDF, CSV/Spreadsheet, or Other Document
                  const isPdf = fileType === 'pdf';
                  const isCsv = fileType === 'csv';

                  const badgeBg = isPdf ? '#fee2e2' : isCsv ? '#dcfce7' : '#e0e7ff';
                  const badgeColor = isPdf ? '#b91c1c' : isCsv ? '#15803d' : '#3730a3';
                  const typeLabel = isPdf ? 'PDF Document' : isCsv ? 'CSV / Spreadsheet' : 'Attachment';

                  return (
                    <div
                      key={att.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        gap: '12px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isPdf ? (
                            <FileText size={20} />
                          ) : isCsv ? (
                            <FileSpreadsheet size={20} />
                          ) : (
                            <File size={20} />
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={att.name}
                          >
                            {att.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {typeLabel} {att.sizeBytes ? `• ${formatFileSize(att.sizeBytes)}` : ''}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDownloadAttachment(att, e)}
                        disabled={isDownloading}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: 'var(--primary, #2563eb)',
                          color: '#ffffff',
                          border: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: isDownloading ? 'wait' : 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        Download {isPdf ? 'PDF' : isCsv ? 'CSV' : 'File'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexShrink: 0 }}>
            {isRefreshRecommendation && (
              <button
                type="button"
                onClick={handleHardRefresh}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <RotateCw size={14} /> Refresh Browser Now
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle2 size={15} /> Acknowledge & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
