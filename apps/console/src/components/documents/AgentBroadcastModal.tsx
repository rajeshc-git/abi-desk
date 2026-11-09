import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Search,
  Users,
  CheckCircle2,
  Megaphone,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  RotateCw,
  Eye,
  FileText,
  FileSpreadsheet,
  File,
  Check,
  Paperclip,
  Upload,
  Loader2,
  Download,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TicketsApi } from '../../api/tickets';

interface AgentItem {
  agentId: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  roles?: string[];
  avatarUrl?: string;
  isOnline?: boolean;
}

interface AgentBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentItem[];
}

interface TemplatePreset {
  id: string;
  badge: string;
  icon: string;
  title: string;
  text: string;
  description: string;
}

interface UploadedAttachment {
  id: string;
  name: string;
  sizeBytes?: number;
  mimeType?: string;
  previewUrl?: string;
  isUploading?: boolean;
  error?: string;
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

const BROADCAST_TEMPLATES: TemplatePreset[] = [
  {
    id: 'refresh',
    badge: 'Update Deployment',
    icon: '🔄',
    title: '📢 Please Refresh Your Browser',
    description: 'Instructs team to reload and receive latest bundle updates.',
    text: 'Dear team, new updates and fixes have been deployed. Please refresh your browser (Cmd+R / Ctrl+F5) to ensure you have the latest version active.',
  },
  {
    id: 'shift',
    badge: 'Operations',
    icon: '📋',
    title: '📋 Shift Handover Reminder',
    description: 'Prompts agents to update ticket statuses and tags.',
    text: 'Reminder: Please ensure all in-progress tickets are updated with status notes and relevant tags before concluding your shift.',
  },
  {
    id: 'maintenance',
    badge: 'System Notice',
    icon: '⚠️',
    title: '⚠️ Scheduled System Maintenance',
    description: 'Alerts team about brief infrastructure or network work.',
    text: 'Notice: Brief scheduled maintenance will take place shortly. If you experience minor reconnection blips, please wait a minute.',
  },
  {
    id: 'surge',
    badge: 'Queue Alert',
    icon: '🚀',
    title: '🚀 Inbound Queue Surge',
    description: 'Urges team to prioritize urgent customer tickets.',
    text: 'High ticket volume currently inbound. Please focus on urgent customer queues and escalate blocking tickets promptly.',
  },
];

type WizardStep = 'recipients' | 'compose' | 'preview';

export const AgentBroadcastModal: React.FC<AgentBroadcastModalProps> = ({
  isOpen,
  onClose,
  agents,
}) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState<WizardStep>('recipients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'online' | 'selected' | 'unselected'>('all');
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(
    () => new Set(agents.map((a) => a.agentId)),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('refresh');
  const [title, setTitle] = useState(BROADCAST_TEMPLATES[0].title);
  const [message, setMessage] = useState(BROADCAST_TEMPLATES[0].text);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize selection and reset state whenever modal opens or agent list updates
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep('recipients');
    setSearchQuery('');
    setFilterType('all');
    setSelectedAgentIds(new Set(agents.map((a) => a.agentId)));
    setAttachments([]);
    setIsDragOver(false);
    setIsSending(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, agents, onClose]);

  // Upload handler for attaching files
  const uploadSingleFile = async (file: File) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isImg = file.type.startsWith('image/');
    const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

    setAttachments((prev) => [
      ...prev,
      {
        id: tempId,
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        previewUrl,
        isUploading: true,
      },
    ]);

    try {
      const result = await TicketsApi.uploadFile(file);
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === tempId
            ? {
                ...a,
                id: result.id,
                name: result.originalFilename || file.name,
                isUploading: false,
              }
            : a,
        ),
      );
    } catch (err: any) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === tempId
            ? {
                ...a,
                isUploading: false,
                error: err?.message || 'Upload failed',
              }
            : a,
        ),
      );
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const handleFilesUpload = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => uploadSingleFile(f));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (currentStep !== 'compose') return;
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

  // Filter agents by search query & filter tab
  const filteredAgents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return agents.filter((a) => {
      const isSelected = selectedAgentIds.has(a.agentId);
      if (filterType === 'selected' && !isSelected) return false;
      if (filterType === 'unselected' && isSelected) return false;
      if (filterType === 'online' && !a.isOnline) return false;

      if (!q) return true;
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.jobTitle && a.jobTitle.toLowerCase().includes(q))
      );
    });
  }, [agents, searchQuery, filterType, selectedAgentIds]);

  if (!isOpen) return null;

  const isAllSelected = agents.length > 0 && selectedAgentIds.size === agents.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAgentIds(new Set());
    } else {
      setSelectedAgentIds(new Set(agents.map((a) => a.agentId)));
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyTemplate = (tmpl: TemplatePreset) => {
    setSelectedTemplateId(tmpl.id);
    setTitle(tmpl.title);
    setMessage(tmpl.text);
  };

  const handleSendBroadcast = () => {
    if (!message.trim() && attachments.length === 0) {
      toast.error('Please enter a message or attach a file to broadcast.');
      return;
    }
    if (attachments.some((a) => a.isUploading)) {
      toast.error('Please wait for files to finish uploading before sending.');
      return;
    }
    if (selectedAgentIds.size === 0) {
      toast.error('Please select at least one agent to receive the broadcast.');
      return;
    }

    setIsSending(true);
    try {
      const targetIds = isAllSelected ? [] : Array.from(selectedAgentIds);
      if (socket) {
        socket.emit('broadcast_announcement', {
          title: title.trim() || (attachments[0] ? `📎 ${attachments[0].name}` : 'Team Announcement'),
          message: message.trim(),
          adminName: user?.fullName || 'Administrator',
          targetAgentIds: targetIds,
          attachments: attachments.map((a) => ({
            id: a.id,
            name: a.name,
            sizeBytes: a.sizeBytes,
            mimeType: a.mimeType,
          })),
        });
      }

      toast.success(
        `📢 Broadcast sent to ${
          isAllSelected ? 'all agents' : `${selectedAgentIds.size} agent(s)`
        }!`,
      );
      onClose();
    } catch {
      toast.error('Failed to send broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  const isRefreshRecommendation =
    message.toLowerCase().includes('refresh') ||
    message.toLowerCase().includes('reload') ||
    message.toLowerCase().includes('update');

  const steps: { id: WizardStep; label: string; number: number; icon: React.ReactNode }[] = [
    { id: 'recipients', label: '1. Recipients', number: 1, icon: <Users size={14} /> },
    { id: 'compose', label: '2. Message', number: 2, icon: <FileText size={14} /> },
    { id: 'preview', label: '3. Broadcasting', number: 3, icon: <Eye size={14} /> },
  ];

  const modalContent = (
    <div
      className="broadcast-wizard-overlay"
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
        padding: '20px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        .broadcast-wizard-close-mobile {
          display: none !important;
        }
        .broadcast-btn-text-mobile {
          display: none !important;
        }

        @media (max-width: 768px) {
          .broadcast-wizard-overlay {
            padding: 8px !important;
          }
          .broadcast-wizard-dialog {
            max-width: 100% !important;
            height: 94vh !important;
            max-height: 94vh !important;
            border-radius: 12px !important;
          }
          .broadcast-wizard-header {
            padding: 10px 14px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          .broadcast-wizard-top-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
          }
          .broadcast-wizard-subtitle {
            display: none !important;
          }
          .broadcast-wizard-close-desktop {
            display: none !important;
          }
          .broadcast-wizard-close-mobile {
            display: flex !important;
          }
          .broadcast-wizard-stepper {
            width: 100% !important;
            display: flex !important;
            justify-content: space-between !important;
            gap: 4px !important;
            padding: 3px !important;
          }
          .broadcast-wizard-stepper-btn {
            flex: 1 !important;
            justify-content: center !important;
            padding: 5px 4px !important;
            font-size: 11px !important;
            gap: 4px !important;
          }
          .broadcast-wizard-body {
            padding: 12px 14px !important;
            gap: 10px !important;
          }
          .broadcast-wizard-search-box {
            min-width: 100% !important;
          }
          .broadcast-wizard-pills-row {
            width: 100% !important;
            display: flex !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
          }
          .broadcast-wizard-pills-row::-webkit-scrollbar {
            display: none !important;
          }
          .broadcast-wizard-selectall-btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .broadcast-wizard-agents-grid {
            grid-template-columns: 1fr !important;
            gap: 6px !important;
            padding: 6px !important;
          }
          .broadcast-wizard-status-bar {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 2px !important;
          }
          .broadcast-wizard-status-note {
            font-size: 10.5px !important;
          }
          .broadcast-wizard-templates-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            max-height: 160px !important;
            overflow-y: auto !important;
          }
          .broadcast-wizard-footer {
            padding: 10px 14px !important;
          }
          .broadcast-btn-text-full {
            display: none !important;
          }
          .broadcast-btn-text-mobile {
            display: inline !important;
          }
        }
      `}</style>
      <div
        className="broadcast-wizard-dialog"
        style={{
          width: '100%',
          maxWidth: '840px',
          height: '620px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wizard Header */}
        <div
          className="broadcast-wizard-header"
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            flexShrink: 0,
          }}
        >
          <div className="broadcast-wizard-top-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-surface, #eff6ff)',
                  color: 'var(--primary, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Megaphone size={18} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                  Broadcast Wizard
                </div>
                <div className="broadcast-wizard-subtitle" style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                  Real-time team announcement & instant notification dispatch
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="broadcast-wizard-close-mobile"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '8px',
                padding: '6px',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper Navigation */}
          <div
            className="broadcast-wizard-stepper"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-app, #f1f5f9)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            {steps.map((s, idx) => {
              const isActive = currentStep === s.id;
              const isPast =
                (currentStep === 'compose' && s.id === 'recipients') ||
                (currentStep === 'preview' && (s.id === 'recipients' || s.id === 'compose'));

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className="broadcast-wizard-stepper-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    fontWeight: isActive ? 750 : 600,
                    backgroundColor: isActive ? 'var(--bg-surface, #ffffff)' : 'transparent',
                    color: isActive ? 'var(--primary, #2563eb)' : isPast ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: isActive ? '1px solid var(--border-subtle, #e2e8f0)' : '1px solid transparent',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: isActive
                        ? 'var(--primary, #2563eb)'
                        : isPast
                        ? '#16a34a'
                        : 'var(--border-strong, #94a3b8)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {isPast ? <Check size={10} strokeWidth={3} /> : s.number}
                  </span>
                  {s.label.split('. ')[1]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="broadcast-wizard-close-desktop"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f1f5f9)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Step Content Body */}
        <div className="broadcast-wizard-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          {/* STEP 1: RECIPIENTS */}
          {currentStep === 'recipients' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
              {/* Search and Filter Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div
                  className="broadcast-wizard-search-box"
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                  }}
                >
                  <Search size={15} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search agents by name, email, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      width: '100%',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="broadcast-wizard-pills-row" style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-app, #f1f5f9)', padding: '3px', borderRadius: '8px' }}>
                  {(['all', 'online', 'selected', 'unselected'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      style={{
                        border: 'none',
                        background: filterType === t ? 'var(--bg-surface, #ffffff)' : 'transparent',
                        color: filterType === t ? 'var(--primary, #2563eb)' : 'var(--text-secondary)',
                        boxShadow: filterType === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: filterType === t ? 700 : 550,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t} ({
                        t === 'all'
                          ? agents.length
                          : t === 'online'
                          ? agents.filter((a) => !!a.isOnline).length
                          : t === 'selected'
                          ? selectedAgentIds.size
                          : agents.length - selectedAgentIds.size
                      })
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="broadcast-wizard-selectall-btn"
                  onClick={toggleSelectAll}
                  style={{
                    backgroundColor: 'var(--primary-surface, #eff6ff)',
                    border: '1px solid var(--primary-border, #bfdbfe)',
                    color: 'var(--primary, #2563eb)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {isAllSelected ? 'Deselect All' : `Select All (${agents.length})`}
                </button>
              </div>

              {/* 2-Column Responsive Card Grid */}
              <div
                className="broadcast-wizard-agents-grid"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '10px',
                  padding: '10px',
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '8px',
                  alignContent: 'start',
                }}
              >
                {filteredAgents.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>No agents match your filter</div>
                    <div style={{ fontSize: '11.5px', marginTop: '2px' }}>Try searching another keyword or reset the filter.</div>
                  </div>
                ) : (
                  filteredAgents.map((agent) => {
                    const isChecked = selectedAgentIds.has(agent.agentId);
                    return (
                      <div
                        key={agent.agentId}
                        onClick={() => toggleAgent(agent.agentId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'var(--bg-surface, #ffffff)' : 'var(--bg-surface, #ffffff)',
                          border: isChecked ? '1.5px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #e2e8f0)',
                          boxShadow: isChecked ? '0 2px 6px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: isChecked
                                  ? 'linear-gradient(135deg, var(--primary, #2563eb), var(--primary-hover, #1d4ed8))'
                                  : 'var(--bg-app, #e2e8f0)',
                                color: isChecked ? '#ffffff' : 'var(--text-secondary, #475569)',
                                fontSize: '11px',
                                fontWeight: 750,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              <span style={{ userSelect: 'none' }}>
                                {agent.fullName.substring(0, 2).toUpperCase()}
                              </span>
                              {agent.avatarUrl && (
                                <img
                                  src={agent.avatarUrl}
                                  alt={agent.fullName}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                            </div>
                            {/* Online / Offline status dot on avatar */}
                            <span
                              style={{
                                position: 'absolute',
                                bottom: '-1px',
                                right: '-1px',
                                width: '9px',
                                height: '9px',
                                borderRadius: '50%',
                                backgroundColor: agent.isOnline ? '#10b981' : '#ef4444',
                                border: '2px solid var(--bg-surface, #ffffff)',
                                boxShadow: agent.isOnline ? '0 0 5px #10b981' : '0 0 3px rgba(239, 68, 68, 0.6)',
                              }}
                              title={agent.isOnline ? 'Online' : 'Offline'}
                            />
                          </div>
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
                            >
                              {agent.fullName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {agent.email}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '5px',
                            border: isChecked ? 'none' : '1.5px solid var(--border-strong, #94a3b8)',
                            backgroundColor: isChecked ? 'var(--primary, #2563eb)' : 'transparent',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Status bar */}
              <div className="broadcast-wizard-status-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <strong style={{ color: 'var(--primary, #2563eb)' }}>{selectedAgentIds.size}</strong> of {agents.length} agents selected
                </span>
                <span className="broadcast-wizard-status-note" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Selected agents will receive an instant pop-up & notification.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: COMPOSE */}
          {currentStep === 'compose' && (
            <div
              onPaste={handlePaste}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}
            >
              {/* Quick Template Cards */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} style={{ color: '#f59e0b' }} /> Quick Announcement Templates
                </div>

                <div className="broadcast-wizard-templates-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {BROADCAST_TEMPLATES.map((tmpl) => {
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => handleApplyTemplate(tmpl)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '1.5px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #e2e8f0)',
                          backgroundColor: isSelected ? 'var(--primary-surface, #eff6ff)' : 'var(--bg-surface, #ffffff)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '15px' }}>{tmpl.icon}</span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 750,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'var(--primary, #2563eb)' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            }}
                          >
                            {tmpl.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {tmpl.title.replace(/^[^a-zA-Z0-9]+/, '')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          {tmpl.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Title & Message Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Please Refresh Your Browser"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium, #cbd5e1)',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 650,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Announcement Details <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional if file attached)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {message.length} characters
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type announcement details here (or attach a file below)..."
                    style={{
                      minHeight: '85px',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium, #cbd5e1)',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Attachments Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Paperclip size={13} style={{ color: 'var(--primary, #2563eb)' }} />
                      Attach Files <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Images, PDF, CSV, Excel, Docs)</span>
                    </label>
                    {attachments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: 'var(--primary, #2563eb)',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        + Add More
                      </button>
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

                  {/* Drag and Drop Zone if empty */}
                  {attachments.length === 0 ? (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragOver(false);
                        if (e.dataTransfer?.files?.length) handleFilesUpload(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: isDragOver ? '2px dashed var(--primary, #2563eb)' : '1.5px dashed var(--border-medium, #cbd5e1)',
                        backgroundColor: isDragOver ? 'var(--primary-surface, #eff6ff)' : 'var(--bg-app, #f8fafc)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--bg-surface, #ffffff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary, #2563eb)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          flexShrink: 0,
                        }}
                      >
                        <Upload size={16} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--primary, #2563eb)', fontWeight: 700 }}>Click to browse</span> or drag and drop any file (Image, PDF, CSV, Excel, Doc)
                        <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Paste from clipboard (Ctrl+V / Cmd+V) supported
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Uploaded Attachments List */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {attachments.map((att) => {
                        const fileType = getFileType(att.name, att.mimeType);
                        const isPdf = fileType === 'pdf';
                        const isCsv = fileType === 'csv';
                        const isImage = fileType === 'image';

                        const iconBg = isPdf ? '#fee2e2' : isCsv ? '#dcfce7' : isImage ? '#e0e7ff' : '#f1f5f9';
                        const iconColor = isPdf ? '#dc2626' : isCsv ? '#16a34a' : isImage ? '#4f46e5' : '#475569';

                        return (
                          <div
                            key={att.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: att.error ? '1px solid #fca5a5' : '1px solid var(--border-subtle, #e2e8f0)',
                              backgroundColor: att.error ? '#fef2f2' : 'var(--bg-app, #f8fafc)',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                              {isImage && att.previewUrl ? (
                                <img
                                  src={att.previewUrl}
                                  alt={att.name}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                    border: '1px solid var(--border-subtle, #cbd5e1)',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '6px',
                                    backgroundColor: iconBg,
                                    color: iconColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {isPdf ? (
                                    <FileText size={16} />
                                  ) : isCsv ? (
                                    <FileSpreadsheet size={16} />
                                  ) : (
                                    <File size={16} />
                                  )}
                                </div>
                              )}

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: '12px',
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
                                <div style={{ fontSize: '10.5px', color: att.error ? '#dc2626' : 'var(--text-muted)' }}>
                                  {att.isUploading ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary, #2563eb)' }}>
                                      <Loader2 size={11} className="animate-spin" /> Uploading to storage...
                                    </span>
                                  ) : att.error ? (
                                    att.error
                                  ) : (
                                    `${isImage ? 'Image' : isPdf ? 'PDF Document' : isCsv ? 'Spreadsheet' : 'File'} • ${formatFileSize(att.sizeBytes)}`
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleRemoveAttachment(att.id, e)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.backgroundColor = '#fee2e2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-muted)';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              title="Remove attachment"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: BROADCASTING PREVIEW */}
          {currentStep === 'preview' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '4px 0',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Announcement Preview
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Targeting <strong style={{ color: 'var(--primary, #2563eb)' }}>{selectedAgentIds.size}</strong> {selectedAgentIds.size === 1 ? 'agent' : 'agents'}. This modal will pop up immediately on their screen.
                </div>
              </div>

              {/* Centered Modal Mockup */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Mock Banner */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-hover, #1d4ed8) 100%)',
                    padding: '20px 22px 16px',
                    color: '#ffffff',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      margin: '0 auto 8px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #fef08a, #eab308)',
                      color: '#713f12',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(234, 179, 8, 0.4)',
                    }}
                  >
                    <Megaphone size={20} />
                  </div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 800, opacity: 0.9 }}>
                    Team Announcement
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                    {title || 'Announcement'}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
                    Broadcast by {user?.fullName || 'Administrator'} • Just now
                  </div>
                </div>

                {/* Mock Message Content & Attachments */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {message.trim() && (
                    <div
                      style={{
                        fontSize: '12.5px',
                        lineHeight: 1.55,
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '8px',
                        padding: '12px',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '140px',
                        overflowY: 'auto',
                      }}
                    >
                      {message}
                    </div>
                  )}

                  {/* Mock Attachments Preview inside card */}
                  {attachments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {attachments.map((att) => {
                        const fileType = getFileType(att.name, att.mimeType);
                        const isPdf = fileType === 'pdf';
                        const isCsv = fileType === 'csv';
                        const isImage = fileType === 'image';

                        if (isImage && att.previewUrl) {
                          return (
                            <div
                              key={att.id}
                              style={{
                                borderRadius: '8px',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                overflow: 'hidden',
                                backgroundColor: 'var(--bg-app, #f8fafc)',
                              }}
                            >
                              <img
                                src={att.previewUrl}
                                alt={att.name}
                                style={{
                                  width: '100%',
                                  maxHeight: '140px',
                                  objectFit: 'contain',
                                  backgroundColor: 'var(--bg-surface, #ffffff)',
                                  display: 'block',
                                }}
                              />
                              <div
                                style={{
                                  padding: '6px 10px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: 'var(--bg-surface, #ffffff)',
                                  borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                                }}
                              >
                                <span style={{ fontSize: '11px', fontWeight: 650, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                  {att.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    color: 'var(--primary, #2563eb)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                  }}
                                >
                                  <Download size={11} /> Download
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const badgeBg = isPdf ? '#fee2e2' : isCsv ? '#dcfce7' : '#e0e7ff';
                        const badgeColor = isPdf ? '#b91c1c' : isCsv ? '#15803d' : '#3730a3';
                        const typeLabel = isPdf ? 'PDF' : isCsv ? 'CSV' : 'File';

                        return (
                          <div
                            key={att.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle, #e2e8f0)',
                              backgroundColor: 'var(--bg-app, #f8fafc)',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  backgroundColor: badgeBg,
                                  color: badgeColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {isPdf ? <FileText size={15} /> : isCsv ? <FileSpreadsheet size={15} /> : <File size={15} />}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {att.name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {formatFileSize(att.sizeBytes)}
                                </div>
                              </div>
                            </div>

                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: 'var(--primary, #2563eb)',
                                color: '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Download size={10} /> Download {typeLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!message.trim() && attachments.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                      No message or attachments entered.
                    </div>
                  )}

                  {/* Mock Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isRefreshRecommendation && (
                      <div
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '7px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fde68a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                      >
                        <RotateCw size={13} /> Refresh Browser Now
                      </div>
                    )}
                    <div
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '7px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: 'var(--primary, #2563eb)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <CheckCircle2 size={13} /> Acknowledge & Close
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div
          className="broadcast-wizard-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            flexShrink: 0,
          }}
        >
          {/* Left Action: Back or Cancel */}
          {currentStep === 'recipients' ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 650,
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #475569)',
                border: '1px solid var(--border-medium, #cbd5e1)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep === 'preview' ? 'compose' : 'recipients')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 650,
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium, #cbd5e1)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {/* Right Action: Next or Send */}
          {currentStep === 'recipients' && (
            <button
              type="button"
              disabled={selectedAgentIds.size === 0}
              onClick={() => setCurrentStep('compose')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: selectedAgentIds.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedAgentIds.size === 0 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              }}
            >
              <span className="broadcast-btn-text-full">Continue to Message ({selectedAgentIds.size} selected)</span>
              <span className="broadcast-btn-text-mobile">Continue ({selectedAgentIds.size})</span>
              <ArrowRight size={14} />
            </button>
          )}

          {currentStep === 'compose' && (
            <button
              type="button"
              disabled={(!message.trim() && attachments.length === 0) || attachments.some((a) => a.isUploading)}
              onClick={() => setCurrentStep('preview')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: (!message.trim() && attachments.length === 0) || attachments.some((a) => a.isUploading) ? 'not-allowed' : 'pointer',
                opacity: (!message.trim() && attachments.length === 0) || attachments.some((a) => a.isUploading) ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              }}
            >
              <span className="broadcast-btn-text-full">Preview Announcement</span>
              <span className="broadcast-btn-text-mobile">Preview</span>
              <ArrowRight size={14} />
            </button>
          )}

          {currentStep === 'preview' && (
            <button
              type="button"
              disabled={isSending || selectedAgentIds.size === 0 || (!message.trim() && attachments.length === 0) || attachments.some((a) => a.isUploading)}
              onClick={handleSendBroadcast}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 750,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: isSending || selectedAgentIds.size === 0 || (!message.trim() && attachments.length === 0) || attachments.some((a) => a.isUploading) ? 'not-allowed' : 'pointer',
                opacity: isSending || selectedAgentIds.size === 0 || (!message.trim() && attachments.length === 0) || attachments.some((a) => a.isUploading) ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              }}
            >
              <Send size={14} />
              <span className="broadcast-btn-text-full">
                {isSending
                  ? 'Broadcasting...'
                  : `Launch Broadcast (${selectedAgentIds.size} ${selectedAgentIds.size === 1 ? 'agent' : 'agents'})`}
              </span>
              <span className="broadcast-btn-text-mobile">
                {isSending ? 'Broadcasting...' : `Launch (${selectedAgentIds.size})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
