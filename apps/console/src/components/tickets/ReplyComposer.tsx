import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Lock,
  Globe,
  Paperclip,
  Users,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { TicketsApi } from '../../api/tickets';
import { useAuth } from '../../context/AuthContext';
import {
  SnippetTemplate,
  TicketSnippetContext,
  getAllSnippets,
  resolveSnippetPlaceholders,
} from './snippets';
import { SnippetModal } from './SnippetModal';

interface ReplyComposerProps {
  onSend: (
    body: string,
    isInternal: boolean,
    attachments?: string[],
    cc?: string[],
  ) => Promise<void>;
  isSending?: boolean;
  canWriteInternal?: boolean;
  ticket?: TicketSnippetContext;
  onClose?: () => void;
  initialIsInternal?: boolean;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  onSend,
  isSending = false,
  canWriteInternal = true,
  ticket,
  onClose,
  initialIsInternal = false,
}) => {
  const { user } = useAuth();
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 640) {
      return true;
    }
    return false;
  });
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(initialIsInternal);

  useEffect(() => {
    setIsInternal(initialIsInternal);
  }, [initialIsInternal]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Snippet dropdown & modal state
  const [isSnippetDropdownOpen, setIsSnippetDropdownOpen] = useState(false);
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [snippetModalCreateMode, setSnippetModalCreateMode] = useState(false);
  const snippetDropdownRef = useRef<HTMLDivElement>(null);

  // Quick list of available snippets
  const [quickSnippets, setQuickSnippets] = useState<SnippetTemplate[]>(() => getAllSnippets());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        snippetDropdownRef.current &&
        !snippetDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSnippetDropdownOpen(false);
      }
    };
    if (isSnippetDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSnippetDropdownOpen]);

  const handleOpenSnippetsDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMinimized) setIsMinimized(false);
    setQuickSnippets(getAllSnippets());
    setIsSnippetDropdownOpen((prev) => !prev);
  };

  const handleApplySnippet = (snippetText: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;

      // If user specifically highlighted text, replace just that highlighted selection
      if (start !== end && body) {
        const before = body.substring(0, start);
        const after = body.substring(end);
        const newBody = `${before}${snippetText}${after}`;
        setBody(newBody);
      } else {
        // When choosing templates one after another, replace the previous template cleanly
        setBody(snippetText);
      }

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(snippetText.length, snippetText.length);
      }, 50);
    } else {
      setBody(snippetText);
    }
    setIsSnippetDropdownOpen(false);
  };

  const handleQuickInsert = (snippet: SnippetTemplate) => {
    const resolved = resolveSnippetPlaceholders(snippet.body, ticket, user?.fullName);
    handleApplySnippet(resolved);
  };

  const handleAddCc = (emailToAdd: string) => {
    const trimmed = emailToAdd.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmed && emailRegex.test(trimmed) && !ccList.includes(trimmed)) {
      setCcList([...ccList, trimmed]);
      setCcInput('');
    }
  };

  const handleCcKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      if (ccInput.trim()) {
        handleAddCc(ccInput);
      }
    } else if (e.key === 'Backspace' && !ccInput && ccList.length > 0) {
      setCcList(ccList.slice(0, -1));
    }
  };

  const removeCc = (emailToRemove: string) => {
    setCcList(ccList.filter((email) => email !== emailToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || isSending || isUploading) return;

    // Flush any pending text in ccInput
    const finalCcList = [...ccList];
    const pendingCc = ccInput.trim().toLowerCase().replace(/,/g, '');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (pendingCc && emailRegex.test(pendingCc) && !finalCcList.includes(pendingCc)) {
      finalCcList.push(pendingCc);
    }

    await onSend(
      body,
      isInternal && canWriteInternal,
      uploadedFiles.map((f) => f.id),
      !isInternal && finalCcList.length > 0 ? finalCcList : undefined,
    );
    setBody('');
    setUploadedFiles([]);
    setCcList([]);
    setCcInput('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newFiles = [...uploadedFiles];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const result = await TicketsApi.uploadFile(file);
        newFiles.push({ id: result.id, name: result.originalFilename });
      }
      setUploadedFiles(newFiles);
    } catch (err: any) {
      alert(`Failed to upload file: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <>
      <form onSubmit={handleSubmit} className={`reply-composer-card ${isMinimized ? 'is-minimized' : ''}`}>
        <div
          className="composer-toolbar"
          style={{ cursor: isMinimized ? 'pointer' : 'default', userSelect: 'none' }}
          onClick={() => {
            if (isMinimized) setIsMinimized(false);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canWriteInternal ? (
              <div className="composer-mode-tabs">
                <button
                  type="button"
                  className={`composer-tab ${!isInternal ? 'active public' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsInternal(false);
                    if (isMinimized) setIsMinimized(false);
                  }}
                >
                  <Globe size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Public Reply
                </button>
                <button
                  type="button"
                  className={`composer-tab ${isInternal ? 'active internal' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsInternal(true);
                    if (isMinimized) setIsMinimized(false);
                  }}
                >
                  <Lock size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Internal Note
                </button>
              </div>
            ) : (
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Globe size={13} /> Public Reply
              </div>
            )}

            {/* Zoho Desk Style Snippet Template Button & Dropdown */}
            <div ref={snippetDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={handleOpenSnippetsDropdown}
                title="Insert Snippet Template (Zoho Desk style)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: isSnippetDropdownOpen
                    ? '1px solid var(--primary, #2563eb)'
                    : '1px solid var(--border-medium, #cbd5e1)',
                  backgroundColor: isSnippetDropdownOpen
                    ? 'var(--primary-surface, rgba(37, 99, 235, 0.12))'
                    : 'var(--bg-surface, #ffffff)',
                  color: isSnippetDropdownOpen
                    ? 'var(--primary, #2563eb)'
                    : 'var(--text-primary, #334155)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: 'var(--primary, #2563eb)' }}
                  >
                    <path d="m12 19 7-7 3 3-7 7-3-3z" />
                    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="m2 2 7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                  <Sparkles
                    size={9}
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      color: '#f59e0b',
                    }}
                  />
                </div>
                <span>Snippet</span>
                <ChevronDown size={12} style={{ opacity: 0.7 }} />
              </button>

              {/* Zoho Desk Style Popover Dropdown */}
              {isSnippetDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: '300px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0,0,0,0.06)',
                    zIndex: 9999,
                    padding: '6px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.12s ease-out',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Top Action: View All Snippets */}
                  <div
                    onClick={() => {
                      setIsSnippetDropdownOpen(false);
                      setSnippetModalCreateMode(false);
                      setIsSnippetModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--text-primary, #0f172a)',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated, #f1f5f9)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={14} style={{ color: 'var(--primary, #2563eb)' }} />
                      <span>View All Snippets</span>
                    </div>
                    <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                  </div>

                  {/* Top Action: Add New Snippet */}
                  <div
                    onClick={() => {
                      setIsSnippetDropdownOpen(false);
                      setSnippetModalCreateMode(true);
                      setIsSnippetModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      color: 'var(--primary, #2563eb)',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Plus size={14} />
                    <span>Add New Snippet</span>
                  </div>

                  {/* Section Label */}
                  <div
                    style={{
                      padding: '8px 14px 4px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted, #94a3b8)',
                    }}
                  >
                    Available Templates
                  </div>

                  {/* Quick Snippets List with smooth scrolling */}
                  <div
                    style={{
                      maxHeight: '240px',
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {quickSnippets.map((snippet) => (
                      <div
                        key={snippet.id}
                        onClick={() => handleQuickInsert(snippet)}
                        style={{
                          padding: '7px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          transition: 'background-color 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated, #f1f5f9)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span
                          title={snippet.name}
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '185px',
                            fontWeight: 500,
                          }}
                        >
                          {snippet.name}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: snippet.isDefault ? 'rgba(100, 116, 139, 0.1)' : 'rgba(16, 185, 129, 0.12)',
                            color: snippet.isDefault ? '#64748b' : '#059669',
                            flexShrink: 0,
                          }}
                        >
                          {snippet.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isMinimized && body.trim().length > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-surface, rgba(37,99,235,0.1))',
                  padding: '1px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--primary-border, rgba(37,99,235,0.2))',
                }}
              >
                Draft saved
              </span>
            )}
          </div>

          <div className="composer-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="composer-notice-text" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {isInternal && canWriteInternal
                ? '🔒 Visible to staff only'
                : ccList.length > 0
                  ? `🌐 Customer + ${ccList.length} CC recipient${ccList.length > 1 ? 's' : ''} will be notified`
                  : '🌐 Customer will be notified'}
            </div>

            {onClose ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="composer-collapse-btn"
                title="Close reply composer (Return to full conversation)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                className="composer-collapse-btn"
                title={isMinimized ? 'Expand reply box' : 'Minimize reply box'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>
        </div>

        <div className={`composer-body-collapsible ${isMinimized ? 'is-collapsed' : 'is-expanded'}`}>
          <div className="composer-body-collapsible-inner">
            {/* Integrated CC Bar for Public Replies */}
            {!isInternal && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '6px 16px',
                  backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  fontSize: '12px',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-muted, #64748b)', fontSize: '11px', userSelect: 'none' }}>
                  CC:
                </span>

                {ccList.map((email) => (
                  <span
                    key={email}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--primary, #2563eb)',
                      border: '1px solid rgba(37, 99, 235, 0.2)',
                      borderRadius: '12px',
                      padding: '1px 8px',
                      fontSize: '11.5px',
                      fontWeight: 500,
                    }}
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => removeCc(email)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--primary, #2563eb)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}

                <input
                  type="email"
                  placeholder={ccList.length === 0 ? 'Add CC email (press Enter or comma)...' : 'Add another CC...'}
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={handleCcKeyDown}
                  onBlur={() => {
                    if (ccInput.trim()) handleAddCc(ccInput);
                  }}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    padding: '2px 4px',
                  }}
                />
              </div>
            )}

            {uploadedFiles.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '8px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                }}
              >
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                      fontSize: '12px',
                    }}
                  >
                    <span>📎 {file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontWeight: 700,
                        fontSize: '14px',
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              className="composer-textarea"
              placeholder={
                isInternal && canWriteInternal
                  ? 'Write an internal note for teammates...'
                  : 'Type your reply to the customer...'
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
            />

            {body.trim().length === 0 && (
              <div
                style={{
                  padding: '4px 16px 8px',
                  fontSize: '11px',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'var(--bg-surface-elevated, #fff)',
                }}
              >
                <span>⚠️ Message text is required to submit a reply or note.</span>
              </div>
            )}

            <div className="composer-footer">
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Paperclip size={14} />
                  <span>{isUploading ? 'Uploading...' : 'Attach File'}</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  style={{ display: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSending || isUploading || !body.trim()}
                className={`btn ${isInternal && canWriteInternal ? 'btn-secondary' : 'btn-primary'}`}
                style={{
                  ...(isInternal && canWriteInternal
                    ? { backgroundColor: '#f59e0b', color: '#000000', fontWeight: 600 }
                    : {}),
                  ...(isSending || isUploading || !body.trim()
                    ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
                    : { cursor: 'pointer' }),
                }}
              >
                <Send size={14} />
                <span>
                  {isSending
                    ? 'Sending...'
                    : isInternal && canWriteInternal
                      ? 'Save Internal Note'
                      : 'Send Public Reply'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Snippet Manager Modal */}
      <SnippetModal
        isOpen={isSnippetModalOpen}
        onClose={() => setIsSnippetModalOpen(false)}
        onSelectSnippet={handleApplySnippet}
        ticket={ticket}
        currentUserName={user?.fullName}
        initialCreateMode={snippetModalCreateMode}
      />
    </>
  );
};
