import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

import { CelebrationModal, CelebrationData } from '../components/documents/CelebrationModal';
import { AnnouncementModal, BroadcastData } from '../components/documents/AnnouncementModal';
import { fireCelebrationConfetti } from '../utils/confetti';
import { ApiClient } from '../api/client';

export interface AppNotification {
  id: string;
  type: 'MENTION' | 'REPLY' | 'ASSIGNMENT' | 'TICKET_CREATED' | 'CELEBRATION' | 'BROADCAST';
  title: string;
  message: string;
  ticketId: string;
  ticketNumber?: number | string;
  product?: string;
  productId?: string;
  authorName?: string;
  authorEmail?: string;
  authorKind?: string;
  isInternal?: boolean;
  createdAt: string;
  isRead: boolean;
  linkUrl: string;
  celebrationData?: CelebrationData;
  broadcastData?: BroadcastData;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  openCelebration: (data: CelebrationData) => void;
  openBroadcast: (data: BroadcastData) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

import { isUserScopedToTicket } from '../utils/ticketScope';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const storageKey = user?.id ? `abidesk_notifications_${user.id}` : 'abidesk_notifications_guest';

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [celebrationModalData, setCelebrationModalData] = useState<CelebrationData | null>(null);
  const [broadcastModalData, setBroadcastModalData] = useState<BroadcastData | null>(null);

  const openCelebration = useCallback((data: CelebrationData) => {
    setCelebrationModalData(data);
  }, []);

  const openBroadcast = useCallback((data: BroadcastData) => {
    setBroadcastModalData(data);
  }, []);

