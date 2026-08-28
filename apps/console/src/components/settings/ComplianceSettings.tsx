import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const ComplianceSettings: React.FC = () => {
  const [dsrList, setDsrList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDsrOpen, setIsDsrOpen] = useState(false);
  const [dsrEmail, setDsrEmail] = useState('');
  const [dsrType, setDsrType] = useState<'EXPORT' | 'ERASURE'>('EXPORT');
  const [dsrReason, setDsrReason] = useState('');
  const toast = useToast();

  const loadComplianceData = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get('/compliance/dsr');
      setDsrList(res || []);
    } catch (err: any) {
      toast.error(`Failed to load compliance data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComplianceData();
  }, []);

  const handleCreateDsr = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/compliance/dsr', {
        email: dsrEmail,
        requestType: dsrType,
        reason: dsrReason || undefined,
      });
      setIsDsrOpen(false);
      setDsrEmail('');
      setDsrReason('');
      loadComplianceData();
      toast.success('GDPR DSR request registered successfully!');
    } catch (err: any) {
      toast.error(`Failed to create request: ${err.message}`);
    }
  };

  const handleExecuteRetention = async (scope: string) => {
    if (
      !confirm(
        `Are you sure you want to run the retention purge for ${scope}? This will permanently delete records older than your configured limits.`,
      )
    )
      return;
    try {
      await ApiClient.post(`/compliance/retention/${scope}/run`);
      loadComplianceData();
      toast.success(`GDPR Retention policy run successfully for ${scope}!`);
    } catch (err: any) {
      toast.error(`Failed to run retention: ${err.message}`);
    }
  };

  const safeFormatDate = (dateVal: any) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <LoadingSpinner size={24} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* GDPR & DPDPA controls */}
      <div
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
              GDPR & DPDPA Compliance Requests
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Submit and monitor Art. 15 Data Subject Access requests or Art. 17 Erasure
              requests.
            </p>
          </div>
          <button onClick={() => setIsDsrOpen(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> Submit Request
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dsrList.length === 0 ? (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              No compliance requests submitted yet.
            </div>
          ) : (
            dsrList.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.email}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Type: {d.requestType} | Submitted: {safeFormatDate(d.createdAt)}
                  </div>
                </div>
                <span
                  className={`badge ${d.status === 'COMPLETED' ? 'badge-open' : 'badge-closed'}`}
                >
                  {d.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Data retention purge triggers */}
      <div
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
          Execute Data Retention Policies
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Immediately run cleanups of records exceeding the data retention limits configured
          for your tenant.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { label: 'Purge Old Tickets', scope: 'TICKET' },
            { label: 'Purge Diagnostic Telemetry', scope: 'DIAGNOSTIC' },
            { label: 'Purge Attachments & Media', scope: 'MEDIA' },
            { label: 'Purge Audit Logs', scope: 'AUDIT' },
            { label: 'Purge Chat Records', scope: 'CHAT' },
            { label: 'Purge Webhook Logs', scope: 'WEBHOOK_DELIVERY' },
          ].map((pol, i) => (
            <button
              key={i}
              onClick={() => handleExecuteRetention(pol.scope)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '10px', justifyContent: 'center', fontSize: '12px' }}
            >
              {pol.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit DSR Modal */}
      <Modal
        isOpen={isDsrOpen}
        onClose={() => setIsDsrOpen(false)}
        title="Submit GDPR Data Subject Request"
      >
        <form
          onSubmit={handleCreateDsr}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              User Email Address *
            </label>
            <input
              type="email"
              value={dsrEmail}
              onChange={(e) => setDsrEmail(e.target.value)}
              placeholder="e.g. customer@example.com"
              className="form-control"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
              required
            />
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              DSR Request Type *
            </label>
            <select
              value={dsrType}
              onChange={(e) => setDsrType(e.target.value as any)}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="EXPORT">Art. 15 Personal Data Export (JSON format)</option>
              <option value="ERASURE">
                Art. 17 In-place PII Anonymization (Right to be Forgotten)
              </option>
            </select>
          </div>
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Reason / Notes
            </label>
            <textarea
              value={dsrReason}
              onChange={(e) => setDsrReason(e.target.value)}
              placeholder="Optional notes or legal reference"
              rows={3}
              className="form-control"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
          >
            <button
              type="button"
              onClick={() => setIsDsrOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
