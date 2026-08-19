import { type Socket } from 'socket.io-client';
import { ImageAnnotator } from '../media/annotator.js';
import { ScreenRecorder } from '../media/screen-recorder.js';
import { ScreenshotCapturer } from '../media/screenshot-capturer.js';
import { DirectUploader, type UploadResult } from '../media/uploader.js';
import { VoiceRecorder } from '../media/voice-recorder.js';
import { ConsoleCapturer } from '../telemetry/console-capturer.js';
import { collectDeviceDiagnostics } from '../telemetry/device-collector.js';
import { ErrorCapturer } from '../telemetry/error-capturer.js';
import { NetworkCapturer } from '../telemetry/network-capturer.js';
import { getWidgetStyles } from './styles.js';

export interface WidgetConfig {
  publicKey: string;
  apiUrl: string;
  userToken?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor?: string;
  accentColor?: string;
  brandName?: string;
  launcherLabel?: string;
  welcomeMessage?: string;
  privacyNotice?: string;
  screenshotEnabled?: boolean;
  annotationEnabled?: boolean;
  screenRecordingEnabled?: boolean;
  voiceRecordingEnabled?: boolean;
  attachmentsEnabled?: boolean;
  consoleCaptureEnabled?: boolean;
  networkCaptureEnabled?: boolean;
  errorCaptureEnabled?: boolean;
  liveChatEnabled?: boolean;
  widgetEnabled?: boolean;
  isAdminConsole?: boolean;
}

export class WidgetUI {
  private config: WidgetConfig;
  private rootEl: HTMLElement;
  private shadow: ShadowRoot;

  private uploader: DirectUploader;
  private socket: Socket | null = null;

  private isOpen = false;
  private activeTab: 'ticket' | 'chat' | 'tickets' = 'ticket';

  private attachedMedia: UploadResult[] = [];
  private currentConversationId: string | null = null;
  private isConversationClosed = false;
  private static urlCache = new Map<string, { url: string; expiresAt: number }>();

  // Widget OTP Verification properties
  private otpSentEmail: string | null = null;
  private otpError: string | null = null;
  private otpLoading = false;

  constructor(config: WidgetConfig) {
    this.config = {
      position: 'bottom-right',
      primaryColor: '#2563EB',
      accentColor: '#1E40AF',
      brandName: 'Help Desk',
      launcherLabel: 'Support',
      widgetEnabled: true,
      isAdminConsole: false,
      ...config,
    };

    this.uploader = new DirectUploader(
      this.config.apiUrl,
      this.config.publicKey,
      this.config.userToken,
    );

    this.currentConversationId = localStorage.getItem('abi-widget-chat-conv-id');
    const savedEmail = localStorage.getItem('abi-widget-user-email');
    const savedToken = localStorage.getItem('abi-widget-user-token');
    if (savedEmail && !this.config.userToken) {
      this.uploader.setWidgetUserEmail(savedEmail);
    }
    if (savedToken && !this.config.userToken) {
      this.uploader.setWidgetUserToken(savedToken);
    }

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'abi-desk-widget-container';
    this.shadow = this.rootEl.attachShadow({ mode: 'open' });

    this.mount();
  }

  private async mount() {
    document.body.appendChild(this.rootEl);
    await this.loadRemoteConfig();

    if (this.config.widgetEnabled === false && !this.config.isAdminConsole) {
      this.rootEl.remove();
      return;
    }

    this.render();
  }

  private async loadRemoteConfig() {
    try {
      const res = await fetch(
        `${this.config.apiUrl}/api/v1/auth/widget-config/${this.config.publicKey}`,
      );
      if (res.status === 403 || res.status === 401) {
        this.config.widgetEnabled = false;
        throw new Error(`Widget initialization blocked: ${res.status} (${res.statusText})`);
      }
      if (!res.ok) throw new Error('Failed to fetch widget config');
      const remote = await res.json();

      this.config = {
        ...this.config,
        brandName: remote.brandName || this.config.brandName,
        primaryColor: remote.primaryColor || this.config.primaryColor,
        accentColor: remote.accentColor || this.config.accentColor,
        position: remote.launcherPosition?.toLowerCase().replace('_', '-') || this.config.position,
        launcherLabel: remote.launcherLabel || this.config.launcherLabel || 'Support',
        welcomeMessage: remote.welcomeMessage || '',
        privacyNotice: remote.privacyNotice || '',
        screenshotEnabled: remote.screenshotEnabled ?? true,
        annotationEnabled: remote.annotationEnabled ?? true,
        screenRecordingEnabled: remote.screenRecordingEnabled ?? true,
        voiceRecordingEnabled: remote.voiceRecordingEnabled ?? true,
        attachmentsEnabled: remote.attachmentsEnabled ?? true,
        consoleCaptureEnabled: remote.consoleCaptureEnabled ?? true,
        networkCaptureEnabled: remote.networkCaptureEnabled ?? true,
        errorCaptureEnabled: remote.errorCaptureEnabled ?? true,
        liveChatEnabled: remote.liveChatEnabled ?? true,
        widgetEnabled: remote.widgetEnabled ?? true,
      };
    } catch (err) {
      console.warn('⚠️ Could not load remote widget settings, using fallback.', err);
    }
  }

  private render() {
    const savedEmail = localStorage.getItem('abi-widget-user-email');
    const savedToken = localStorage.getItem('abi-widget-user-token');
    const isVerified = !!(savedEmail && savedToken);

    this.shadow.innerHTML = `
      <style>${getWidgetStyles(this.config.primaryColor, this.config.accentColor)}</style>

      <!-- Launcher Button -->
      <button class="abi-launcher-btn ${this.config.position}" id="abi-launcher" style="display: flex; align-items: center; gap: 8px; border-radius: 24px; padding: 10px 16px; width: auto;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span style="font-weight: 600; font-size: 13px; font-family: sans-serif;">${this.config.launcherLabel}</span>
      </button>

      <!-- Main Modal Panel -->
      <div class="abi-modal-panel ${this.config.position} ${this.isOpen ? 'open' : ''}" id="abi-panel">
        <div class="abi-header">
          <div class="abi-header-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            ${this.config.brandName}
          </div>
          <button class="abi-header-close" id="abi-close-btn">&times;</button>
        </div>

        ${
          isVerified
            ? `
        <div class="abi-nav-tabs">
          <button class="abi-nav-tab ${this.activeTab === 'ticket' ? 'active' : ''}" data-tab="ticket">
            New Ticket
          </button>
          ${
            this.config.liveChatEnabled !== false
              ? `
          <button class="abi-nav-tab ${this.activeTab === 'chat' ? 'active' : ''}" data-tab="chat">
            Live Chat
          </button>
          `
              : ''
          }
          <button class="abi-nav-tab ${this.activeTab === 'tickets' ? 'active' : ''}" data-tab="tickets">
            My Tickets
          </button>
        </div>
        `
            : `
        <div class="abi-nav-tabs locked" style="pointer-events: none; opacity: 0.6;">
          <div style="font-size: 12px; font-weight: 600; color: var(--abi-text-muted); padding: 12px 16px; width: 100%; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; top: -1px;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Verification Required
          </div>
        </div>
        `
        }

        <div class="abi-content" id="abi-content">
          ${this.renderTabContent()}
        </div>
      </div>

      <!-- Annotation Studio Overlay Container -->
      <div id="abi-annotation-root"></div>
    `;

    this.bindEvents();
  }

  private renderTabContent(): string {
    const savedEmail = localStorage.getItem('abi-widget-user-email');
    const savedToken = localStorage.getItem('abi-widget-user-token');

    if (!this.config.userToken && (!savedEmail || !savedToken)) {
      return this.renderVerificationScreen();
    }

    switch (this.activeTab) {
      case 'ticket':
        return this.renderTicketForm();
      case 'chat':
        return this.renderChatView();
      case 'tickets':
        return this.renderTicketList();
    }
  }

  private renderTicketForm(): string {
    const pillsHtml = this.attachedMedia
      .map(
        (m, i) => `
        <div class="abi-media-pill">
          <span>📎 ${m.filename}</span>
          <span class="abi-pill-remove" data-index="${i}">&times;</span>
        </div>
      `,
      )
      .join('');

    const showScreenshot = this.config.screenshotEnabled !== false;
    const showScreenRecord = this.config.screenRecordingEnabled !== false;
    const showVoiceRecord = this.config.voiceRecordingEnabled !== false;
    const hasAnyMedia = showScreenshot || showScreenRecord || showVoiceRecord;

    const mediaToolbarHtml = hasAnyMedia
      ? `
        <div class="abi-media-toolbar">
          ${
            showScreenshot
              ? `
          <button type="button" class="abi-media-btn" id="abi-btn-screenshot">
            <span>📷</span>
            <span>Screenshot</span>
          </button>
          `
              : ''
          }
          ${
            showScreenRecord
              ? `
          <button type="button" class="abi-media-btn" id="abi-btn-record-screen">
            <span>🎥</span>
            <span>Screen Video</span>
          </button>
          `
              : ''
          }
          ${
            showVoiceRecord
              ? `
          <button type="button" class="abi-media-btn" id="abi-btn-record-voice">
            <span>🎙️</span>
            <span>Voice Note</span>
          </button>
          `
              : ''
          }
        </div>
    `
      : '';

    const savedEmail = localStorage.getItem('abi-widget-user-email') || '';

    return `
      <form id="abi-ticket-form">
        ${
          !this.config.userToken
            ? `
        <div class="abi-form-group">
          <label class="abi-label">Your Email Address</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="email" class="abi-input" id="abi-ticket-email" value="${savedEmail}" disabled style="font-size: 13px; background: var(--abi-surface-alt, #f8fafc); cursor: not-allowed; flex: 1;" />
            <button type="button" id="abi-change-email-btn" style="background: none; border: none; color: var(--abi-primary); font-size: 11px; font-weight: 600; cursor: pointer; padding: 4px 8px;">Change</button>
          </div>
        </div>
        `
            : ''
        }

        <div class="abi-form-group">
          <label class="abi-label">Subject</label>
          <input type="text" class="abi-input" id="abi-ticket-subject" placeholder="What can we help you with?" required />
        </div>

        <div class="abi-form-group">
          <label class="abi-label">Description</label>
          <textarea class="abi-textarea" id="abi-ticket-desc" rows="4" placeholder="Please describe the issue in detail..." required></textarea>
        </div>

        <div class="abi-form-group">
          <label class="abi-label">Priority</label>
          <select class="abi-select" id="abi-ticket-priority">
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent (Service Outage)</option>
          </select>
        </div>

        ${mediaToolbarHtml}

        <div class="abi-media-pills">
          ${pillsHtml}
        </div>

        <button type="submit" class="abi-btn-primary" id="abi-submit-ticket-btn">
          Submit Ticket
        </button>
      </form>
    `;
  }

