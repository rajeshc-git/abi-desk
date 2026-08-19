import React, { useEffect, useState } from 'react';
import {
  Video,
  Image,
  Mic,
  Download,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Eye,
  X,
  ExternalLink,
} from 'lucide-react';
import { ApiClient } from '../../api/client';

export interface MediaAssetItem {
  id: string;
  kind: 'SCREENSHOT' | 'SCREEN_RECORDING' | 'VOICE_RECORDING' | 'ATTACHMENT';
  filename?: string | null;
  originalFilename?: string | null;
  mimeType: string;
  sizeBytes: number;
  downloadUrl?: string;
}

interface MediaPlayerProps {
  media: MediaAssetItem[];
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ media = [] }) => {
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
  const [activePreview, setActivePreview] = useState<{
    item: MediaAssetItem;
    url: string;
    filename: string;
    mime: string;
  } | null>(null);

  const handleDownload = async (mediaId: string, filename: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${mediaId}/download`, {
        disposition: 'attachment',
      });
      const a = document.createElement('a');
      a.href = res.url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  useEffect(() => {
    let disposed = false;

    const loadDownloadUrls = async () => {
      const entries = await Promise.all(
        media.map(async (item) => {
          if (item.downloadUrl) return [item.id, item.downloadUrl] as const;
          try {
            const download = await ApiClient.post<{ url: string }>(`/media/${item.id}/download`, {
              disposition: 'inline',
            });
            return [item.id, download.url] as const;
          } catch {
            return [item.id, ''] as const;
          }
        }),
      );

      if (!disposed) setDownloadUrls(Object.fromEntries(entries));
    };

    if (media.length > 0) {
      loadDownloadUrls().catch(() => {
        if (!disposed) setDownloadUrls({});
      });
    } else {
      setDownloadUrls({});
    }

    return () => {
      disposed = true;
    };
  }, [media]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (media.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No media assets or files attached to this ticket.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {media.map((item) => {
          const filename = item.originalFilename || item.filename || 'Attachment';
          const downloadUrl = item.downloadUrl || downloadUrls[item.id];
          const lowerName = filename.toLowerCase();
          const mime = item.mimeType.toLowerCase();

          const isVideo =
            item.kind === 'SCREEN_RECORDING' ||
            mime.startsWith('video/') ||
            lowerName.endsWith('.mp4') ||
            lowerName.endsWith('.webm');
          const isImage =
            item.kind === 'SCREENSHOT' ||
            mime.startsWith('image/') ||
            /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lowerName);
          const isAudio =
            item.kind === 'VOICE_RECORDING' ||
            mime.startsWith('audio/') ||
            lowerName.endsWith('.mp3') ||
            lowerName.endsWith('.wav');
          const isPdf = mime.includes('pdf') || lowerName.endsWith('.pdf');
          const isSheet = mime.includes('sheet') || mime.includes('csv') || /\.(csv|xlsx?)$/i.test(lowerName);
          const isArchive = mime.includes('zip') || mime.includes('tar') || /\.(zip|rar|7z|tar|gz)$/i.test(lowerName);
          const isCode =
            mime.includes('json') ||
            mime.includes('javascript') ||
            /\.(json|js|ts|html|css|xml|yaml|yml)$/i.test(lowerName);

          const fileSizeKb = Math.max(1, Math.round(item.sizeBytes / 1024));

          const handleOpenPreview = () => {
            if (downloadUrl) {
              setActivePreview({ item, url: downloadUrl, filename, mime });
            }
          };

          return (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md, 8px)',
                backgroundColor: 'var(--bg-surface)',
              }}
            >
              {/* Header info */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                  }}
                >
                  {isImage && <Image size={16} color="#10b981" style={{ flexShrink: 0 }} />}
                  {isVideo && <Video size={16} color="var(--primary)" style={{ flexShrink: 0 }} />}
                  {isAudio && <Mic size={16} color="#f59e0b" style={{ flexShrink: 0 }} />}
                  {isPdf && <FileText size={16} color="#ef4444" style={{ flexShrink: 0 }} />}
                  {isSheet && <FileSpreadsheet size={16} color="#059669" style={{ flexShrink: 0 }} />}
                  {isArchive && <FileArchive size={16} color="#8b5cf6" style={{ flexShrink: 0 }} />}
                  {isCode && <FileCode size={16} color="#0284c7" style={{ flexShrink: 0 }} />}
                  {!isImage && !isVideo && !isAudio && !isPdf && !isSheet && !isArchive && !isCode && (
                    <File size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={filename}>
                    {filename}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {fileSizeKb > 1024 ? `${(fileSizeKb / 1024).toFixed(1)} MB` : `${fileSizeKb} KB`}
                </span>
              </div>

              {/* Media / Document Preview Canvas */}
              <div
                onClick={downloadUrl ? handleOpenPreview : undefined}
                style={{
                  borderRadius: '6px',
                  overflow: 'hidden',
                  backgroundColor: isImage || isVideo || isAudio ? '#0f172a' : 'var(--bg-surface-elevated, #f8fafc)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '140px',
                  position: 'relative',
                  cursor: downloadUrl ? 'pointer' : 'default',
                }}
              >
                {isImage && downloadUrl && (
                  <img
                    src={downloadUrl}
                    alt={filename}
                    style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain' }}
                  />
                )}

                {isVideo && downloadUrl && (
                  <video src={downloadUrl} style={{ width: '100%', maxHeight: '220px' }} />
                )}

                {isAudio && downloadUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                    <Mic size={32} />
                    <span style={{ fontSize: '12px', color: '#ffffff' }}>Audio Recording</span>
                  </div>
                )}

                {isPdf && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                      <FileText size={24} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>PDF Document</span>
                  </div>
                )}

                {isSheet && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                      <FileSpreadsheet size={24} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Spreadsheet / CSV</span>
                  </div>
                )}

                {isArchive && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                      <FileArchive size={24} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Compressed Archive</span>
                  </div>
                )}

                {!isImage && !isVideo && !isAudio && !isPdf && !isSheet && !isArchive && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <File size={24} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.mimeType || 'Document'}</span>
                  </div>
                )}

                {!downloadUrl && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Preparing asset…</span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                {downloadUrl && (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 10px' }}
                      title="Fullscreen Preview"
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDownload(item.id, filename, e)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 10px' }}
                      title="Download file"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Light Theme Fullscreen In-App Media Lightbox Preview Modal */}
      {activePreview && (
        <div
          onClick={() => setActivePreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Modal Container (Crisp White Card) */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: activePreview.mime.includes('pdf') ? '1050px' : '90vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Top Bar (Light Theme) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                color: 'var(--text-primary, #0f172a)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {activePreview.filename}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                  }}
                >
                  {Math.max(1, Math.round(activePreview.item.sizeBytes / 1024))} KB
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={activePreview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '6px 12px' }}
                  title="Open in new browser tab"
                >
                  <ExternalLink size={13} />
                  <span>Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={(e) => handleDownload(activePreview.item.id, activePreview.filename, e)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
                  title="Download file"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePreview(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0f172a';
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Close preview (Esc)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body Canvas (Light Theme) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                overflow: 'auto',
                minHeight: '300px',
                maxHeight: 'calc(92vh - 65px)',
                backgroundColor: '#f1f5f9',
              }}
            >
              {/* Image Preview */}
              {(activePreview.mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(activePreview.filename)) && (
                <img
                  src={activePreview.url}
                  alt={activePreview.filename}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 120px)',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    backgroundColor: '#ffffff',
                  }}
                />
              )}

              {/* PDF Preview with Built-in Fallback */}
              {(activePreview.mime.includes('pdf') || activePreview.filename.toLowerCase().endsWith('.pdf')) && (
                <object
                  data={`${activePreview.url}#toolbar=1`}
                  type="application/pdf"
                  style={{
                    width: '100%',
                    height: '80vh',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {/* Beautiful Empty State Fallback if browser blocks inline iframe/object */}
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 24px',
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px',
                      }}
                    >
                      <FileText size={32} color="#ef4444" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      {activePreview.filename}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', marginBottom: '20px', lineHeight: 1.5 }}>
                      Your browser's built-in PDF viewer is ready. Click below to view the full document in a clean tab or download it directly.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <a
                        href={activePreview.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px' }}
                      >
                        <ExternalLink size={14} />
                        <span>Open in New Tab</span>
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleDownload(activePreview.item.id, activePreview.filename, e)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px' }}
                      >
                        <Download size={14} />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                </object>
              )}

              {/* Video Preview */}
              {(activePreview.mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(activePreview.filename)) && (
                <video
                  controls
                  autoPlay
                  src={activePreview.url}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'calc(90vh - 120px)',
                    borderRadius: '8px',
                    backgroundColor: '#000000',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  }}
                />
              )}

              {/* Audio Preview */}
              {(activePreview.mime.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(activePreview.filename)) && (
                <div style={{ padding: '36px 40px', width: '100%', maxWidth: '500px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)' }}>
                  <Mic size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
                  <h4 style={{ color: '#0f172a', marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>{activePreview.filename}</h4>
                  <audio controls autoPlay src={activePreview.url} style={{ width: '100%' }} />
                </div>
              )}

              {/* Generic Document / Other fallback */}
              {!activePreview.mime.startsWith('image/') &&
                !/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(activePreview.filename) &&
                !activePreview.mime.includes('pdf') &&
                !activePreview.filename.toLowerCase().endsWith('.pdf') &&
                !activePreview.mime.startsWith('video/') &&
                !/\.(mp4|webm|mov)$/i.test(activePreview.filename) &&
                !activePreview.mime.startsWith('audio/') &&
                !/\.(mp3|wav|ogg)$/i.test(activePreview.filename) && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)' }}>
                    <File size={56} style={{ margin: '0 auto 16px', color: '#64748b' }} />
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{activePreview.filename}</h3>
                    <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>
                      This file format can be downloaded and opened with your system viewer.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => handleDownload(activePreview.item.id, activePreview.filename, e)}
                      className="btn btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px' }}
                    >
                      <Download size={15} />
                      <span>Download File ({Math.max(1, Math.round(activePreview.item.sizeBytes / 1024))} KB)</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