  // Keep state in sync with user change & fetch persisted notifications from DB
  useEffect(() => {
    if (!user?.id) return;

    // 1. Load from localStorage first for instant display
    try {
      const stored = localStorage.getItem(`abidesk_notifications_${user.id}`);
      if (stored) {
        setNotifications(JSON.parse(stored));
      } else {
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    }

    // 2. Fetch from database to load any notifications received while offline
    ApiClient.get<any[]>('/notifications')
      .then((serverNotifs) => {
        if (!Array.isArray(serverNotifs) || serverNotifs.length === 0) return;

        const mappedServerNotifs: AppNotification[] = serverNotifs.map((dbN) => {
          let nType: AppNotification['type'] = 'MENTION';
          if (dbN.eventType === 'broadcast.announcement' || dbN.eventType?.includes('broadcast')) nType = 'BROADCAST';
          else if (dbN.eventType === 'agent.celebrated' || dbN.eventType?.includes('celebrat')) nType = 'CELEBRATION';
          else if (dbN.eventType === 'ticket.reply') nType = 'REPLY';
          else if (dbN.eventType === 'ticket.assigned') nType = 'ASSIGNMENT';

          let bData: BroadcastData | undefined;
          if (nType === 'BROADCAST') {
            let parsedAttachments: any[] | undefined;
            if (dbN.linkUrl && typeof dbN.linkUrl === 'string' && dbN.linkUrl.startsWith('[')) {
              try {
                parsedAttachments = JSON.parse(dbN.linkUrl);
              } catch {}
            }
            bData = {
              id: dbN.id,
              title: dbN.title,
              message: dbN.body?.startsWith('📎 ') && parsedAttachments?.length ? '' : dbN.body,
              adminName: dbN.resourceType || 'Administrator',
              broadcastAt: dbN.createdAt,
              attachments: parsedAttachments,
            };
          }

          return {
            id: dbN.id,
            type: nType,
            title: dbN.title,
            message: dbN.body,
            ticketId: dbN.resourceId || '',
            linkUrl: dbN.linkUrl || (dbN.resourceId ? `/tickets/${dbN.resourceId}` : ''),
            authorName: dbN.resourceType || (nType === 'BROADCAST' ? 'Administrator' : undefined),
            createdAt: dbN.createdAt,
            isRead: dbN.status === 'READ' || Boolean(dbN.readAt),
            broadcastData: bData,
          };
        });

        // Merge DB notifications into state with broadcast deduplication and state sync
        setNotifications((prev) => {
          // If a broadcast was already marked read in local state, preserve isRead = true
          const readBroadcastMessages = new Set(
            prev.filter((p) => p.type === 'BROADCAST' && p.isRead).map((p) => p.message),
          );

          const normalizedServerNotifs = mappedServerNotifs.map((sn) => {
            if (sn.type === 'BROADCAST' && readBroadcastMessages.has(sn.message)) {
              return { ...sn, isRead: true };
            }
            return sn;
          });

          // Pop up unread broadcast if one exists and was NOT already read
          const latestUnreadBroadcast = normalizedServerNotifs.find(
            (n) => n.type === 'BROADCAST' && !n.isRead && n.broadcastData,
          );
          if (latestUnreadBroadcast?.broadcastData) {
            setTimeout(() => {
              toast.info(`📢 ${latestUnreadBroadcast.title || 'Team Announcement'}`);
              setBroadcastModalData(latestUnreadBroadcast.broadcastData!);
            }, 600);
          }

          const serverIds = new Set(normalizedServerNotifs.map((n) => n.id));
          const serverBroadcastMessages = new Set(
            normalizedServerNotifs.filter((n) => n.type === 'BROADCAST').map((n) => n.message),
          );

          const combined = [...normalizedServerNotifs];
          for (const p of prev) {
            if (serverIds.has(p.id)) continue;
            // Deduplicate broadcasts: if the same broadcast message is already in server notifications, do not add duplicate!
            if (p.type === 'BROADCAST' && serverBroadcastMessages.has(p.message)) {
              continue;
            }
            combined.push(p);
          }

          combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return combined.slice(0, 500);
        });
      })
      .catch(() => {});
  }, [user?.id]);

  // Save to localStorage on change
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {}
  }, [notifications, storageKey]);

  // Compute unread count strictly for notifications relevant to this user
  const isTenantAdmin = user?.roles?.some((r: string) => r === 'TENANT_ADMIN' || r === 'PLATFORM_ADMIN');
  const userProducts = (user?.products || []).map((p: string) => String(p).toLowerCase().trim()).filter(Boolean);
  const userProductIds = (user?.productIds || []).map((p: string) => String(p).toLowerCase().trim()).filter(Boolean);

  const scopedNotifications = notifications.filter((n) => {
    if (n.type === 'MENTION' || n.type === 'CELEBRATION' || n.type === 'BROADCAST') return true;
    if (isTenantAdmin) return true;
    if (userProducts.length > 0 || userProductIds.length > 0) {
      if (n.product) return userProducts.includes(n.product.toLowerCase().trim());
      if (n.productId) return userProductIds.includes(n.productId.toLowerCase().trim());
      // Automatically hide legacy untagged notifications for product-restricted agents
      return false;
    }
    return true;
  });

  const unreadCount = scopedNotifications.filter((n) => !n.isRead).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    ApiClient.patch(`/notifications/${id}/read`).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    ApiClient.post('/notifications/read-all').catch(() => {});
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    ApiClient.delete('/notifications').catch(() => {
      ApiClient.post('/notifications/clear-all').catch(() => {});
    });
  }, [storageKey]);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    ApiClient.delete(`/notifications/${id}`).catch(() => {});
  }, []);

  const addNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
      setNotifications((prev) => {
        // Prevent duplicate broadcast announcement with same message
        if (
          notif.type === 'BROADCAST' &&
          prev.some((p) => p.type === 'BROADCAST' && p.message === notif.message)
        ) {
          return prev;
        }

        // Prevent duplicate notification for same ticketId + type within last 4 seconds
        const isDuplicate = prev.some(
          (p) =>
            p.ticketId === notif.ticketId &&
            p.type === notif.type &&
            p.message === notif.message &&
            Math.abs(Date.now() - new Date(p.createdAt).getTime()) < 4000,
        );
        if (isDuplicate) return prev;

        const newNotif: AppNotification = {
          ...notif,
          id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: new Date().toISOString(),
          isRead: false,
        };

        return [newNotif, ...prev.slice(0, 998)];
      });
    },
    [],
  );

  const processedEventsRef = useRef<Set<string>>(new Set());

  // Real-time WebSocket Listeners for @Mentions, Replies, and Assignments
  useEffect(() => {
    if (!socket || !user) return;

    const handleTicketCommented = (data: any) => {
      if (!data?.ticketId || !data?.comment) return;

      const comment = data.comment;
      const commentId = String(comment.id || `${data.ticketId}_${comment.createdAt || Date.now()}`);

      // Deduplicate to guarantee no comment is ever processed more than once
      if (processedEventsRef.current.has(commentId)) {
        return;
      }
      processedEventsRef.current.add(commentId);

      // Clean up cache to prevent memory buildup
      if (processedEventsRef.current.size > 200) {
        const items = Array.from(processedEventsRef.current);
        processedEventsRef.current = new Set(items.slice(items.length - 100));
      }

      const commentBody = String(comment.body || '');
      const authorName = comment.author?.fullName || comment.author?.email || 'A team member';
      const isInternal = comment.visibility === 'INTERNAL';
      const ticketNum = data.ticketNumber || data.ticket?.number || data.ticketId.slice(0, 8);
      const cleanNumber = String(ticketNum).replace(/^#/, '');

      const isCurrentUserAuthor =
        comment.authorId === user.id ||
        (comment.author?.email && comment.author.email.toLowerCase() === user.email?.toLowerCase());

      // If current user is the author who just typed and sent the comment, do not notify yourself
      if (isCurrentUserAuthor) {
        return;
      }

      // Check if current user is @mentioned in the comment body
      const userFullName = (user.fullName || '').toLowerCase().trim();
      const userEmail = (user.email || '').toLowerCase().trim();

      // Check atomic mention chip attribute directly first ([data-user-id="..."], [data-user-email="..."], [data-mention="..."])
      const hasAtomicMention =
        Boolean(user.id && commentBody.includes(`data-user-id="${user.id}"`)) ||
        Boolean(userEmail && commentBody.toLowerCase().includes(`data-user-email="${userEmail}"`)) ||
        Boolean(userFullName && commentBody.toLowerCase().includes(`data-mention="${userFullName}"`)) ||
        Boolean(userEmail && commentBody.toLowerCase().includes(`data-mention="${userEmail}"`));

      // Strip atomic chips from body so inner text of another user's chip (e.g. @RAJESH L2 CB)
      // does not accidentally trigger plain-text prefix match for a shorter name (e.g. Rajesh L2)
      const bodyWithoutChips = commentBody.replace(/<span[^>]*data-mention="[^"]*"[^>]*>.*?<\/span>/gi, ' ');

      // Strip full email addresses first so typing contact@company.com never triggers mention of "company.com" or "@company"
      const bodyWithoutEmails = bodyWithoutChips.toLowerCase().replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ');

      // Strip HTML tags and entities so mention detection works cleanly on atomic chips and formatted text
      const cleanCommentText = bodyWithoutEmails
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ');

      // Strict exact match: match exact Full Name or exact Email with word boundaries. NEVER match partial first names or substrings!
      const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isMentioned =
        hasAtomicMention ||
        (userFullName && (
          new RegExp(`(?:^|[\\s(\\[{<>"'\`])@${escapeReg(userFullName)}(?:\\b|\\s|$|[)\\]}>"'\`])`, 'i').test(cleanCommentText)
        )) ||
        (userEmail && new RegExp(`(?:^|[\\s(\\[{<>"'\`])@${escapeReg(userEmail)}(?:\\b|\\s|$|[)\\]}>"'\`])`, 'i').test(cleanCommentText));

      if (isMentioned) {
        // High priority mention notification!
        const notifTitle = `💬 ${authorName} mentioned you`;
        const notifMsg = `Mentioned you in ${isInternal ? 'an internal note' : 'a reply'} on Ticket #${cleanNumber}`;

        addNotification({
          type: 'MENTION',
          title: notifTitle,
          message: notifMsg,
          ticketId: data.ticketId,
          ticketNumber: cleanNumber,
          authorName,
          authorEmail: comment.author?.email,
          authorKind: comment.author?.kind,
          isInternal,
          linkUrl: `/inbox?ticketId=${data.ticketId}`,
        });

        toast.info(`🔔 @Mention: ${authorName} tagged you on Ticket #${cleanNumber}`);
        return;
      }

      // If customer replied publicly (or a teammate replied on public ticket)
      if (comment.author?.kind === 'CUSTOMER' || comment.visibility === 'PUBLIC') {
        const prodTag = data?.ticket?.customFields?.product || data?.ticket?.product || data?.product;
        const prodId = data?.ticket?.team?.productId || data?.ticket?.productId || data?.productId;

        // Product-based scoping: Do not alert agents for comments on tickets outside their assigned products
        if (data?.ticket) {
          if (!isUserScopedToTicket(data.ticket, user)) return;
        } else if (prodTag || prodId) {
          if (!isUserScopedToTicket({ product: prodTag, productId: prodId, team: { productId: prodId } }, user)) return;
        }

        addNotification({
          type: 'REPLY',
          title: `💬 New reply on #${cleanNumber}`,
          message: `${authorName}: "${commentBody.replace(/<[^>]*>/g, '').trim().slice(0, 80)}"`,
          ticketId: data.ticketId,
          ticketNumber: cleanNumber,
          product: prodTag,
          productId: prodId,
          authorName,
          authorEmail: comment.author?.email,
          authorKind: comment.author?.kind,
          isInternal: false,
          linkUrl: `/inbox?ticketId=${data.ticketId}`,
        });

        toast.info(`💬 New reply on ticket #${cleanNumber} from ${authorName}`);
      }
    };

    const handleTicketCreated = (data: any) => {
      const incoming = data?.ticket;
      if (!incoming?.id) return;

      // Product-based scoping: Do not alert agents for products they are not assigned to
      if (!isUserScopedToTicket(incoming, user)) {
        return;
      }

      const ticketKey = `ticket_created_${incoming.id}`;
      if (processedEventsRef.current.has(ticketKey)) {
        return;
      }
      processedEventsRef.current.add(ticketKey);

      const cleanNumber = String(incoming.number || '').replace(/^#/, '');
      const prodTag = incoming.customFields?.product || incoming.product;
      const prodId = incoming.team?.productId || incoming.productId;

      addNotification({
        type: 'TICKET_CREATED',
        title: `📬 New Ticket #${cleanNumber}`,
        message: incoming.subject || 'New ticket received in queue',
        ticketId: incoming.id,
        ticketNumber: cleanNumber,
        product: prodTag,
        productId: prodId,
        authorName: incoming.requester?.fullName || incoming.requester?.email || 'Customer',
        authorEmail: incoming.requester?.email,
        isInternal: false,
        linkUrl: `/inbox?ticketId=${incoming.id}`,
      });
    };

    const handleAgentCelebrated = (data: any) => {
      if (!data?.agentId) return;

      const isTargetAgent =
        data.agentId === user.id ||
        (user.email && data.agentEmail && user.email.toLowerCase() === data.agentEmail.toLowerCase());

      const adminName = data.adminName || 'The Administrator';
      const timeframe = data.timeframeLabel || 'the selected period';
      const count = data.resolvedCount ? `${data.resolvedCount} tickets resolved` : '';

      addNotification({
        type: 'CELEBRATION',
        title: isTargetAgent ? '🎉 You were celebrated as Top Performer!' : `🎉 ${data.agentName} celebrated as Top Performer!`,
        message: isTargetAgent
          ? `${adminName} celebrated you as the Top Agent Performer for ${timeframe}${count ? ` (${count})` : ''}!`
          : `${adminName} celebrated ${data.agentName} as Top Performer for ${timeframe}.`,
        ticketId: '',
        linkUrl: '',
        authorName: adminName,
        celebrationData: data,
      });

      if (isTargetAgent) {
        toast.success(`🎉 Congratulations! ${adminName} celebrated you as Top Performer!`);
        fireCelebrationConfetti();
        setCelebrationModalData(data);
      }
    };

    const handleAgentBroadcast = (data: any) => {
      if (!data?.message && (!data?.attachments || data.attachments.length === 0)) return;

      const isTarget =
        !data.targetAgentIds ||
        data.targetAgentIds.length === 0 ||
        (user?.id && data.targetAgentIds.includes(user.id));

      if (!isTarget) return;

      const adminName = data.adminName || 'The Administrator';
      const title = data.title || `📢 Announcement from ${adminName}`;
      const notifMessage =
        data.message ||
        (data.attachments?.[0]?.name ? `📎 ${data.attachments[0].name}` : 'Attachment');

      addNotification({
        type: 'BROADCAST',
        title,
        message: notifMessage,
        ticketId: '',
        linkUrl: '',
        authorName: adminName,
        broadcastData: data,
      });

      toast.info(`📢 ${title}`);
      setBroadcastModalData(data);
    };

    socket.on('ticket.commented', handleTicketCommented);
    socket.on('ticket.created', handleTicketCreated);
    socket.on('agent.celebrated', handleAgentCelebrated);
    socket.on('agent.broadcast', handleAgentBroadcast);

    return () => {
      socket.off('ticket.commented', handleTicketCommented);
      socket.off('ticket.created', handleTicketCreated);
      socket.off('agent.celebrated', handleAgentCelebrated);
      socket.off('agent.broadcast', handleAgentBroadcast);
    };
  }, [socket, user, addNotification, toast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        deleteNotification,
        addNotification,
        openCelebration,
        openBroadcast,
      }}
    >
      {children}
      <CelebrationModal
        isOpen={Boolean(celebrationModalData)}
        onClose={() => setCelebrationModalData(null)}
        data={celebrationModalData}
      />
      <AnnouncementModal
        isOpen={Boolean(broadcastModalData)}
        onClose={() => {
          if (broadcastModalData?.id) {
            markAsRead(broadcastModalData.id);
          }
          const msgToMark =
            broadcastModalData?.message ||
            (broadcastModalData?.attachments?.[0]?.name
              ? `📎 ${broadcastModalData.attachments[0].name}`
              : '');
          if (msgToMark) {
            // 1. Mark in local state by message so any copy is marked read immediately
            setNotifications((prev) =>
              prev.map((n) =>
                n.type === 'BROADCAST' && n.message === msgToMark
                  ? { ...n, isRead: true }
                  : n,
              ),
            );
            // 2. Mark in database by broadcast message so PostgreSQL status becomes READ permanently!
            ApiClient.post('/notifications/read-broadcast', { message: msgToMark }).catch(() => {});
          }
          setBroadcastModalData(null);
        }}
        data={broadcastModalData}
      />
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