  private renderChatView(): string {
    const savedEmail = localStorage.getItem('abi-widget-user-email');
    const hasToken = !!this.config.userToken;

    if (!hasToken && !savedEmail) {
      return `
        <div id="abi-chat-email-form" style="padding: 24px; display: flex; flex-direction: column; gap: 16px; height: 100%; justify-content: center; box-sizing: border-box;">
          <div style="text-align: center; margin-bottom: 8px;">
            <div style="font-size: 32px; margin-bottom: 8px;">💬</div>
            <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 600; color: var(--abi-text-main);">Live Chat Support</h3>
            <p style="margin: 0; font-size: 13px; color: var(--abi-text-muted);">Please enter your email to start chatting with support.</p>
          </div>
          <div class="abi-form-group">
            <label class="abi-label">Email Address *</label>
            <input type="email" class="abi-input" id="abi-chat-email-input" placeholder="you@example.com" required style="font-size: 13px;" />
          </div>
          <button class="abi-btn-primary" id="abi-chat-start-btn" style="font-size: 13px;">Start Chat</button>
        </div>
      `;
    }

    const emailBanner =
      !hasToken && savedEmail
        ? `
      <div style="padding: 8px 12px; border-bottom: 1px solid var(--abi-border); display: flex; align-items: center; justify-content: space-between; background: var(--abi-surface);">
        <span style="font-size: 12px; color: var(--abi-text-muted);">Chatting as: <strong>${savedEmail}</strong></span>
        <button id="abi-chat-change-email-btn" style="background: none; border: none; color: var(--abi-primary); font-size: 11px; cursor: pointer; padding: 2px 6px;">Change</button>
      </div>
    `
        : '';

    const inputBarHtml = this.isConversationClosed
      ? `
        <div class="abi-chat-input-bar" style="background: var(--abi-surface); border-top: 1px solid var(--abi-border); padding: 12px; display: flex; flex-direction: column; gap: 8px; align-items: center; box-sizing: border-box;">
          <span style="font-size: 12px; color: var(--abi-text-muted);">This conversation is closed.</span>
          <button class="abi-btn-primary" id="abi-chat-new-btn" style="font-size: 12px; padding: 6px 16px; width: auto; border-radius: 16px; cursor: pointer;">Start New Conversation</button>
        </div>
      `
      : `
        <div class="abi-chat-input-bar">
          <div class="abi-chat-input-wrapper">
            <input type="text" class="abi-chat-input-field" id="abi-chat-msg-input" placeholder="Message support..." autocomplete="off" />
            <button class="abi-chat-send-btn-round" id="abi-chat-send-btn">
              ↑
            </button>
          </div>
        </div>
      `;

    return `
      <div style="height: 100%; display: flex; flex-direction: column;">
        ${emailBanner}
        <div class="abi-chat-stream" id="abi-chat-stream">
          <div class="abi-chat-bubble-container" style="align-self: flex-start; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; gap: 8px; flex-direction: row; align-items: flex-end;">
              <div style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #ffffff; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); background: linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover));">
                S
              </div>
              <div class="abi-chat-msg agent">
                👋 Welcome! Start a chat and our support team will respond shortly.
              </div>
            </div>
            <div class="abi-chat-msg-meta" style="align-self: flex-start; padding-left: 32px;">
              Support Agent
            </div>
          </div>
        </div>
        ${inputBarHtml}
      </div>
    `;
  }

  private renderTicketList(): string {
    return `
      <div id="abi-my-tickets-container">
        <p style="font-size: 13px; color: var(--abi-text-muted); text-align: center; margin-top: 20px;">
          Loading your tickets...
        </p>
      </div>
    `;
  }

