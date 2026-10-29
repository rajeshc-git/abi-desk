import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

import { CelebrationModal, CelebrationData } from '../components/documents/CelebrationModal';
import { AnnouncementModal, BroadcastData } from '../components/documents/AnnouncementModal';
import { fireCelebrationConfetti } from '../utils/confetti';

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

  // Keep state in sync with user change
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`abidesk_notifications_${user.id}`);
      setNotifications(stored ? JSON.parse(stored) : []);
    } catch {
      setNotifications([]);
    }
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
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const addNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
      setNotifications((prev) => {
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
      if (!data?.message) return;

      const isTarget =
        !data.targetAgentIds ||
        data.targetAgentIds.length === 0 ||
        (user?.id && data.targetAgentIds.includes(user.id));

      if (!isTarget) return;

      const adminName = data.adminName || 'The Administrator';
      const title = data.title || `📢 Announcement from ${adminName}`;

      addNotification({
        type: 'BROADCAST',
        title,
        message: data.message,
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
        onClose={() => setBroadcastModalData(null)}
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
