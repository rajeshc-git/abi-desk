import React from 'react';
import { Lock, Globe, FileText, CheckCircle, ArrowUpRight } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { FormattedEmailContent } from '../common/FormattedEmailContent';

export interface CommentItem {
  id: string;
  body: string;
  isInternal: boolean;
  author?: { fullName: string; email: string; kind?: string };
  createdAt: string;
  attachments?: Array<{ id: string; originalFilename: string; mimeType: string }>;
}

export interface ActivityItem {
  id: string;
  action: string;
  actor?: { fullName: string };
  details?: Record<string, any>;
  createdAt: string;
}

interface TimelineViewProps {
  comments: CommentItem[];
  activities?: ActivityItem[];
}

const urlCache = new Map<string, { url: string; expiresAt: number }>();

const AttachmentItem: React.FC<{
  att: { id: string; originalFilename: string; mimeType: string };
}> = ({ att }) => {
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const isImage = att.mimeType.startsWith('image/');
  const isVideo = att.mimeType.startsWith('video/');
  const isAudio = att.mimeType.startsWith('audio/');

  // Lazy load using IntersectionObserver
  React.useEffect(() => {
    if (!isImage && !isVideo && !isAudio) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.01 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isImage, isVideo, isAudio]);

  const loadMediaUrl = React.useCallback(async () => {
    const cached = urlCache.get(att.id);
    if (cached && cached.expiresAt > Date.now()) {
      setDownloadUrl(cached.url);
      setError(false);
      return cached.url;
    }

    setLoading(true);
    setError(false);
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${att.id}/download`);
      urlCache.set(att.id, {
        url: res.url,
        expiresAt: Date.now() + 9 * 60 * 1000,
      });
      setDownloadUrl(res.url);
      return res.url;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [att.id]);

  // Fetch URL only when it scrolls into view
  React.useEffect(() => {
    if (inView && (isImage || isVideo || isAudio)) {
      loadMediaUrl();
    }
  }, [inView, isImage, isVideo, isAudio, loadMediaUrl]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = await loadMediaUrl();
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Failed to get download link');
    }
  };

  if (!isImage && !isVideo && !isAudio) {
    return (
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm, 4px)',
          backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
          border: '1px solid var(--border-medium, #e2e8f0)',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
      >
        <FileText size={14} style={{ color: 'var(--primary)' }} />
        <span style={{ textDecoration: 'underline' }}>{att.originalFilename}</span>
        {loading && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(loading...)</span>
        )}
      </button>
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'inline-block' }}>
      {loading && (
        <div
          style={{
            width: isImage ? '180px' : '220px',
            height: isAudio ? '54px' : '100px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-surface-elevated, #f1f5f9)',
            border: '1px solid var(--border-medium, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '11px',
          }}
        >
          <span>Loading preview...</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #fee2e2',
            backgroundColor: '#fef2f2',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#b91c1c' }}>Failed to load preview</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDownload}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '11px',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Download
            </button>
            <button
              onClick={loadMediaUrl}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '11px',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && downloadUrl && (
        <>
          {isImage && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '180px' }}
            >
              <img
                src={downloadUrl}
                alt={att.originalFilename}
                onClick={() => setLightboxOpen(true)}
                style={{
                  maxWidth: '100%',
                  maxHeight: '120px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  cursor: 'pointer',
                  objectFit: 'cover',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                🖼️ {att.originalFilename}
              </span>
            </div>
          )}

          {isVideo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '220px' }}>
              <video
                src={downloadUrl}
                controls
                style={{
                  width: '100%',
                  maxHeight: '140px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  background: '#000',
                }}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                📹 {att.originalFilename}
              </span>
            </div>
          )}

          {isAudio && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '220px' }}>
              <audio
                src={downloadUrl}
                controls
                style={{
                  width: '100%',
                }}
              />
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                🎙️ {att.originalFilename}
              </span>
            </div>
          )}

          {/* Lightbox Modal */}
          {lightboxOpen && (
            <div
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.85)',
                zIndex: 100000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                backdropFilter: 'blur(4px)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <a
                  href={downloadUrl}
                  download={att.originalFilename}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Download
                </a>
                <button
                  onClick={() => setLightboxOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    color: '#fff',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '20px',
                    fontWeight: 600,
                  }}
                >
                  &times;
                </button>
              </div>
              <img
                src={downloadUrl}
                alt={att.originalFilename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              />
              <div style={{ marginTop: '12px', color: '#fff', fontSize: '13px' }}>
                {att.originalFilename}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const TimelineView: React.FC<TimelineViewProps> = ({ comments }) => {
  return (
    <div className="timeline-list">
      {comments.map((comment) => {
        const isInternal = comment.isInternal;
        const authorName = comment.author?.fullName || 'Support User';
        const formattedDate = new Date(comment.createdAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const isTranscript =
          comment.body.includes('### Chat Transcript') ||
          comment.body.includes('Chat Transcript (');

        const renderTranscript = () => {
          const codeBlockMatch = comment.body.match(/```([\s\S]*?)```/);
          const rawLines =
            codeBlockMatch && codeBlockMatch[1] ? codeBlockMatch[1].trim().split('\n') : [];

          const messages: Array<{ time: string; author: string; text: string; isSystem: boolean }> =
            [];
          for (const line of rawLines) {
            const match = line.match(/^\[([^\]]+)\]\s*(.+?):\s*(.*)$/);
            if (match && match[1] && match[2]) {
              const isSystem = match[2].trim() === 'System';
              messages.push({
                time: match[1],
                author: match[2].trim(),
                text: (match[3] || '').trim(),
                isSystem,
              });
            }
          }

          if (messages.length === 0) {
            return <div style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</div>;
          }

          const customerName = messages.find((m) => !m.isSystem)?.author || '';

          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                marginTop: '8px',
              }}
            >
              {messages.map((msg, index) => {
                if (msg.isSystem) {
                  return (
                    <div
                      key={index}
                      style={{
                        textAlign: 'center',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        margin: '4px 0',
                        fontStyle: 'italic',
                      }}
                    >
                      {msg.text}
                    </div>
                  );
                }

                const isCustomer = msg.author === customerName;
                const initials = msg.author.slice(0, 2).toUpperCase();
                const formattedTime = new Date(msg.time).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isCustomer ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-end',
                        flexDirection: isCustomer ? 'row-reverse' : 'row',
                      }}
                    >
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: isCustomer
                            ? 'var(--primary, #2563eb)'
                            : 'var(--bg-surface, #e2e8f0)',
                          border: isCustomer ? 'none' : '1px solid var(--border-medium)',
                          color: isCustomer ? '#ffffff' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          fontWeight: 700,
                        }}
                      >
                        {initials}
                      </div>
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: isCustomer ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                          backgroundColor: isCustomer
                            ? 'var(--primary, #2563eb)'
                            : 'var(--bg-surface, #ffffff)',
                          border: isCustomer ? 'none' : '1px solid var(--border-subtle, #e2e8f0)',
                          color: isCustomer ? '#ffffff' : 'var(--text-primary)',
                          fontSize: '13px',
                          maxWidth: '280px',
                          textAlign: 'left',
                          lineHeight: 1.4,
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        marginRight: isCustomer ? '32px' : '0',
                        marginLeft: isCustomer ? '0' : '32px',
                        marginTop: '2px',
                      }}
                    >
                      {msg.author} · {formattedTime}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        };

        return (
          <div key={comment.id} className="timeline-item">
            <div
              className="user-avatar"
              style={{ width: '32px', height: '32px', fontSize: '11px' }}
            >
              {authorName.slice(0, 2).toUpperCase()}
            </div>

            <div className={`timeline-card ${isInternal ? 'internal-note' : ''}`}>
              {isInternal && (
                <div className="internal-badge">
                  <Lock size={12} />
                  <span>PRIVATE INTERNAL NOTE (VISIBLE TO STAFF ONLY)</span>
                </div>
              )}

              <div className="timeline-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="author-name">{authorName}</span>
                  {!isInternal && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Globe size={11} /> Public Reply
                    </span>
                  )}
                </div>
                <span className="timestamp">{formattedDate}</span>
              </div>

              <div className="timeline-body">
                {isTranscript ? renderTranscript() : <FormattedEmailContent text={comment.body} />}
              </div>

              {comment.attachments && comment.attachments.length > 0 && (
                <div
                  style={{
                    marginTop: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'flex-start',
                  }}
                >
                  {comment.attachments.map((att) => (
                    <AttachmentItem key={att.id} att={att} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