  private async loadMyTickets() {
    const container = this.shadow.querySelector('#abi-my-tickets-container');
    if (!container) return;

    const headers = this.getHeaders();

    try {
      const res = await fetch(
        `${this.config.apiUrl}/api/v1/tickets?pageSize=20&sortBy=createdAt&sortDir=desc`,
        {
          headers,
        },
      );

      if (!res.ok) {
        container.innerHTML = `
          <div style="text-align: center; padding: 30px 16px;">
            <div style="font-size: 28px; margin-bottom: 8px;">🔒</div>
            <p style="font-size: 13px; color: var(--abi-text-muted); margin: 0;">
              Sign in to view your tickets.
            </p>
          </div>
        `;
        return;
      }

      const data = await res.json();
      const tickets = data.tickets || data.data || data.items || data || [];

      const savedEmail = localStorage.getItem('abi-widget-user-email');
      const emailHeaderHtml =
        !this.config.userToken && savedEmail
          ? `
        <div style="padding: 8px 12px; margin-bottom: 8px; border-bottom: 1px solid var(--abi-border); display: flex; align-items: center; justify-content: space-between; background: var(--abi-surface);">
          <span style="font-size: 11px; color: var(--abi-text-muted);">Tickets for: <strong>${savedEmail}</strong></span>
          <button id="abi-tickets-change-email-btn" style="background: none; border: none; color: var(--abi-primary); font-size: 11px; cursor: pointer; padding: 2px 6px;">Change</button>
        </div>
      `
          : '';

      if (!Array.isArray(tickets) || tickets.length === 0) {
        container.innerHTML = `
          ${emailHeaderHtml}
          <div style="text-align: center; padding: 30px 16px;">
            <div style="font-size: 28px; margin-bottom: 8px;">📭</div>
            <p style="font-size: 13px; color: var(--abi-text-muted); margin: 0 0 4px;">
              No tickets yet
            </p>
            <p style="font-size: 12px; color: var(--abi-text-muted); margin: 0;">
              Submit a ticket from the <strong>New Ticket</strong> tab.
            </p>
          </div>
        `;
        this.shadow
          .querySelector('#abi-tickets-change-email-btn')
          ?.addEventListener('click', () => {
            localStorage.removeItem('abi-widget-user-email');
            this.loadMyTickets();
          });
        return;
      }

      container.innerHTML = `
        ${emailHeaderHtml}
        <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px 0;">
          ${tickets
            .map((t: any) => {
              const statusColor = this.getStatusColor(t.status);
              const priorityIcon = this.getPriorityIcon(t.priority);
              const timeAgo = this.timeAgo(t.createdAt);
              return `
              <div class="abi-ticket-card" data-ticket-id="${t.id}" style="
                padding: 12px;
                border: 1px solid var(--abi-border);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.15s ease;
                background: var(--abi-bg);
              ">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--abi-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      Ticket #${t.number}
                    </div>
                    <div style="font-size: 11px; color: var(--abi-text-muted); margin-top: 3px;">
                      ${timeAgo}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <span style="font-size: 11px;" title="${t.priority}">${priorityIcon}</span>
                    <span style="
                      font-size: 10px;
                      font-weight: 600;
                      padding: 2px 7px;
                      border-radius: 6px;
                      background: ${statusColor.bg};
                      color: ${statusColor.text};
                      white-space: nowrap;
                      text-transform: uppercase;
                      letter-spacing: 0.3px;
                    ">${this.formatStatus(t.status)}</span>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;

      // Bind click events on ticket cards
      container.querySelectorAll('.abi-ticket-card').forEach((card) => {
        card.addEventListener('click', () => {
          const ticketId = card.getAttribute('data-ticket-id');
          if (ticketId) this.loadTicketDetail(ticketId);
        });
        card.addEventListener('mouseenter', () => {
          (card as HTMLElement).style.background = 'var(--abi-surface)';
          (card as HTMLElement).style.borderColor = 'var(--abi-primary)';
        });
        card.addEventListener('mouseleave', () => {
          (card as HTMLElement).style.background = 'var(--abi-bg)';
          (card as HTMLElement).style.borderColor = 'var(--abi-border)';
        });
      });

      this.shadow.querySelector('#abi-tickets-change-email-btn')?.addEventListener('click', () => {
        localStorage.removeItem('abi-widget-user-email');
        this.loadMyTickets();
      });
    } catch {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px 16px;">
          <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
          <p style="font-size: 13px; color: var(--abi-text-muted); margin: 0;">
            Could not load tickets. Please try again.
          </p>
        </div>
      `;
    }
  }

  private async loadTicketDetail(ticketId: string) {
    const container = this.shadow.querySelector('#abi-my-tickets-container');
    if (!container) return;

    container.innerHTML = `
      <p style="font-size: 13px; color: var(--abi-text-muted); text-align: center; margin-top: 20px;">
        Loading ticket...
      </p>
    `;

    const headers = this.getHeaders();

    try {
      const [ticketRes, timelineRes] = await Promise.all([
        fetch(`${this.config.apiUrl}/api/v1/tickets/${ticketId}`, { headers }),
        fetch(`${this.config.apiUrl}/api/v1/tickets/${ticketId}/timeline`, { headers }),
      ]);

      if (!ticketRes.ok) throw new Error('Failed to load ticket');

      const ticket = await ticketRes.json();
      const timeline = timelineRes.ok ? await timelineRes.json() : [];
      const statusColor = this.getStatusColor(ticket.status);
      const priorityIcon = this.getPriorityIcon(ticket.priority);

      const timelineItems = Array.isArray(timeline)
        ? timeline
        : timeline.events || timeline.data || [];

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%;">
          <!-- Back button -->
          <button id="abi-back-to-list" style="
            background: none; border: none; cursor: pointer; padding: 6px 0; margin-bottom: 8px;
            font-size: 12px; color: var(--abi-primary); font-weight: 600; text-align: left;
            font-family: inherit;
          ">← Back to tickets</button>

          <!-- Ticket header -->
          <div style="margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="font-size: 12px;">${priorityIcon}</span>
              <span style="font-size: 15px; font-weight: 700; color: var(--abi-text-main);">Ticket #${ticket.number}</span>
              <span style="
                font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 6px;
                background: ${statusColor.bg}; color: ${statusColor.text};
                text-transform: uppercase; letter-spacing: 0.3px;
              ">${this.formatStatus(ticket.status)}</span>
            </div>

            ${
              ticket.status === 'AWAITING_CUSTOMER_CONFIRMATION'
                ? `
            <div id="abi-confirmation-card" style="
              background: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 8px;
              padding: 12px;
              margin: 12px 0 6px 0;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            ">
              <div style="font-size: 12px; font-weight: 700; color: #b45309; margin-bottom: 4px;">Resolution Proposed</div>
              <div style="font-size: 11px; color: #78350f; line-height: 1.4; margin-bottom: 8px;">
                An agent has proposed a resolution. Please confirm if this resolves your issue:
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="abi-btn-confirm-resolve" style="
                  background: #10b981; color: #ffffff; border: none; border-radius: 4px;
                  padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer;
                  font-family: inherit; transition: background 0.15s;
                ">Yes, Close Ticket</button>
                <button id="abi-btn-reopen-ticket" style="
                  background: #ef4444; color: #ffffff; border: none; border-radius: 4px;
                  padding: 6px 12px; font-size: 11px; font-weight: 600; cursor: pointer;
                  font-family: inherit; transition: background 0.15s;
                ">No, Reopen</button>
              </div>
            </div>
            `
                : ''
            }
            ${
              ticket.subject && ticket.channel !== 'CHAT'
                ? `
            <div style="
              background: var(--abi-surface-alt, #f8fafc);
              border: 1px solid var(--abi-border);
              border-radius: 6px;
              padding: 8px 12px;
              margin: 10px 0 6px 0;
            ">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--abi-text-muted); font-weight: 600; margin-bottom: 2px;">Subject</div>
              <div style="font-size: 13px; font-weight: 600; color: var(--abi-text-main); line-height: 1.4;">
                ${this.escapeHtml(ticket.subject)}
              </div>
            </div>
            `
                : ''
            }

            ${
              ticket.channel !== 'CHAT' && ticket.description
                ? `
            <div style="font-size: 12px; color: var(--abi-text-muted); margin-top: 4px; line-height: 1.5;">
              ${this.formatCommentBody(ticket.description)}
            </div>
            `
                : ''
            }
            ${
              ticket.mediaAssets && ticket.mediaAssets.length > 0
                ? `
              <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--abi-border); padding-top: 8px;">
                ${ticket.mediaAssets
                  .map(
                    (att: any) => `
                  <div class="abi-media-container" data-media-id="${att.id}" data-filename="${this.escapeHtml(att.originalFilename)}" data-mime-type="${this.escapeHtml(att.mimeType)}" data-is-customer="false">
                    <button class="abi-attachment-btn" data-media-id="${att.id}" style="
                      display: inline-flex;
                      align-items: center;
                      gap: 6px;
                      padding: 4px 8px;
                      border: 1px solid var(--abi-border);
                      border-radius: 4px;
                      background: var(--abi-surface-alt, #f8fafc);
                      font-size: 11px;
                      color: var(--abi-text-main);
                      cursor: pointer;
                      font-family: inherit;
                      width: fit-content;
                    ">
                      <span>📎</span>
                      <span style="text-decoration: underline;">${this.escapeHtml(att.originalFilename)}</span>
                    </button>
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>

          <!-- Timeline -->
          <div style="flex: 1; overflow-y: auto; border-top: 1px solid var(--abi-border); padding-top: 10px; display: flex; flex-direction: column;">
            <div style="font-size: 11px; font-weight: 600; color: var(--abi-text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
              Activity History
            </div>
            ${
              timelineItems.length === 0
                ? `
              <p style="font-size: 12px; color: var(--abi-text-muted); text-align: center;">No activity yet.</p>
            `
                : timelineItems
                    .map((event: any) => {
                      if (event.type !== 'COMMENT') {
                        return `
                  <div style="text-align: center; font-size: 11px; color: var(--abi-text-muted); padding: 6px 0; margin-bottom: 8px; width: 100%;">
                    ── ${this.escapeHtml(event.summary || event.type || 'Activity')} ──
                  </div>
                `;
                      }

                      if (event.visibility === 'INTERNAL') {
                        return '';
                      }

                      const body = event.body || '';

                      // Chat transcript comments render directly as parsed bubbles (no outer wrapper)
                      if (
                        body.includes('### Chat Transcript') ||
                        body.includes('Chat Transcript (')
                      ) {
                        return `
                  <div style="width: 100%; margin-bottom: 12px;">
                    ${this.formatChatTranscript(body)}
                  </div>
                `;
                      }

                      const isCustomer = event.actor?.kind === 'CUSTOMER';
                      const actorName =
                        event.actor?.fullName ||
                        event.actorName ||
                        (isCustomer ? 'You' : 'Support Agent');
                      const initials = actorName.charAt(0).toUpperCase() || 'S';

                      return `
                <div class="abi-chat-bubble-container" style="
                  align-self: ${isCustomer ? 'flex-end' : 'flex-start'};
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                  margin-bottom: 12px;
                  width: 100%;
                  max-width: 90%;
                  margin-${isCustomer ? 'left' : 'right'}: auto;
                ">
                  <div style="
                    display: flex;
                    gap: 8px;
                    flex-direction: ${isCustomer ? 'row-reverse' : 'row'};
                    align-items: flex-end;
                  ">
                    <div style="
                      width: 24px;
                      height: 24px;
                      border-radius: 50%;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 9px;
                      font-weight: 700;
                      color: #ffffff;
                      flex-shrink: 0;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                      background: ${isCustomer ? 'linear-gradient(135deg, #64748b, #475569)' : 'linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover))'};
                    ">
                      ${initials}
                    </div>
                    <div class="abi-chat-msg ${isCustomer ? 'customer' : 'agent'}" style="
                      border-radius: ${isCustomer ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
                      max-width: 85%;
                      text-align: left;
                    ">
                      ${this.formatCommentBody(body)}
                      ${
                        event.attachments && event.attachments.length > 0
                          ? `
                        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed ${isCustomer ? 'rgba(255,255,255,0.3)' : 'var(--abi-border)'}; padding-top: 8px; width: 100%;">
                          ${event.attachments
                            .map(
                              (att: any) => `
                            <div class="abi-media-container" data-media-id="${att.id}" data-filename="${this.escapeHtml(att.originalFilename)}" data-mime-type="${this.escapeHtml(att.mimeType)}" data-is-customer="${isCustomer ? 'true' : 'false'}" style="width: 100%;">
                              <button class="abi-attachment-btn" data-media-id="${att.id}" style="
                                display: inline-flex;
                                align-items: center;
                                gap: 6px;
                                padding: 4px 8px;
                                border: 1px solid ${isCustomer ? 'rgba(255,255,255,0.2)' : 'var(--abi-border)'};
                                border-radius: 4px;
                                background: ${isCustomer ? 'rgba(255,255,255,0.1)' : 'var(--abi-surface-alt, #f8fafc)'};
                                font-size: 11px;
                                color: ${isCustomer ? '#ffffff' : 'var(--abi-text-main)'};
                                cursor: pointer;
                                font-family: inherit;
                                width: fit-content;
                              ">
                                <span>📎</span>
                                <span style="text-decoration: underline;">${this.escapeHtml(att.originalFilename)}</span>
                              </button>
                            </div>
                          `,
                            )
                            .join('')}
                        </div>
                      `
                          : ''
                      }
                    </div>
                  </div>
                  <div class="abi-chat-msg-meta" style="
                    align-self: ${isCustomer ? 'flex-end' : 'flex-start'};
                    padding-left: ${isCustomer ? '0' : '32px'};
                    padding-right: ${isCustomer ? '32px' : '0'};
                  ">
                    ${this.escapeHtml(actorName)} · ${this.timeAgo(event.createdAt)}
                  </div>
                </div>
              `;
                    })
                    .join('')
            }
          </div>
        </div>
      `;

      this.shadow.querySelector('#abi-back-to-list')?.addEventListener('click', () => {
        this.render();
        this.loadMyTickets();
      });

      if (ticket.status === 'AWAITING_CUSTOMER_CONFIRMATION') {
        const confirmBtn = container.querySelector('#abi-btn-confirm-resolve');
        const reopenBtn = container.querySelector('#abi-btn-reopen-ticket');

        confirmBtn?.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to mark this ticket as resolved and close it?'))
            return;
          try {
            (confirmBtn as HTMLButtonElement).textContent = 'Processing...';
            (confirmBtn as HTMLButtonElement).disabled = true;
            if (reopenBtn) (reopenBtn as HTMLButtonElement).disabled = true;

            const res = await fetch(`${this.config.apiUrl}/api/v1/tickets/${ticketId}/confirm`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ confirmed: true }),
            });

            if (!res.ok) throw new Error();

            // Reload ticket detail
            this.loadTicketDetail(ticketId);
          } catch {
            alert('Failed to confirm resolution. Please try again.');
            (confirmBtn as HTMLButtonElement).textContent = 'Yes, Close Ticket';
            (confirmBtn as HTMLButtonElement).disabled = false;
            if (reopenBtn) (reopenBtn as HTMLButtonElement).disabled = false;
          }
        });

        reopenBtn?.addEventListener('click', async () => {
          const comment = prompt('Please enter a reason for reopening this ticket:');
          if (comment === null) return; // User cancelled
          const trimmedComment = comment.trim();
          if (!trimmedComment) {
            alert('A comment is required to reopen the ticket.');
            return;
          }

          try {
            (reopenBtn as HTMLButtonElement).textContent = 'Reopening...';
            (reopenBtn as HTMLButtonElement).disabled = true;
            if (confirmBtn) (confirmBtn as HTMLButtonElement).disabled = true;

            const res = await fetch(`${this.config.apiUrl}/api/v1/tickets/${ticketId}/confirm`, {
              method: 'POST',
              headers: {
                ...headers,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ confirmed: false, comment: trimmedComment }),
            });

            if (!res.ok) throw new Error();

            // Reload ticket detail
            this.loadTicketDetail(ticketId);
          } catch {
            alert('Failed to reopen ticket. Please try again.');
            (reopenBtn as HTMLButtonElement).textContent = 'No, Reopen';
            (reopenBtn as HTMLButtonElement).disabled = false;
            if (confirmBtn) (confirmBtn as HTMLButtonElement).disabled = false;
          }
        });
      }

      container.querySelectorAll('.abi-attachment-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const mediaId = btn.getAttribute('data-media-id');
          if (!mediaId) return;
          try {
            const headers = this.getHeaders();
            const res = await fetch(`${this.config.apiUrl}/api/v1/media/${mediaId}/download`, {
              method: 'POST',
              headers,
            });
            if (!res.ok) throw new Error();
            const { url } = await res.json();
            window.open(url, '_blank');
          } catch {
            alert('Failed to download file. Please try again.');
          }
        });
      });

      // Load media previews (images, videos, audio) asynchronously
      this.loadMediaPreviews(container);
    } catch {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px 16px;">
          <div style="font-size: 28px; margin-bottom: 8px;">⚠️</div>
          <p style="font-size: 13px; color: var(--abi-text-muted); margin: 0;">
            Could not load ticket details.
          </p>
          <button id="abi-back-to-list-err" style="
            background: none; border: none; cursor: pointer; margin-top: 8px;
            font-size: 12px; color: var(--abi-primary); font-weight: 600;
            font-family: inherit;
          ">← Back to tickets</button>
        </div>
      `;
      this.shadow.querySelector('#abi-back-to-list-err')?.addEventListener('click', () => {
        this.render();
        this.loadMyTickets();
      });
    }
  }

  private async loadMediaPreviews(container: Element) {
    const mediaContainers = container.querySelectorAll('.abi-media-container');
    const headers = this.getHeaders();

    // Use IntersectionObserver to lazy load media attachments
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            observer.unobserve(el);
            this.resolveSingleMediaPreview(el, headers);
          }
        });
      },
      {
        root: container,
        rootMargin: '100px', // Load ahead of time (100px before scrolling into view)
        threshold: 0.01,
      },
    );

    mediaContainers.forEach((el) => {
      const mimeType = el.getAttribute('data-mime-type') || '';
      const isImage = mimeType.startsWith('image/');
      const isVideo = mimeType.startsWith('video/');
      const isAudio = mimeType.startsWith('audio/');

      if (isImage || isVideo || isAudio) {
        // Show animated skeleton loader while waiting to scroll into view
        const isCustomer = el.getAttribute('data-is-customer') === 'true';
        el.innerHTML = `
          <div class="abi-media-skeleton" style="
            margin-top: 4px;
            width: ${isImage ? '180px' : '220px'};
            height: ${isAudio ? '54px' : '100px'};
            border-radius: 6px;
            background: ${isCustomer ? 'rgba(255, 255, 255, 0.15)' : 'var(--abi-surface-alt, #f1f5f9)'};
            border: 1px solid ${isCustomer ? 'rgba(255, 255, 255, 0.1)' : 'var(--abi-border)'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isCustomer ? 'rgba(255, 255, 255, 0.4)' : 'var(--abi-text-muted)'};
            font-size: 11px;
            position: relative;
            overflow: hidden;
          ">
            <style>
              @keyframes abi-shimmer {
                0% { background-position: -200px 0; }
                100% { background-position: 200px 0; }
              }
            </style>
            <div style="
              position: absolute; top: 0; left: 0; right: 0; bottom: 0;
              background: linear-gradient(90deg, transparent, ${isCustomer ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'}, transparent);
              background-size: 200px 100%;
              animation: abi-shimmer 1.5s infinite linear;
            "></div>
            <span>${isImage ? '🖼️ Loading Image...' : isVideo ? '📹 Loading Video...' : '🎙️ Loading Audio...'}</span>
          </div>
        `;
        observer.observe(el);
      }
    });
  }

  private async resolveSingleMediaPreview(el: Element, headers: any) {
    const mediaId = el.getAttribute('data-media-id');
    const mimeType = el.getAttribute('data-mime-type') || '';
    const filename = el.getAttribute('data-filename') || '';
    const isCustomer = el.getAttribute('data-is-customer') === 'true';

    if (!mediaId) return;

    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');

    try {
      let url = '';
      const cached = WidgetUI.urlCache.get(mediaId);

      // Check cache validity (expires in 10 minutes)
      if (cached && cached.expiresAt > Date.now()) {
        url = cached.url;
      } else {
        const res = await fetch(`${this.config.apiUrl}/api/v1/media/${mediaId}/download`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        url = data.url;

        // Cache the URL (expires in 9 minutes to be safe)
        WidgetUI.urlCache.set(mediaId, {
          url,
          expiresAt: Date.now() + 9 * 60 * 1000,
        });
      }

      if (isImage) {
        el.innerHTML = `
          <div style="margin-top: 4px; max-width: 100%; animation: abi-fade-in 0.2s ease;">
            <style>
              @keyframes abi-fade-in { from { opacity: 0; } to { opacity: 1; } }
            </style>
            <img src="${url}" alt="${this.escapeHtml(filename)}" style="
              max-width: 180px;
              max-height: 120px;
              border-radius: 6px;
              border: 1px solid ${isCustomer ? 'rgba(255,255,255,0.2)' : 'var(--abi-border)'};
              box-shadow: 0 2px 4px rgba(0,0,0,0.08);
              cursor: pointer;
              object-fit: cover;
              display: block;
              transition: transform 0.15s ease, box-shadow 0.15s ease;
            " class="abi-lightbox-trigger" />
            <div style="font-size: 10px; color: ${isCustomer ? 'rgba(255,255,255,0.7)' : 'var(--abi-text-muted)'}; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
              <span>🖼️ ${this.escapeHtml(filename)}</span>
            </div>
          </div>
        `;

        const img = el.querySelector('.abi-lightbox-trigger') as HTMLElement;
        img.addEventListener('mouseenter', () => {
          img.style.transform = 'scale(1.02)';
          img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
        });
        img.addEventListener('mouseleave', () => {
          img.style.transform = 'scale(1)';
          img.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
        });
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openLightbox(url, filename);
        });
      } else if (isVideo) {
        el.innerHTML = `
          <div style="margin-top: 4px; width: 100%; max-width: 220px; animation: abi-fade-in 0.2s ease;">
            <video src="${url}" controls style="
              width: 100%;
              max-height: 140px;
              border-radius: 6px;
              border: 1px solid ${isCustomer ? 'rgba(255,255,255,0.2)' : 'var(--abi-border)'};
              box-shadow: 0 2px 4px rgba(0,0,0,0.08);
              background: #000000;
              display: block;
            "></video>
            <div style="font-size: 10px; color: ${isCustomer ? 'rgba(255,255,255,0.7)' : 'var(--abi-text-muted)'}; margin-top: 4px;">
              <span>📹 ${this.escapeHtml(filename)}</span>
            </div>
          </div>
        `;
      } else if (isAudio) {
        el.innerHTML = `
          <div style="margin-top: 4px; width: 100%; max-width: 220px; animation: abi-fade-in 0.2s ease;">
            <audio src="${url}" controls style="
              width: 100%;
              display: block;
            "></audio>
            <div style="font-size: 10px; color: ${isCustomer ? 'rgba(255,255,255,0.7)' : 'var(--abi-text-muted)'}; margin-top: 4px;">
              <span>🎙️ ${this.escapeHtml(filename)}</span>
            </div>
          </div>
        `;
      }
    } catch (err) {
      // Error Fallback: Show original download button with retry
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
          <button class="abi-attachment-btn" data-media-id="${mediaId}" style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border: 1px solid ${isCustomer ? 'rgba(255,255,255,0.2)' : 'var(--abi-border)'};
            border-radius: 4px;
            background: ${isCustomer ? 'rgba(255,255,255,0.1)' : 'var(--abi-surface-alt, #f8fafc)'};
            font-size: 11px;
            color: ${isCustomer ? '#ffffff' : 'var(--abi-text-main)'};
            cursor: pointer;
            font-family: inherit;
            width: fit-content;
          ">
            <span>⚠️</span>
            <span style="text-decoration: underline;">Failed to load preview (Download)</span>
          </button>
          <button class="abi-preview-retry-btn" style="
            background: none; border: none; font-size: 9px; cursor: pointer; text-align: left;
            color: ${isCustomer ? 'rgba(255,255,255,0.8)' : 'var(--abi-primary)'}; padding: 2px 4px; width: fit-content;
          ">🔄 Retry loading preview</button>
        </div>
      `;

      el.querySelector('.abi-preview-retry-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resolveSingleMediaPreview(el, headers);
      });
      el.querySelector('.abi-attachment-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch(`${this.config.apiUrl}/api/v1/media/${mediaId}/download`, {
            method: 'POST',
            headers,
          });
          const { url } = await res.json();
          window.open(url, '_blank');
        } catch {
          alert('Failed to download file.');
        }
      });
    }
  }

  private openLightbox(url: string, filename: string) {
    // If there is already an existing lightbox, remove it
    this.shadow.querySelector('#abi-lightbox-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'abi-lightbox-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 200000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(4px);
      box-sizing: border-box;
      animation: abi-fade-in 0.2s ease;
    `;

    overlay.innerHTML = `
      <style>
        @keyframes abi-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes abi-scale-in { from { transform: scale(0.95); } to { transform: scale(1); } }
      </style>
      <div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 12px; z-index: 200010;">
        <a href="${url}" download="${this.escapeHtml(filename)}" target="_blank" style="
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.15s;
        ">
          📥 Download
        </a>
        <button id="abi-lightbox-close" style="
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: #ffffff;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 20px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        ">&times;</button>
      </div>
      <img src="${url}" alt="${this.escapeHtml(filename)}" style="
        max-width: 100%;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        animation: abi-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      " />
      <div style="
        margin-top: 12px;
        color: #ffffff;
        font-size: 13px;
        font-family: sans-serif;
        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
      ">${this.escapeHtml(filename)}</div>
    `;

    this.shadow.appendChild(overlay);

    const closeBtn = overlay.querySelector('#abi-lightbox-close');
    const closeOverlay = () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.15s ease';
      setTimeout(() => overlay.remove(), 150);
    };

    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOverlay();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeOverlay();
      }
    });

    // Add keydown escape listener
    const escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeOverlay();
        document.removeEventListener('keydown', escListener);
      }
    };
    document.addEventListener('keydown', escListener);
  }

  private getStatusColor(status: string): { bg: string; text: string } {
    const map: Record<string, { bg: string; text: string }> = {
      NEW: { bg: '#dbeafe', text: '#1e40af' },
      TRIAGE: { bg: '#e0e7ff', text: '#3730a3' },
      OPEN: { bg: '#dcfce7', text: '#166534' },
      PENDING_CUSTOMER: { bg: '#fef9c3', text: '#854d0e' },
      ON_HOLD: { bg: '#f3e8ff', text: '#6b21a8' },
      ESCALATED_L2: { bg: '#ffedd5', text: '#9a3412' },
      ESCALATED_L3: { bg: '#fee2e2', text: '#991b1b' },
      IN_DEVELOPMENT: { bg: '#cffafe', text: '#155e75' },
      IN_QA: { bg: '#e0f2fe', text: '#075985' },
      RESOLVED: { bg: '#d1fae5', text: '#065f46' },
      CLOSED: { bg: '#f1f5f9', text: '#475569' },
      REOPENED: { bg: '#fef3c7', text: '#92400e' },
      CANCELLED: { bg: '#f1f5f9', text: '#64748b' },
    };
    return map[status] || { bg: '#f1f5f9', text: '#475569' };
  }

  private getPriorityIcon(priority: string): string {
    const map: Record<string, string> = {
      LOW: '🟢',
      NORMAL: '🔵',
      HIGH: '🟠',
      URGENT: '🔴',
      CRITICAL: '🔥',
    };
    return map[priority] || '⚪';
  }

  private formatStatus(status: string): string {
    return status.replace(/_/g, ' ').replace(/L(\d)/g, 'L$1');
  }

  private timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private formatCommentBody(body: string): string {
    if (!body) return '';

    // Detect chat transcript comments and render as beautiful bubbles
    if (body.includes('### Chat Transcript') || body.includes('Chat Transcript (')) {
      return this.formatChatTranscript(body);
    }

    // First, escape HTML to prevent XSS
    let html = this.escapeHtml(body);

    // Parse code blocks: ```\n(content)\n```
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
      return `<pre style="
        background: var(--abi-surface-alt, #f8fafc);
        border: 1px solid var(--abi-border, #e2e8f0);
        padding: 8px 10px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        line-height: 1.5;
        margin: 8px 0;
        overflow-x: auto;
        white-space: pre-wrap;
        color: var(--abi-text-main, #334155);
      ">${code.trim()}</pre>`;
    });

    // Parse headers: ### Text
    html = html.replace(/###\s+(.+?)(\n|$)/g, (_, title) => {
      return `<h4 style="margin: 8px 0 4px; font-size: 13px; font-weight: 700; color: var(--abi-text-main);">${title}</h4>`;
    });

    // Parse bold: **Text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Parse single backticks: `code`
    html = html.replace(
      /`([^`]+)`/g,
      '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 11px;">$1</code>',
    );

    // Convert newlines (outside of <pre> blocks) to <br>
    const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
    const processedParts = parts.map((part) => {
      if (part.startsWith('<pre')) {
        return part;
      }
      return part.replace(/\n/g, '<br>');
    });

    return processedParts.join('');
  }

  /**
   * Parses a raw chat transcript markdown comment into beautiful side-by-side
   * chat bubbles, matching the live chat UX. Detects lines like:
   *   [2026-08-11T06:37:40.524Z] Rajeshchusa: hi
   */
  private formatChatTranscript(body: string): string {
    // Extract the transcript title
    const titleMatch = body.match(/###\s*Chat Transcript\s*\(([^)]*)\)/);
    const title = titleMatch && titleMatch[1] ? titleMatch[1] : 'Live Chat';

    // Extract lines from code block
    const codeBlockMatch = body.match(/```([\s\S]*?)```/);
    const rawLines =
      codeBlockMatch && codeBlockMatch[1] ? codeBlockMatch[1].trim().split('\n') : [];

    // Parse each transcript line: [timestamp] Author: message
    const messages: Array<{ time: string; author: string; text: string; isSystem: boolean }> = [];
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
      // Fallback: render as escaped text
      return this.escapeHtml(body).replace(/\n/g, '<br>');
    }

    // Determine customer name (first non-System, non-agent message author)
    // We consider the widget user as the customer
    const customerName = messages.find((m) => !m.isSystem)?.author || '';

    let html = `
      <div style="
        border: 1px solid var(--abi-border, #e2e8f0);
        border-radius: 12px;
        overflow: hidden;
        background: var(--abi-surface, #f8fafc);
      ">
        <div style="
          padding: 8px 12px;
          background: linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover));
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span style="font-size: 13px;">💬</span>
          <span style="font-size: 11px; font-weight: 600; color: #ffffff; letter-spacing: 0.3px;">
            ${this.escapeHtml(title)}
          </span>
        </div>
        <div style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
    `;

    for (const msg of messages) {
      if (msg.isSystem) {
        html += `
          <div style="text-align: center; font-size: 10px; color: var(--abi-text-muted); padding: 4px 0;">
            ${this.escapeHtml(msg.text)}
          </div>
        `;
        continue;
      }

      const isCustomer = msg.author === customerName;
      const initials = msg.author.charAt(0).toUpperCase();
      const timeStr = this.timeAgo(msg.time);

      html += `
        <div style="
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-self: ${isCustomer ? 'flex-end' : 'flex-start'};
          max-width: 85%;
        ">
          <div style="
            display: flex;
            gap: 6px;
            flex-direction: ${isCustomer ? 'row-reverse' : 'row'};
            align-items: flex-end;
          ">
            <div style="
              width: 20px;
              height: 20px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              font-weight: 700;
              color: #ffffff;
              flex-shrink: 0;
              background: ${isCustomer ? 'linear-gradient(135deg, #64748b, #475569)' : 'linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover))'};
            ">
              ${initials}
            </div>
            <div style="
              padding: 8px 12px;
              font-size: 12px;
              line-height: 1.4;
              border-radius: ${isCustomer ? '14px 14px 3px 14px' : '14px 14px 14px 3px'};
              ${
                isCustomer
                  ? 'background: linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover)); color: #ffffff; box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.18);'
                  : 'background: #ffffff; border: 1px solid #f1f5f9; color: var(--abi-text-main); box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.02);'
              }
            ">
              ${this.escapeHtml(msg.text)}
            </div>
          </div>
          <div style="
            font-size: 9px;
            color: var(--abi-text-muted);
            opacity: 0.7;
            padding-${isCustomer ? 'right' : 'left'}: 26px;
            text-align: ${isCustomer ? 'right' : 'left'};
          ">
            ${this.escapeHtml(msg.author)} · ${timeStr}
          </div>
        </div>
      `;
    }

    html += '</div></div>';
    return html;
  }

  private bindEvents() {
    const launcher = this.shadow.querySelector('#abi-launcher');
    const closeBtn = this.shadow.querySelector('#abi-close-btn');

    launcher?.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.close());

    // OTP send/verify handlers
    const sendOtpBtn = this.shadow.querySelector('#abi-otp-send-btn');
    sendOtpBtn?.addEventListener('click', async () => {
      const emailInput = this.shadow.querySelector('#abi-otp-email-input') as HTMLInputElement;
      const email = emailInput?.value?.trim();
      if (!email || !email.includes('@')) {
        this.otpError = 'Please enter a valid email address.';
        this.render();
        return;
      }
      this.otpLoading = true;
      this.otpError = null;
      this.render();
      try {
        const res = await fetch(`${this.config.apiUrl}/api/v1/auth/widget/otp/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, publicKey: this.config.publicKey }),
        });
        if (!res.ok) {
          const errText = await res.text();
          let msg = 'Failed to send OTP.';
          try {
            const parsed = JSON.parse(errText);
            msg = parsed.message || msg;
          } catch {
            msg = errText || msg;
          }
          throw new Error(msg);
        }
        this.otpSentEmail = email;
      } catch (err) {
        this.otpError = err instanceof Error ? err.message : 'Failed to send OTP.';
      } finally {
        this.otpLoading = false;
        this.render();
      }
    });

    const verifyOtpBtn = this.shadow.querySelector('#abi-otp-verify-btn');
    verifyOtpBtn?.addEventListener('click', async () => {
      const digitInputs = this.shadow.querySelectorAll('.abi-otp-digit');
      let otp = '';
      digitInputs.forEach((input: any) => {
        otp += input.value.trim();
      });

      if (!otp || otp.length !== 4) {
        this.otpError = 'Please enter the 4-digit code.';
        this.render();
        return;
      }
      this.otpLoading = true;
      this.otpError = null;
      this.render();
      try {
        const res = await fetch(`${this.config.apiUrl}/api/v1/auth/widget/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.otpSentEmail, publicKey: this.config.publicKey, otp }),
        });
        if (!res.ok) {
          const errText = await res.text();
          let msg = 'Failed to verify code.';
          try {
            const parsed = JSON.parse(errText);
            msg = parsed.message || msg;
          } catch {
            msg = errText || msg;
          }
          throw new Error(msg);
        }
        const data = await res.json();
        localStorage.setItem('abi-widget-user-email', data.email);
        localStorage.setItem('abi-widget-user-token', data.token);
        this.uploader.setWidgetUserEmail(data.email);
        this.uploader.setWidgetUserToken(data.token);
        this.otpSentEmail = null;
        this.otpError = null;
        this.activeTab = 'ticket';
      } catch (err) {
        this.otpError = err instanceof Error ? err.message : 'Invalid code.';
      } finally {
        this.otpLoading = false;
        this.render();
      }
    });

    // Wire up digit inputs behaviors (focus, input advance, backspace retreat, paste)
    const otpContainer = this.shadow.querySelector('#abi-otp-inputs-container');
    if (otpContainer) {
      const inputs = otpContainer.querySelectorAll('.abi-otp-digit');
      inputs.forEach((digitInput: any, idx) => {
        digitInput.addEventListener('focus', () => {
          digitInput.style.borderColor = 'var(--abi-primary)';
          digitInput.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.2)';
        });
        digitInput.addEventListener('blur', () => {
          digitInput.style.borderColor = 'var(--abi-border)';
          digitInput.style.boxShadow = 'none';
        });

        digitInput.addEventListener('input', () => {
          const val = digitInput.value;
          if (val && !/^\d$/.test(val)) {
            digitInput.value = '';
            return;
          }
          if (val) {
            const next = otpContainer.querySelector(
              `.abi-otp-digit[data-index="${idx + 1}"]`,
            ) as HTMLInputElement;
            if (next) {
              next.focus();
              next.select();
            }
          }
        });

        digitInput.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Backspace' && !digitInput.value) {
            const prev = otpContainer.querySelector(
              `.abi-otp-digit[data-index="${idx - 1}"]`,
            ) as HTMLInputElement;
            if (prev) {
              prev.focus();
              prev.value = '';
            }
          } else if (e.key === 'Enter') {
            const verifyBtn = this.shadow.querySelector('#abi-otp-verify-btn') as HTMLButtonElement;
            verifyBtn?.click();
          }
        });

        digitInput.addEventListener('paste', (e: ClipboardEvent) => {
          e.preventDefault();
          const pastedText = e.clipboardData?.getData('text') || '';
          const digits = pastedText.replace(/\D/g, '').slice(0, 4);

          inputs.forEach((input: any, i) => {
            input.value = digits[i] || '';
          });

          const focusIdx = Math.min(digits.length, 3);
          const focusInput = otpContainer.querySelector(
            `.abi-otp-digit[data-index="${focusIdx}"]`,
          ) as HTMLInputElement;
          focusInput?.focus();
        });
      });

      // Auto-focus the first digit box
      setTimeout(() => {
        const first = otpContainer.querySelector(
          '.abi-otp-digit[data-index="0"]',
        ) as HTMLInputElement;
        first?.focus();
      }, 50);
    }

    const otpBackBtn = this.shadow.querySelector('#abi-otp-back-btn');
    otpBackBtn?.addEventListener('click', () => {
      this.otpSentEmail = null;
      this.otpError = null;
      this.render();
    });

    // Tab switching (only when verified)
    this.shadow.querySelectorAll('.abi-nav-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).getAttribute('data-tab') as any;
        this.activeTab = target;
        this.render();
        if (target === 'chat') this.initChatSocket();
        if (target === 'tickets') this.loadMyTickets();
      });
    });

    // Media action buttons in Ticket form
    this.shadow
      .querySelector('#abi-btn-screenshot')
      ?.addEventListener('click', () => this.handleScreenshot());
    this.shadow
      .querySelector('#abi-btn-record-screen')
      ?.addEventListener('click', () => this.handleScreenRecording());
    this.shadow
      .querySelector('#abi-btn-record-voice')
      ?.addEventListener('click', () => this.handleVoiceRecording());

    // Submit Ticket Form
    this.shadow
      .querySelector('#abi-ticket-form')
      ?.addEventListener('submit', (e) => this.handleSubmitTicket(e));

    // Remove attached media pill
    this.shadow.querySelectorAll('.abi-pill-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        this.attachedMedia.splice(idx, 1);
        this.render();
      });
    });

    // Change email buttons (triggers signout)
    this.shadow
      .querySelector('#abi-change-email-btn')
      ?.addEventListener('click', () => this.handleSignOut());
    this.shadow
      .querySelector('#abi-chat-change-email-btn')
      ?.addEventListener('click', () => this.handleSignOut());
    this.shadow
      .querySelector('#abi-tickets-change-email-btn')
      ?.addEventListener('click', () => this.handleSignOut());

    // Start new conversation button on closed chats
    this.shadow.querySelector('#abi-chat-new-btn')?.addEventListener('click', () => {
      this.currentConversationId = null;
      this.isConversationClosed = false;
      localStorage.removeItem('abi-widget-chat-conv-id');
      this.render();
      this.initChatSocket();
    });
  }

  private handleSignOut() {
    localStorage.removeItem('abi-widget-user-email');
    localStorage.removeItem('abi-widget-user-token');
    localStorage.removeItem('abi-widget-chat-conv-id');
    this.uploader.setWidgetUserEmail('');
    this.uploader.setWidgetUserToken('');
    this.currentConversationId = null;
    this.isConversationClosed = false;
    this.otpSentEmail = null;
    this.otpError = null;
    this.render();
  }

  private renderVerificationScreen(): string {
    const errorHtml = this.otpError
      ? `<div style="padding: 10px 12px; background-color: #fee2e2; border-left: 3px solid #ef4444; border-radius: 6px; color: #991b1b; font-size: 12px; margin-bottom: 12px; line-height: 1.4;">${this.otpError}</div>`
      : '';

    const overlayHtml = this.otpLoading
      ? `
        <div style="
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 100;
          border-radius: 20px; transition: all 0.3s ease;
        ">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="abi-spinner"></div>
            <span style="font-size: 12px; font-weight: 600; color: var(--abi-text-muted);">Please wait...</span>
          </div>
        </div>
      `
      : '';

    if (this.otpSentEmail) {
      return `
        <div style="position: relative; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
          ${overlayHtml}
          <div style="padding: 24px; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="font-size: 36px; margin-bottom: 8px;">📧</div>
              <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--abi-text-main);">Confirm Your Email</h3>
              <p style="margin: 0; font-size: 13px; color: var(--abi-text-muted); line-height: 1.4;">
                We sent a 4-digit verification code to<br><strong style="color: var(--abi-text-main); font-weight: 600;">${this.otpSentEmail}</strong>
              </p>
            </div>

            ${errorHtml}

            <div class="abi-form-group" style="margin-bottom: 24px;">
              <label class="abi-label" style="text-align: center; display: block; width: 100%; margin-bottom: 12px;">4-Digit Code</label>
              <div style="display: flex; gap: 12px; justify-content: center;" id="abi-otp-inputs-container">
                <input type="text" maxlength="1" class="abi-otp-digit" data-index="0" required autocomplete="off" style="width: 44px; height: 48px; border-radius: 8px; font-size: 20px; font-weight: 700; text-align: center; border: 1px solid var(--abi-border); outline: none; transition: border-color 0.2s, box-shadow 0.2s;" />
                <input type="text" maxlength="1" class="abi-otp-digit" data-index="1" required autocomplete="off" style="width: 44px; height: 48px; border-radius: 8px; font-size: 20px; font-weight: 700; text-align: center; border: 1px solid var(--abi-border); outline: none; transition: border-color 0.2s, box-shadow 0.2s;" />
                <input type="text" maxlength="1" class="abi-otp-digit" data-index="2" required autocomplete="off" style="width: 44px; height: 48px; border-radius: 8px; font-size: 20px; font-weight: 700; text-align: center; border: 1px solid var(--abi-border); outline: none; transition: border-color 0.2s, box-shadow 0.2s;" />
                <input type="text" maxlength="1" class="abi-otp-digit" data-index="3" required autocomplete="off" style="width: 44px; height: 48px; border-radius: 8px; font-size: 20px; font-weight: 700; text-align: center; border: 1px solid var(--abi-border); outline: none; transition: border-color 0.2s, box-shadow 0.2s;" />
              </div>
            </div>

            <button class="abi-btn-primary" id="abi-otp-verify-btn" style="font-size: 13px; font-weight: 600;">
              Verify Email
            </button>

            <div style="margin-top: 16px; text-align: center;">
              <button type="button" id="abi-otp-back-btn" style="background: none; border: none; color: var(--abi-primary); font-size: 12px; font-weight: 600; cursor: pointer; padding: 4px 8px;">
                ← Back / Change Email
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div style="position: relative; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
        ${overlayHtml}
        <div style="padding: 24px; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 36px; margin-bottom: 8px;">🔒</div>
            <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: var(--abi-text-main);">Verify Your Email Address</h3>
            <p style="margin: 0; font-size: 13px; color: var(--abi-text-muted); line-height: 1.4;">
              Please verify your email to unlock support tickets and live chat.
            </p>
          </div>

          ${errorHtml}

          <div class="abi-form-group" style="margin-bottom: 16px;">
            <label class="abi-label">Email Address</label>
            <input type="email" class="abi-input" id="abi-otp-email-input" placeholder="you@example.com" required style="font-size: 13px; padding: 10px;" />
          </div>

          <button class="abi-btn-primary" id="abi-otp-send-btn" style="font-size: 13px; font-weight: 600;">
            Send Verification Code
          </button>
        </div>
      </div>
    `;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'x-widget-public-key': this.config.publicKey,
    };
    if (this.config.userToken) {
      headers['authorization'] = `Bearer ${this.config.userToken}`;
    } else {
      const savedEmail = localStorage.getItem('abi-widget-user-email');
      const savedToken = localStorage.getItem('abi-widget-user-token');
      if (savedEmail) {
        headers['x-widget-user-email'] = savedEmail;
      }
      if (savedToken) {
        headers['x-widget-user-token'] = savedToken;
      }
    }
    return headers;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.render();
  }

  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  private async handleScreenshot() {
    try {
      this.close(); // Hide widget temporarily so it doesn't appear in screenshot
      await new Promise((r) => setTimeout(r, 200));

      const blob = await ScreenshotCapturer.captureDisplay();
      this.openAnnotationStudio(blob);
    } catch (err) {
      alert(`Screenshot failed: ${err instanceof Error ? err.message : String(err)}`);
      this.open();
    }
  }

  private openAnnotationStudio(imageBlob: Blob) {
    const overlayRoot = this.shadow.querySelector('#abi-annotation-root');
    if (!overlayRoot) return;

    overlayRoot.innerHTML = `
      <div class="abi-annotation-overlay">
        <div class="abi-annotation-bar">
          <div style="display: flex; gap: 8px; align-items: center;">
            <strong>Annotate Screenshot</strong>
            <button id="abi-tool-pen" style="padding: 4px 8px;">✏️ Pen</button>
            <button id="abi-tool-rect" style="padding: 4px 8px;">⬜ Box</button>
            <button id="abi-tool-arrow" style="padding: 4px 8px;">➡️ Arrow</button>
            <button id="abi-tool-blur" style="padding: 4px 8px;">⬛ Redact</button>
            <button id="abi-tool-undo" style="padding: 4px 8px;">↩️ Undo</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="abi-annot-cancel" style="padding: 6px 12px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="abi-annot-save" style="padding: 6px 16px; background: var(--abi-primary); color: white; border: none; border-radius: 6px; cursor: pointer;">Attach</button>
          </div>
        </div>
        <div class="abi-canvas-container">
          <canvas id="abi-annotation-canvas"></canvas>
        </div>
      </div>
    `;

    const canvas = overlayRoot.querySelector('#abi-annotation-canvas') as HTMLCanvasElement;
    const annotator = new ImageAnnotator(canvas);
    annotator.loadImage(imageBlob);

    overlayRoot
      .querySelector('#abi-tool-pen')
      ?.addEventListener('click', () => annotator.setTool('PEN'));
    overlayRoot
      .querySelector('#abi-tool-rect')
      ?.addEventListener('click', () => annotator.setTool('RECTANGLE'));
    overlayRoot
      .querySelector('#abi-tool-arrow')
      ?.addEventListener('click', () => annotator.setTool('ARROW'));
    overlayRoot
      .querySelector('#abi-tool-blur')
      ?.addEventListener('click', () => annotator.setTool('BLUR'));
    overlayRoot.querySelector('#abi-tool-undo')?.addEventListener('click', () => annotator.undo());

    overlayRoot.querySelector('#abi-annot-cancel')?.addEventListener('click', () => {
      overlayRoot.innerHTML = '';
      this.open();
    });

    overlayRoot.querySelector('#abi-annot-save')?.addEventListener('click', async () => {
      const finalBlob = await annotator.exportBlob();
      overlayRoot.innerHTML = '';
      this.open();

      const result = await this.uploader.uploadBlob(finalBlob, 'screenshot.png', 'SCREENSHOT');
      this.attachedMedia.push(result);
      this.render();
    });
  }

  private async handleScreenRecording() {
    const recorder = new ScreenRecorder();
    try {
      this.close();

      await recorder.start((seconds) => {
        const timerEl = this.shadow.querySelector('#abi-rec-timer');
        if (timerEl) {
          const mins = Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0');
          const secs = (seconds % 60).toString().padStart(2, '0');
          timerEl.textContent = `${mins}:${secs}`;
        }
      });

      // Show non-blocking recording overlay inside the widget
      this.isOpen = true;
      this.render();
      const content = this.shadow.querySelector('#abi-content');
      if (content) {
        content.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; padding: 20px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ef4444; animation: abi-pulse 1s ease-in-out infinite;"></span>
              <span style="font-size: 14px; font-weight: 700; color: var(--abi-text-main);">Recording Screen</span>
            </div>
            <div id="abi-rec-timer" style="font-size: 32px; font-weight: 700; font-family: monospace; color: var(--abi-primary);">00:00</div>
            <p style="font-size: 12px; color: var(--abi-text-muted); text-align: center; margin: 0;">
              Your screen is being recorded.<br>Click <strong>Stop</strong> when finished.
            </p>
            <button id="abi-stop-rec-btn" style="
              padding: 10px 32px; background: #ef4444; color: white; border: none;
              border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
              font-family: inherit; transition: background 0.15s;
            ">⏹ Stop Recording</button>
          </div>
          <style>
            @keyframes abi-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          </style>
        `;

        this.shadow.querySelector('#abi-stop-rec-btn')?.addEventListener('click', async () => {
          const stopBtn = this.shadow.querySelector('#abi-stop-rec-btn') as HTMLButtonElement;
          if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Processing...';
          }

          try {
            const { blob } = await recorder.stop();
            const result = await this.uploader.uploadBlob(
              blob,
              'screen-recording.webm',
              'SCREEN_RECORDING',
            );
            this.attachedMedia.push(result);
          } catch (uploadErr) {
            alert(
              `Upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
            );
          }
          this.activeTab = 'ticket';
          this.render();
        });
      }
    } catch (err) {
      alert(`Recording error: ${err instanceof Error ? err.message : String(err)}`);
      this.open();
    }
  }

  private async handleVoiceRecording() {
    const recorder = new VoiceRecorder();
    try {
      await recorder.start();

      // Show non-blocking voice recording overlay
      const content = this.shadow.querySelector('#abi-content');
      if (content) {
        const startTime = Date.now();
        content.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; padding: 20px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ef4444; animation: abi-pulse 1s ease-in-out infinite;"></span>
              <span style="font-size: 14px; font-weight: 700; color: var(--abi-text-main);">Recording Voice</span>
            </div>
            <div id="abi-voice-timer" style="font-size: 32px; font-weight: 700; font-family: monospace; color: var(--abi-primary);">00:00</div>
            <p style="font-size: 12px; color: var(--abi-text-muted); text-align: center; margin: 0;">
              Speak into your microphone.<br>Click <strong>Stop</strong> when finished.
            </p>
            <button id="abi-stop-voice-btn" style="
              padding: 10px 32px; background: #ef4444; color: white; border: none;
              border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
              font-family: inherit;
            ">⏹ Stop Recording</button>
          </div>
          <style>
            @keyframes abi-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          </style>
        `;

        const voiceTimer = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const timerEl = this.shadow.querySelector('#abi-voice-timer');
          if (timerEl) {
            const mins = Math.floor(elapsed / 60)
              .toString()
              .padStart(2, '0');
            const secs = (elapsed % 60).toString().padStart(2, '0');
            timerEl.textContent = `${mins}:${secs}`;
          }
        }, 1000);

        this.shadow.querySelector('#abi-stop-voice-btn')?.addEventListener('click', async () => {
          clearInterval(voiceTimer);
          const stopBtn = this.shadow.querySelector('#abi-stop-voice-btn') as HTMLButtonElement;
          if (stopBtn) {
            stopBtn.disabled = true;
            stopBtn.textContent = 'Processing...';
          }

          try {
            const { blob } = await recorder.stop();
            const result = await this.uploader.uploadBlob(
              blob,
              'voice-note.webm',
              'VOICE_RECORDING',
            );
            this.attachedMedia.push(result);
          } catch (uploadErr) {
            alert(
              `Upload failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
            );
          }
          this.activeTab = 'ticket';
          this.render();
        });
      }
    } catch (err) {
      alert(`Voice recording error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleSubmitTicket(e: Event) {
    e.preventDefault();

    const subjectInput = this.shadow.querySelector('#abi-ticket-subject') as HTMLInputElement;
    const descInput = this.shadow.querySelector('#abi-ticket-desc') as HTMLTextAreaElement;
    const prioritySelect = this.shadow.querySelector('#abi-ticket-priority') as HTMLSelectElement;
    const submitBtn = this.shadow.querySelector('#abi-submit-ticket-btn') as HTMLButtonElement;

    // Capture values IMMEDIATELY before any async work or DOM changes
    const subjectValue = subjectInput?.value || '';
    const descValue = descInput?.value || '';
    const priorityValue = prioritySelect?.value || 'NORMAL';

    let emailValue = '';
    if (!this.config.userToken) {
      emailValue = localStorage.getItem('abi-widget-user-email') || '';
      if (!emailValue) {
        alert('Email verification is required.');
        return;
      }
    }

    if (!subjectValue.trim() || !descValue.trim()) {
      alert('Please fill in both Subject and Description.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Collect complete device diagnostics
    const diagnostics = collectDeviceDiagnostics();
    const consoleLogs = ConsoleCapturer.getEntries();
    const networkLogs = NetworkCapturer.getEntries();
    const errors = ErrorCapturer.getEntries();

    const payload = {
      subject: subjectValue,
      description: descValue,
      priority: priorityValue,
      channel: 'WIDGET',
      type: 'INCIDENT',
      diagnostics: {
        ...diagnostics,
        consoleLogs,
        networkLogs,
        errors,
      },
      attachmentIds: this.attachedMedia.map((m) => m.mediaAssetId),
    };

    try {
      const res = await fetch(`${this.config.apiUrl}/api/v1/tickets`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...this.getHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const ticket = await res.json();
      this.attachedMedia = [];
      this.activeTab = 'tickets';
      this.render();

      // Wait for tickets to load FIRST, then show the banner on top
      await this.loadMyTickets();

      const container = this.shadow.querySelector('#abi-my-tickets-container');
      if (container) {
        const banner = document.createElement('div');
        banner.style.cssText = `
          padding: 10px 14px; margin-bottom: 10px; border-radius: 8px;
          background: #dcfce7; color: #166534; font-size: 12px; font-weight: 600;
          display: flex; align-items: center; gap: 6px;
          border: 1px solid #bbf7d0;
        `;
        banner.textContent = `✅ Ticket #${ticket.number} submitted successfully!`;
        container.prepend(banner);
        setTimeout(() => banner.remove(), 6000);
      }
    } catch (err) {
      alert(`Failed to submit ticket: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Re-enable submit button (may have been re-rendered, so re-query)
      const btn = this.shadow.querySelector('#abi-submit-ticket-btn') as HTMLButtonElement;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Submit Ticket';
      }
    }
  }

  private chatPollTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageCount = 0;

  private initChatSocket() {
    const startBtn = this.shadow.querySelector('#abi-chat-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const emailInput = this.shadow.querySelector('#abi-chat-email-input') as HTMLInputElement;
        const email = emailInput?.value?.trim();
        if (email && email.includes('@')) {
          localStorage.setItem('abi-widget-user-email', email);
          this.uploader.setWidgetUserEmail(email);
          this.render();
          this.initChatSocket();
        } else {
          alert('Please enter a valid email address.');
        }
      });
      return;
    }

    const stream = this.shadow.querySelector('#abi-chat-stream');
    const input = this.shadow.querySelector('#abi-chat-msg-input') as HTMLInputElement;
    const sendBtn = this.shadow.querySelector('#abi-chat-send-btn') as HTMLButtonElement;

    if (!stream || !input || !sendBtn) return;

    // Handle Enter key to send
    input.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
      }
    });

    sendBtn.addEventListener('click', async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';

      // Immediately show the user's message in the stream
      this.appendChatBubble(stream, text, true, 'You', new Date().toISOString());

      try {
        // If no conversation exists yet, create one
        if (!this.currentConversationId) {
          await this.createChatConversation(text);
          // Start polling for agent replies
          this.startChatPolling(stream);
        } else {
          await this.sendChatMessage(text);
        }
      } catch (err) {
        this.appendChatBubble(
          stream,
          `⚠️ Failed to send: ${err instanceof Error ? err.message : 'Unknown error'}`,
          false,
          'System',
          new Date().toISOString(),
        );
      }
    });

    // If there's already an active conversation, resume polling
    if (this.currentConversationId) {
      this.loadChatHistory(stream);
      this.startChatPolling(stream);
    }
  }

  private async createChatConversation(initialMessage: string) {
    const headers = {
      'content-type': 'application/json',
      ...this.getHeaders(),
    };

    const res = await fetch(`${this.config.apiUrl}/api/v1/chat/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subject: 'Live Chat Support',
        initialMessage,
        pageUrl: window.location.href,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to start chat: ${(await res.text()).slice(0, 100)}`);
    }

    const conv = await res.json();
    this.currentConversationId = conv.id;
    localStorage.setItem('abi-widget-chat-conv-id', conv.id);
    this.lastMessageCount = 1; // The initial message
  }

  private async sendChatMessage(body: string) {
    if (!this.currentConversationId) return;

    const headers = {
      'content-type': 'application/json',
      ...this.getHeaders(),
    };

    const res = await fetch(
      `${this.config.apiUrl}/api/v1/chat/conversations/${this.currentConversationId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to send message: ${(await res.text()).slice(0, 100)}`);
    }

    this.lastMessageCount++;
  }

  private async loadChatHistory(stream: Element) {
    if (!this.currentConversationId) return;

    const headers = this.getHeaders();

    try {
      // First check if conversation is closed
      const convRes = await fetch(
        `${this.config.apiUrl}/api/v1/chat/conversations/${this.currentConversationId}`,
        { headers },
      );
      if (convRes.ok) {
        const conv = await convRes.json();
        if (conv.status === 'CLOSED') {
          this.isConversationClosed = true;
          if (this.chatPollTimer) {
            clearInterval(this.chatPollTimer);
            this.chatPollTimer = null;
          }
        } else {
          this.isConversationClosed = false;
        }
      }

      const res = await fetch(
        `${this.config.apiUrl}/api/v1/chat/conversations/${this.currentConversationId}/messages?pageSize=50`,
        { headers },
      );

      if (!res.ok) return;

      const data = await res.json();
      const msgs = data.messages || [];
      this.lastMessageCount = msgs.length;

      // Clear existing bubbles except the welcome message
      stream.innerHTML = '';

      for (const m of msgs) {
        if (m.kind === 'SYSTEM') {
          const sys = document.createElement('div');
          sys.style.cssText =
            'text-align: center; font-size: 11px; color: var(--abi-text-muted); padding: 4px 0;';
          sys.textContent = `── ${m.body} ──`;
          stream.appendChild(sys);
        } else {
          const isMe = m.sender?.kind === 'CUSTOMER';
          this.appendChatBubble(
            stream,
            m.body || '',
            isMe,
            m.sender?.fullName || (isMe ? 'You' : 'Support Agent'),
            m.createdAt,
          );
        }
      }
    } catch {
      /* silently ignore poll errors */
    }
  }

  private startChatPolling(stream: Element) {
    if (this.chatPollTimer) return;

    this.chatPollTimer = setInterval(async () => {
      if (!this.currentConversationId) return;

      const headers = this.getHeaders();

      try {
        const convRes = await fetch(
          `${this.config.apiUrl}/api/v1/chat/conversations/${this.currentConversationId}`,
          { headers },
        );
        if (convRes.ok) {
          const conv = await convRes.json();
          if (conv.status === 'CLOSED') {
            this.isConversationClosed = true;
            if (this.chatPollTimer) {
              clearInterval(this.chatPollTimer);
              this.chatPollTimer = null;
            }
            this.render();
            const newStream = this.shadow.querySelector('#abi-chat-stream');
            if (newStream) {
              this.loadChatHistory(newStream);
            }
            return;
          }
        }

        const res = await fetch(
          `${this.config.apiUrl}/api/v1/chat/conversations/${this.currentConversationId}/messages?pageSize=50`,
          { headers },
        );

        if (!res.ok) return;

        const data = await res.json();
        const msgs = data.messages || [];

        if (msgs.length > this.lastMessageCount) {
          // Only append new messages (messages we haven't seen)
          const newMsgs = msgs.slice(this.lastMessageCount);
          for (const m of newMsgs) {
            if (m.kind === 'SYSTEM') {
              const sys = document.createElement('div');
              sys.style.cssText =
                'text-align: center; font-size: 11px; color: var(--abi-text-muted); padding: 4px 0;';
              sys.textContent = `── ${m.body} ──`;
              stream.appendChild(sys);
            } else {
              const isMe = m.sender?.kind === 'CUSTOMER';
              // Only show agent messages via polling — customer messages are shown immediately on send
              if (!isMe) {
                this.appendChatBubble(
                  stream,
                  m.body || '',
                  false,
                  m.sender?.fullName || 'Support Agent',
                  m.createdAt,
                );
              }
            }
          }
          this.lastMessageCount = msgs.length;
        }
      } catch {
        /* silently ignore */
      }
    }, 3000);
  }

  private appendChatBubble(
    stream: Element,
    text: string,
    isCustomer: boolean,
    senderName: string,
    createdAt: string,
  ) {
    const container = document.createElement('div');
    container.className = 'abi-chat-bubble-container';
    container.style.alignSelf = isCustomer ? 'flex-end' : 'flex-start';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.flexDirection = isCustomer ? 'row-reverse' : 'row';
    row.style.alignItems = 'flex-end';

    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      color: #ffffff;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    `;

    if (isCustomer) {
      avatar.style.background = 'linear-gradient(135deg, #64748b, #475569)';
      avatar.textContent = 'U';
    } else {
      avatar.style.background =
        'linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover))';
      avatar.textContent = 'S';
    }

    const bubble = document.createElement('div');
    bubble.className = `abi-chat-msg ${isCustomer ? 'customer' : 'agent'}`;
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);

    const meta = document.createElement('div');
    meta.className = 'abi-chat-msg-meta';
    meta.style.alignSelf = isCustomer ? 'flex-end' : 'flex-start';
    meta.style.paddingLeft = isCustomer ? '0' : '32px';
    meta.style.paddingRight = isCustomer ? '32px' : '0';
    meta.textContent = `${senderName} · ${this.timeAgo(createdAt)}`;

    container.appendChild(row);
    container.appendChild(meta);

    stream.appendChild(container);
    stream.scrollTop = stream.scrollHeight;
  }

  destroy() {
    if (this.chatPollTimer) {
      clearInterval(this.chatPollTimer);
      this.chatPollTimer = null;
    }
    this.socket?.disconnect();
    this.rootEl.remove();
  }
}
