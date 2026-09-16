import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Mail,
  UserCheck,
  Shield,
  Tag,
  MessageSquare,
  Zap,
  ArrowRight,
  Layers,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';

export interface HistoryActor {
  id?: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  kind?: string;
  avatarUrl?: string;
  jobTitle?: string;
  roleName?: string;
  role?: string;
}

export interface HistoryEventItem {
  id: string;
  type: string;
  rawType?: string;
  eventType?: string;
  actorId?: string | null;
  actorType?: 'USER' | 'SYSTEM' | 'API_KEY' | 'ANONYMOUS';
  actorLabel?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  actor?: HistoryActor | null;
  body?: string;
  visibility?: 'INTERNAL' | 'PUBLIC';
  attachments?: Array<{ id: string; originalFilename: string; mimeType: string }>;
}

interface HistoryViewProps {
  ticketId: string;
  ticket?: any;
  onCountChange?: (count: number) => void;
}

type CategoryFilter =
  | 'ALL'
  | 'STATUS_WORKFLOW'
  | 'FIELD_UPDATES'
  | 'ASSIGNMENTS'
  | 'COMMENTS_NOTES'
  | 'AUTOMATION_RULES';

export const HistoryView: React.FC<HistoryViewProps> = ({ ticketId, ticket, onCountChange }) => {
  const [events, setEvents] = useState<HistoryEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [actorFilter, setActorFilter] = useState<'ALL' | 'STAFF' | 'CUSTOMER' | 'SYSTEM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadHistory = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const res = await ApiClient.get<{ events: HistoryEventItem[] }>(`/tickets/${ticketId}/timeline`);
      const eventList = res.events || [];
      // Sort descending (newest first) for history inspection
      const sorted = [...eventList].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setEvents(sorted);
      if (onCountChange) onCountChange(sorted.length);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [ticketId, onCountChange]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Relative time formatter (e.g., "24 seconds ago", "2 minutes ago", "Yesterday at 1:30 PM")
  const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 90) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Date banner formatting (e.g., "Today (11 Sep)", "Yesterday (10 Sep)", "09 Sep 2026")
  const formatDateGroupHeader = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const formattedDayMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    if (isToday) return `Today (${formattedDayMonth})`;
    if (isYesterday) return `Yesterday (${formattedDayMonth})`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Filter events based on active category, actor, and search query
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const type = ev.rawType || ev.eventType || ev.type;

      // Category filter
      if (categoryFilter === 'STATUS_WORKFLOW') {
        const isWorkflow = [
          'STATUS_CHANGED',
          'TIER_CHANGED',
          'ESCALATED',
          'DEESCALATED',
          'REOPENED',
          'RESOLVED',
          'CLOSED',
          'CANCELLED',
          'CONFIRMATION_REQUESTED',
          'CUSTOMER_CONFIRMED',
          'CUSTOMER_REJECTED',
        ].includes(type);
        if (!isWorkflow) return false;
      } else if (categoryFilter === 'FIELD_UPDATES') {
        const isField = [
          'PRIORITY_CHANGED',
          'CATEGORY_CHANGED',
          'TAG_ADDED',
          'TAG_REMOVED',
          'LINKED',
          'CREATED',
        ].includes(type);
        if (!isField) return false;
      } else if (categoryFilter === 'ASSIGNMENTS') {
        const isAssign = ['ASSIGNED', 'UNASSIGNED', 'QUEUE_CHANGED', 'TEAM_CHANGED'].includes(type);
        if (!isAssign) return false;
      } else if (categoryFilter === 'COMMENTS_NOTES') {
        const isComment = [
          'COMMENT',
          'COMMENT_ADDED',
          'INTERNAL_NOTE_ADDED',
          'ATTACHMENT_ADDED',
        ].includes(type);
        if (!isComment) return false;
      } else if (categoryFilter === 'AUTOMATION_RULES') {
        const isAuto = [
          'AUTOMATION_APPLIED',
          'SLA_TARGET_STARTED',
          'SLA_WARNING',
          'SLA_BREACHED',
          'SLA_MET',
          'APPROVAL_REQUESTED',
          'APPROVAL_GRANTED',
          'APPROVAL_REJECTED',
        ].includes(type);
        if (!isAuto && !ev.actorLabel) return false;
      }

      // Actor filter
      if (actorFilter === 'STAFF') {
        if (ev.actor?.kind !== 'STAFF') return false;
      } else if (actorFilter === 'CUSTOMER') {
        if (ev.actor?.kind === 'STAFF' || ev.actorType === 'SYSTEM') return false;
      } else if (actorFilter === 'SYSTEM') {
        if (ev.actorType !== 'SYSTEM' && !ev.actorLabel) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actorName = (ev.actor?.fullName || ev.actor?.displayName || ev.actorLabel || '').toLowerCase();
        const role = (ev.actor?.roleName || ev.actor?.role || '').toLowerCase();
        const from = (ev.fromValue || '').toLowerCase();
        const to = (ev.toValue || '').toLowerCase();
        const body = (ev.body || '').toLowerCase();
        const typeStr = type.toLowerCase();
        if (
          !actorName.includes(q) &&
          !role.includes(q) &&
          !from.includes(q) &&
          !to.includes(q) &&
          !body.includes(q) &&
          !typeStr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [events, categoryFilter, actorFilter, searchQuery]);

  // Group events by date banner
  const groupedEvents = useMemo(() => {
    const groups: { [key: string]: HistoryEventItem[] } = {};
    for (const ev of filteredEvents) {
      const groupHeader = formatDateGroupHeader(ev.createdAt);
      if (!groups[groupHeader]) groups[groupHeader] = [];
      groups[groupHeader].push(ev);
    }
    return groups;
  }, [filteredEvents]);

  // Render individual Zoho Desk-style event item
  const renderEventItem = (ev: HistoryEventItem) => {
    const type = ev.rawType || ev.eventType || ev.type;
    const actorName = ev.actor?.fullName || ev.actor?.displayName || 'Unknown';
    const actorRole = ev.actor?.roleName || (ev.actor?.kind === 'STAFF' ? 'Staff' : 'Customer');
    const isSystem = ev.actorType === 'SYSTEM' || !!ev.actorLabel;
    const isCustomer = ev.actor?.kind === 'CUSTOMER' || ev.actor?.kind === 'GUEST';

    // Build event header title
    let headerTitle = `${actorName} updated the ticket`;
    let headerRoleBadge = actorRole;
    let icon = <CheckCircle2 size={13} style={{ color: 'var(--primary)' }} />;

    if (type === 'CREATED') {
      headerTitle = `${actorName} created the ticket`;
      icon = <Layers size={13} style={{ color: '#3b82f6' }} />;
    } else if (type === 'ASSIGNED') {
      headerTitle = `${actorName} assigned the ticket`;
      icon = <UserCheck size={13} style={{ color: '#8b5cf6' }} />;
    } else if (type === 'UNASSIGNED') {
      headerTitle = `${actorName} unassigned the ticket`;
      icon = <UserCheck size={13} style={{ color: '#ef4444' }} />;
    } else if (type === 'STATUS_CHANGED' || type === 'TIER_CHANGED' || type === 'ESCALATED') {
      headerTitle = `${actorName} transitioned the ticket`;
      icon = <Zap size={13} style={{ color: '#06b6d4' }} />;
    } else if (type === 'COMMENT_ADDED' || (type === 'COMMENT' && ev.visibility !== 'INTERNAL')) {
      if (isCustomer) {
        headerTitle = `Mail received from ${actorName.toLowerCase()}`;
        icon = <Mail size={13} style={{ color: '#10b981' }} />;
      } else {
        headerTitle = `${actorName} posted a public reply`;
        icon = <MessageSquare size={13} style={{ color: '#3b82f6' }} />;
      }
    } else if (type === 'INTERNAL_NOTE_ADDED' || (type === 'COMMENT' && ev.visibility === 'INTERNAL')) {
      headerTitle = `${actorName} added an internal note`;
      icon = <Shield size={13} style={{ color: '#f59e0b' }} />;
    } else if (type === 'TAG_ADDED' || type === 'TAG_REMOVED') {
      headerTitle = `${actorName} modified ticket tags`;
      icon = <Tag size={13} style={{ color: '#6366f1' }} />;
    } else if (isSystem || type === 'AUTOMATION_APPLIED') {
      headerTitle = ev.actorLabel || 'Notification Rule Applied';
      headerRoleBadge = 'System Automation';
      icon = <Zap size={13} style={{ color: '#a855f7' }} />;
    }

    // Build detailed field diffs
    const diffRows: Array<{ field: string; from?: string | null; to?: string | null; directText?: string }> = [];

    if (type === 'CREATED') {
      diffRows.push({ field: 'Ticket Number', directText: ev.toValue || ticket?.number || 'Generated' });
      diffRows.push({ field: 'Channel', directText: ev.metadata?.channel || 'WEB' });
      if (ev.metadata?.priority) {
        diffRows.push({ field: 'Initial Priority', directText: ev.metadata.priority });
      }
    } else if (type === 'PRIORITY_CHANGED') {
      diffRows.push({
        field: 'Priority changed from',
        from: ev.fromValue || '-None-',
        to: ev.toValue || 'Normal',
      });
    } else if (type === 'CATEGORY_CHANGED') {
      diffRows.push({
        field: 'Category changed from',
        from: ev.fromValue || '-None-',
        to: ev.toValue || '-None-',
      });
    } else if (type === 'STATUS_CHANGED' || type === 'RESOLVED' || type === 'CLOSED' || type === 'REOPENED') {
      diffRows.push({
        field: 'Status changed from',
        from: ev.fromValue ? ev.fromValue.replace(/_/g, ' ') : '-None-',
        to: ev.toValue ? ev.toValue.replace(/_/g, ' ') : 'Updated',
      });
    } else if (type === 'TIER_CHANGED' || type === 'ESCALATED') {
      diffRows.push({
        field: 'Support Tier changed from',
        from: ev.metadata?.fromTier || ev.fromValue || '-None-',
        to: ev.metadata?.toTier || ev.toValue || 'Tier Updated',
      });
    } else if (type === 'ASSIGNED') {
      diffRows.push({
        field: 'Ticket Owner changed from',
        from: ev.fromValue || 'Unassigned',
        to: ev.toValue || 'Assigned Agent',
      });
    } else if (type === 'UNASSIGNED') {
      diffRows.push({
        field: 'Ticket Owner changed from',
        from: ev.fromValue || 'Assigned Agent',
        to: 'Unassigned',
      });
    } else if (type === 'QUEUE_CHANGED') {
      diffRows.push({
        field: 'Queue changed from',
        from: ev.fromValue || '-None-',
        to: ev.toValue || '-None-',
      });
    } else if (type === 'TEAM_CHANGED') {
      diffRows.push({
        field: 'Team changed from',
        from: ev.fromValue || '-None-',
        to: ev.toValue || '-None-',
      });
    } else if (type === 'TAG_ADDED') {
      diffRows.push({ field: 'Tag Added', directText: ev.toValue || ev.metadata?.tag || 'Tag' });
    } else if (type === 'TAG_REMOVED') {
      diffRows.push({ field: 'Tag Removed', directText: ev.fromValue || ev.metadata?.tag || 'Tag' });
    } else if (type === 'LINKED') {
      diffRows.push({
        field: 'Ticket Linked to',
        directText: `#${ev.toValue || ev.metadata?.targetTicketId} (${ev.metadata?.linkType || 'RELATED'})`,
      });
    }

    // Metadata rules and alerts (matching Zoho Desk's Rule Name / Notification Type / Recipient)
    if (ev.metadata && typeof ev.metadata === 'object') {
      if (ev.metadata.ruleName || ev.metadata.ruleId) {
        diffRows.push({ field: 'Rule Name', directText: ev.metadata.ruleName || `Rule #${ev.metadata.ruleId}` });
      }
      if (ev.metadata.alertName) {
        diffRows.push({ field: 'Alert Name', directText: ev.metadata.alertName });
      }
      if (ev.metadata.notificationType || ev.metadata.type) {
        diffRows.push({ field: 'Notification Type', directText: ev.metadata.notificationType || ev.metadata.type });
      }
      if (ev.metadata.notificationName) {
        diffRows.push({ field: 'Notification Name', directText: ev.metadata.notificationName });
      }
      if (ev.metadata.recipient || ev.metadata.recipientEmail) {
        diffRows.push({ field: 'Recipient', directText: ev.metadata.recipient || ev.metadata.recipientEmail });
      }
      if (ev.metadata.cc && Array.isArray(ev.metadata.cc) && ev.metadata.cc.length > 0) {
        diffRows.push({ field: 'CC Recipients', directText: ev.metadata.cc.join(', ') });
      }
      if (ev.metadata.reason) {
        diffRows.push({ field: 'Transition Reason', directText: ev.metadata.reason });
      }
      if (ev.metadata.productName) {
        diffRows.push({ field: 'Product Name', directText: ev.metadata.productName });
      }
      if (ev.metadata.organization) {
        diffRows.push({ field: 'Organization', directText: ev.metadata.organization });
      }
    }

    // Snippet for comments or internal notes
    if (ev.body && diffRows.length === 0) {
      const cleanSnippet = ev.body.replace(/<[^>]*>/g, '').trim().slice(0, 160);
      if (cleanSnippet) {
        diffRows.push({
          field: ev.visibility === 'INTERNAL' ? 'Internal Note Content' : 'Reply Content',
          directText: `"${cleanSnippet}${cleanSnippet.length >= 160 ? '...' : ''}"`,
        });
      }
    }

    return (
      <div
        key={ev.id}
        style={{
          position: 'relative',
          paddingLeft: '28px',
          marginBottom: '20px',
        }}
      >
        {/* Timeline Node Bullet on the vertical rail */}
        <div
          style={{
            position: 'absolute',
            left: '0px',
            top: '4px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isSystem ? '#a855f7' : '#3b82f6',
            border: '2px solid var(--bg-surface, #ffffff)',
            boxShadow: '0 0 0 1px var(--border-subtle, #e2e8f0)',
            zIndex: 2,
          }}
        />

        {/* Time Stamp (Zoho Desk style relative timestamp) */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary, #64748b)',
            marginBottom: '3px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          title={new Date(ev.createdAt).toLocaleString()}
        >
          <span>{formatRelativeTime(ev.createdAt)}</span>
          <span style={{ fontSize: '10px', opacity: 0.5 }}>•</span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>
            {new Date(ev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Event Header & Actor */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--text-primary, #0f172a)',
            }}
          >
            {headerTitle}
          </span>

          {headerRoleBadge && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '1px 7px',
                borderRadius: '10px',
                backgroundColor: isSystem
                  ? 'rgba(168, 85, 247, 0.12)'
                  : isCustomer
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(59, 130, 246, 0.12)',
                color: isSystem ? '#9333ea' : isCustomer ? '#059669' : '#2563eb',
              }}
            >
              {headerRoleBadge}
            </span>
          )}
        </div>

        {/* Field Changes Table / Key-Value Details (matching Zoho Desk's clean style) */}
        {diffRows.length > 0 && (
          <div
            style={{
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              fontSize: '12.5px',
            }}
          >
            {diffRows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  color: 'var(--text-secondary, #475569)',
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: 'var(--text-muted, #64748b)', fontWeight: 500 }}>
                  {row.field}
                </span>

                {row.from !== undefined && row.to !== undefined ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#64748b' }}>{row.from}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>to</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--primary, #2563eb)',
                      }}
                    >
                      {row.to}
                    </span>
                  </span>
                ) : (
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--primary, #2563eb)',
                    }}
                  >
                    {row.directText}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-app, #f8fafc)',
      }}
    >
      {/* Zoho Desk Style Sub-Header Toolbar */}
      <div className="history-view-toolbar">
        {/* Left Side: Ticket History Filter Dropdowns */}
        <div className="history-toolbar-filters">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="history-label desktop-only-history-label" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Ticket History -
            </span>
            <select
              className="history-category-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--primary, #2563eb)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                padding: '2px 4px',
              }}
            >
              <option value="ALL">All Activity</option>
              <option value="STATUS_WORKFLOW">Status & Workflow</option>
              <option value="FIELD_UPDATES">Field Updates</option>
              <option value="ASSIGNMENTS">Assignments</option>
              <option value="COMMENTS_NOTES">Notes & Replies</option>
              <option value="AUTOMATION_RULES">Automation & Rules</option>
            </select>
          </div>

          <span className="history-toolbar-separator desktop-only-history-label" style={{ color: 'var(--border-subtle, #cbd5e1)' }}>|</span>

          {/* Actor Role Filter */}
          <div className="history-actor-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="desktop-only-history-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Filter by:</span>
            <select
              className="history-actor-select"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value as any)}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-hover, #f1f5f9)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="ALL">None (All Actors)</option>
              <option value="STAFF">Support Agents only</option>
              <option value="CUSTOMER">Customers only</option>
              <option value="SYSTEM">System & Automations</option>
            </select>
          </div>
        </div>

        {/* Right Side: Search and Refresh */}
        <div className="history-toolbar-actions">
          <div className="history-search-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '8px',
                color: 'var(--text-muted, #94a3b8)',
              }}
            />
            <input
              type="text"
              className="history-search-input"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '5px 8px 5px 26px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--bg-input, #ffffff)',
                color: 'var(--text-primary)',
                width: '150px',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            className="history-refresh-btn"
            onClick={() => loadHistory(true)}
            title="Refresh history"
            disabled={isRefreshing}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? 'animate-spin' : ''}
              style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            <span className="history-refresh-text">Refresh</span>
          </button>
        </div>
      </div>

      {/* History Stream Content Area */}
      <div className="history-stream-container">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <LoadingSpinner />
          </div>
        ) : Object.keys(groupedEvents).length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-secondary)',
            }}
          >
            <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              No history events found
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {searchQuery || categoryFilter !== 'ALL' || actorFilter !== 'ALL'
                ? 'Try resetting the filters to see all ticket activity.'
                : 'Activity events will appear here as the ticket is processed.'}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '840px', margin: '0 auto' }}>
            {Object.entries(groupedEvents).map(([dateGroup, items]) => (
              <div key={dateGroup} style={{ marginBottom: '28px' }}>
                {/* Zoho Desk Style Date Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--text-primary, #0f172a)',
                    marginBottom: '16px',
                  }}
                >
                  <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span>{dateGroup}</span>
                </div>

                {/* Vertical connecting rail container */}
                <div
                  style={{
                    position: 'relative',
                    marginLeft: '4px',
                  }}
                >
                  {/* The continuous vertical line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '4px',
                      top: '8px',
                      bottom: '8px',
                      width: '2px',
                      backgroundColor: 'var(--border-subtle, #e2e8f0)',
                    }}
                  />

                  {/* Render items in chronological reverse for this date */}
                  {items.map(renderEventItem)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
