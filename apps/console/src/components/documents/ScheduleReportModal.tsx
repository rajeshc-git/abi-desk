import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Mail,
  Upload,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Settings,
  Trash2,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ScheduleReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: 'today_tickets' | 'last_30_days';
}

export const ScheduleReportModal: React.FC<ScheduleReportModalProps> = ({
  isOpen,
  onClose,
  reportType,
}) => {
  const toast = useToast();

  const isToday = reportType === 'today_tickets';
  const reportTitle = isToday ? "Today's Tickets" : 'Last 30 Days Tickets';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingNow, setIsSendingNow] = useState(false);

  // Form State
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<'daily' | 'month_end'>(isToday ? 'daily' : 'month_end');
  const [time, setTime] = useState<string>('23:58');
  const [emails, setEmails] = useState<string[]>([]);
  const [rawEmailInput, setRawEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to format HH:mm into readable 12-hour AM/PM string
  const format12Hour = (hhmm: string) => {
    const [h, m] = (hhmm || '23:58').split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Load existing config on open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoading(true);

    ApiClient.get<any>(`/scheduled-reports/${reportType}`)
      .then((res) => {
        if (!mounted) return;
        setEnabled(res.enabled ?? false);
        setFrequency(res.frequency || (isToday ? 'daily' : 'month_end'));
        setTime(res.time || '23:58');
        setEmails(Array.isArray(res.emails) ? res.emails : []);
        setSubject(res.subject || '');
        setBody(res.body || '');
        setLastSentAt(res.lastSentAt || null);
      })
      .catch((err) => {
        console.error('Failed to load report schedule', err);
        toast.error('Could not load report schedule configuration.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, reportType]);

  if (!isOpen) return null;

  // Email parsing and deduplication helper
  const addParsedEmails = (text: string) => {
    if (!text.trim()) return;

    // Matches any email in messy text (comma, whitespace, newlines, quotes)
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const found = text.match(emailRegex) || [];

    if (found.length === 0) {
      toast.error('No valid email addresses found in input.');
      return;
    }

    const cleaned = found.map((e) => e.trim().toLowerCase());
    const merged = Array.from(new Set([...emails, ...cleaned]));
    const newlyAdded = merged.length - emails.length;

    setEmails(merged);
    setRawEmailInput('');

    if (newlyAdded > 0) {
      toast.success(`Added ${newlyAdded} new recipient email${newlyAdded > 1 ? 's' : ''}!`);
    } else {
      toast.info('All extracted emails are already in the recipients list.');
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        addParsedEmails(content);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      toast.error('Failed to read uploaded email CSV file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Save Schedule to backend
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ApiClient.put(`/scheduled-reports/${reportType}`, {
        enabled,
        emails,
        frequency,
        time: time || '23:58',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      });
      toast.success(
        `Automated schedule for ${reportTitle} (${format12Hour(time || '23:58')}) saved successfully!`
      );
      onClose();
    } catch (err: any) {
      console.error('Failed to save schedule', err);
      toast.error(err.message || 'Failed to save scheduled report configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Send Now (Test Delivery)
  const handleSendNow = async () => {
    if (emails.length === 0) {
      toast.error('Please add at least one recipient email address first.');
      return;
    }

    setIsSendingNow(true);
    try {
      const res = await ApiClient.post<any>(`/scheduled-reports/${reportType}/send-now`, {
        emails,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      });

      toast.success(
        `Sent report email with attached CSV to ${res.count ?? emails.length} recipient${emails.length > 1 ? 's' : ''} from donotreply@abi-health.in!`
      );
      setLastSentAt(new Date().toISOString());
    } catch (err: any) {
      console.error('Failed to send test report', err);
      toast.error(err.message || 'Failed to send report email');
    } finally {
      setIsSendingNow(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-subtle, #cbd5e1)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: isToday ? 'rgba(2, 132, 199, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                color: isToday ? '#0284c7' : '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isToday ? <Clock size={20} /> : <Calendar size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Automated Email Schedule: {reportTitle}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                {isToday
                  ? `Generates full CSV dataset and sends automatically everyday at ${format12Hour(time)}`
                  : `Generates full CSV dataset and sends automatically ${frequency === 'month_end' ? 'every month-end (last calendar day)' : 'everyday'} at ${format12Hour(time)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body / Scrollable Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {isLoading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size={32} />
            </div>
          ) : (
            <>
              {/* Top Status & Sender Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary, #2563eb)' }}
                    />
                    <span>Automated Trigger</span>
                  </label>
                  {enabled ? (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                      Active
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                      Paused
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                  <ShieldCheck size={14} style={{ color: '#2563eb' }} />
                  <span>Sender: <strong>donotreply@abi-health.in</strong></span>
                </div>
              </div>

              {/* Schedule & Time Settings Card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '14px 16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Schedule & Trigger Time
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    Next Schedule: <strong style={{ color: '#1e40af' }}>{isToday ? 'Everyday' : (frequency === 'month_end' ? 'Every Month-End (Last Calendar Day)' : 'Everyday')}</strong> at <strong style={{ color: '#1e40af' }}>{format12Hour(time)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Frequency (for Last 30 Days) */}
                  {!isToday && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Trigger Frequency
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as 'daily' | 'month_end')}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="month_end">🗓️ Last Day of the Month (Month-End)</option>
                        <option value="daily">🕒 Everyday</option>
                      </select>
                    </div>
                  )}

                  {/* Time Picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Trigger Time</span>
                      <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#64748b' }}>({Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'})</span>
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value || '23:58')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#1e293b',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        width: 'fit-content',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Email Recipients Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} style={{ color: 'var(--primary, #2563eb)' }} />
                    <span>Recipient Email Addresses ({emails.length})</span>
                  </label>
                  {emails.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEmails([])}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>

                {/* Paste Area & Upload */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type or paste emails (comma, space, or newline separated)..."
                    value={rawEmailInput}
                    onChange={(e) => setRawEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addParsedEmails(rawEmailInput);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle, #cbd5e1)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addParsedEmails(rawEmailInput)}
                    disabled={!rawEmailInput.trim()}
                    className="btn btn-secondary"
                    style={{ fontSize: '12.5px', padding: '0 14px', whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    title="Upload CSV with emails"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary"
                    style={{ fontSize: '12.5px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                  >
                    <Upload size={13} />
                    <span>Upload CSV</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,text/plain"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Email Chips Preview */}
                {emails.length > 0 ? (
                  <div
                    style={{
                      maxHeight: '130px',
                      overflowY: 'auto',
                      padding: '8px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    {emails.map((email) => (
                      <span
                        key={email}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '12px',
                          padding: '3px 8px',
                          borderRadius: '16px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                        }}
                      >
                        <span>{email}</span>
                        <X
                          size={12}
                          style={{ cursor: 'pointer', color: '#64748b' }}
                          onClick={() => removeEmail(email)}
                        />
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                    No recipient emails added yet. Paste emails above or upload a CSV.
                  </div>
                )}
              </div>

              {/* Email Subject Template */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Email Subject Template
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={`[ABI Desk] Report: ${reportTitle} - {{date}}`}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, #cbd5e1)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Email Body Template */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Email Message Body Template
                </label>
                <textarea
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter email message body..."
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #cbd5e1)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: '210px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Last sent notification */}
              {lastSentAt && (
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Last delivery was sent on: <strong>{new Date(lastSentAt).toLocaleString()}</strong>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          {/* Test / Send Now Button */}
          <button
            type="button"
            onClick={handleSendNow}
            disabled={isLoading || isSendingNow || isSaving || emails.length === 0}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#0284c7',
              borderColor: '#0284c7',
              fontWeight: 600,
            }}
          >
            {isSendingNow ? <LoadingSpinner size={14} /> : <Send size={14} />}
            <span>{isSendingNow ? 'Sending Test...' : 'Send Now (Test Email)'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isSendingNow}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSaving || isSendingNow}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSaving ? <LoadingSpinner size={14} /> : <Save size={14} />}
              <span>{isSaving ? 'Saving...' : 'Save Schedule'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
