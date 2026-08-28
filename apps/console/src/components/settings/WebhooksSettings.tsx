import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const WebhooksSettings: React.FC = () => {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWebhookOpen, setIsWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'ticket.created',
    'ticket.updated',
  ]);
  const toast = useToast();

  const loadWebhooks = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get('/admin/webhooks');
      setWebhooks(res || []);
    } catch (err: any) {
      toast.error(`Failed to load webhooks: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post('/admin/webhooks', {
        url: webhookUrl,
        events: webhookEvents,
      });
      setIsWebhookOpen(false);
      setWebhookUrl('');
      loadWebhooks();
      toast.success('Webhook created successfully!');
    } catch (err: any) {
      toast.error(`Webhook error: ${err.message}`);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await ApiClient.delete(`/admin/webhooks/${id}`);
      loadWebhooks();
      toast.success('Webhook deleted successfully!');
    } catch (err: any) {
      toast.error(`Webhook delete failed: ${err.message}`);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
            Outbound Webhooks (HMAC-SHA256)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Deliver real-time event notifications securely to your HTTP endpoints.
          </p>
        </div>
        <button onClick={() => setIsWebhookOpen(true)} className="btn btn-primary btn-sm">
          <Plus size={14} /> Add Webhook
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {webhooks.length === 0 ? (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '24px 0',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            No webhooks configured yet. Click Add Webhook to create one.
          </div>
        ) : (
          webhooks.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' }}>
                  {w.url}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Events: {(w.events || ['*']).join(', ')} | Status:{' '}
                  {w.isActive ? 'Active' : 'Disabled'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-open">
                  {w.isActive ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  onClick={() => handleDeleteWebhook(w.id)}
                  className="btn btn-secondary btn-sm"
                  style={{ color: '#ef4444' }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Webhook Modal */}
      <Modal
        isOpen={isWebhookOpen}
        onClose={() => {
          setIsWebhookOpen(false);
          setWebhookUrl('');
          setWebhookEvents(['ticket.created', 'ticket.updated']);
        }}
        title="Register Webhook Endpoint"
      >
        <form
          onSubmit={handleCreateWebhook}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <div>
            <label
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
            >
              Payload URL *
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="e.g. https://api.mycompany.com/webhook"
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
              style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}
            >
              Event Subscriptions
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'ticket.created - Raised support tickets', val: 'ticket.created' },
                { label: 'ticket.updated - Field updates', val: 'ticket.updated' },
                { label: 'ticket.commented - Replies & Notes added', val: 'ticket.commented' },
                { label: 'ticket.resolved - Resolution confirmations', val: 'ticket.resolved' },
              ].map((ev) => {
                const isChecked = webhookEvents.includes(ev.val);
                return (
                  <label
                    key={ev.val}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setWebhookEvents([...webhookEvents, ev.val]);
                        } else {
                          setWebhookEvents(webhookEvents.filter((item) => item !== ev.val));
                        }
                      }}
                    />
                    <span>{ev.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}
          >
            <button
              type="button"
              onClick={() => setIsWebhookOpen(false)}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Add Webhook
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
