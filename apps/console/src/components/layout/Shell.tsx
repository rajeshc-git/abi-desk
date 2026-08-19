import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSocket } from '../../context/SocketContext';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { AbiDeskWidget } from '@abi-desk/widget';
import { SearchProvider } from '../../context/SearchContext';

export const Shell: React.FC = () => {
  const { user, token, isLoading, activeBrandId, brands } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();

  // Global Real-time ticket notifications (active on all sidebar pages)
  useEffect(() => {
    if (!socket) return;

    const handleTicketCreated = (data: any) => {
      const incoming = data.ticket;
      if (!incoming) return;

      toast.info(`📬 New Ticket #${incoming.number}: ${incoming.subject}`);

      try {
        const existing: string[] = JSON.parse(localStorage.getItem('unread_ticket_ids') || '[]');
        const updated = Array.from(new Set([...existing, incoming.id]));
        localStorage.setItem('unread_ticket_ids', JSON.stringify(updated));
      } catch {}
    };

    const handleTicketCommented = (data: any) => {
      if (!data.ticketId) return;

      // Only toast for customer public replies
      if (data.comment?.author?.kind === 'CUSTOMER' || data.comment?.visibility === 'PUBLIC') {
        toast.info(`💬 New reply on ticket #${data.ticketId.slice(0, 8)}`);
      }

      try {
        const existing: string[] = JSON.parse(localStorage.getItem('unread_ticket_ids') || '[]');
        const updated = Array.from(new Set([...existing, data.ticketId]));
        localStorage.setItem('unread_ticket_ids', JSON.stringify(updated));
      } catch {}
    };

    socket.on('ticket.created', handleTicketCreated);
    socket.on('ticket.commented', handleTicketCommented);

    return () => {
      socket.off('ticket.created', handleTicketCreated);
      socket.off('ticket.commented', handleTicketCommented);
    };
  }, [socket, toast]);

  useEffect(() => {
    if (activeBrandId && brands.length > 0) {
      const activeBrand = brands.find((b) => b.id === activeBrandId);
      const pubKey = activeBrand?.widgetConfig?.publicKey;
      const adminWidgetEnabled = activeBrand?.widgetConfig?.adminWidgetEnabled ?? true;
      if (pubKey && adminWidgetEnabled) {
        // Destroy existing container to avoid duplicates
        const existing = document.getElementById('abi-desk-widget-container');
        if (existing) {
          existing.remove();
        }
        (AbiDeskWidget as any).instance = null;

        // Initialize AbiDeskWidget locally
        AbiDeskWidget.init({
          publicKey: pubKey,
          // Keep API calls same-origin so a LAN browser reaches Vite's proxy,
          // rather than trying to connect to port 4000 on its own machine.
          apiUrl: window.location.origin,
          brandName: activeBrand.name,
          primaryColor: activeBrand.primaryColor || '#2563EB',
          isAdminConsole: true,
          userToken: token || undefined,
        });
      } else {
        const existing = document.getElementById('abi-desk-widget-container');
        if (existing) {
          existing.remove();
        }
      }
    } else {
      const existing = document.getElementById('abi-desk-widget-container');
      if (existing) {
        existing.remove();
      }
    }

    return () => {
      const existing = document.getElementById('abi-desk-widget-container');
      if (existing) {
        existing.remove();
      }
    };
  }, [activeBrandId, brands, token]);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <LoadingSpinner size={32} text="Loading console workspace..." />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SearchProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="app-main">
          <Header />
          <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </SearchProvider>
  );
};
