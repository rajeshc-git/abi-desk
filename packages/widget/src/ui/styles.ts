export function getWidgetStyles(
  primaryColor: string = '#2563EB',
  accentColor: string = '#1E40AF',
): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

:host {
  --abi-primary: ${primaryColor};
  --abi-primary-hover: ${accentColor};
  --abi-bg: #ffffff;
  --abi-surface: #f8fafc;
  --abi-border: #e2e8f0;
  --abi-text-main: #0f172a;
  --abi-text-muted: #64748b;
  --abi-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  --abi-radius: 20px;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: inherit;
}

.abi-launcher-btn {
  position: fixed;
  z-index: 999990;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--abi-primary);
  box-shadow: 0 10px 25px -3px rgba(37, 99, 235, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  color: #ffffff;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s;
  outline: none;
}

.abi-launcher-btn:hover {
  transform: scale(1.08);
  background: var(--abi-primary-hover);
}

.abi-launcher-btn.bottom-right { bottom: 24px; right: 24px; }
.abi-launcher-btn.bottom-left { bottom: 24px; left: 24px; }
.abi-launcher-btn.top-right { top: 24px; right: 24px; }
.abi-launcher-btn.top-left { top: 24px; left: 24px; }

.abi-modal-panel {
  position: fixed;
  z-index: 999995;
  width: 400px;
  height: 620px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 100px);
  background: var(--abi-bg);
  border: 1px solid var(--abi-border);
  border-radius: var(--abi-radius);
  box-shadow: var(--abi-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  transform: translateY(20px) scale(0.96);
  pointer-events: none;
}

.abi-modal-panel.open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.abi-modal-panel.bottom-right { bottom: 96px; right: 24px; }
.abi-modal-panel.bottom-left { bottom: 96px; left: 24px; }
.abi-modal-panel.top-right { top: 96px; right: 24px; }
.abi-modal-panel.top-left { top: 96px; left: 24px; }

.abi-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover));
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.abi-header-title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.abi-header-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #ffffff;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.abi-header-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.abi-nav-tabs {
  display: flex;
  border-bottom: 1px solid var(--abi-border);
  background: var(--abi-surface);
}

.abi-nav-tab {
  flex: 1;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--abi-text-muted);
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: color 0.15s, border-color 0.15s;
  border-bottom: 2px solid transparent;
}

.abi-nav-tab.active {
  color: var(--abi-primary);
  border-bottom-color: var(--abi-primary);
  background: #ffffff;
}

.abi-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.abi-form-group {
  margin-bottom: 14px;
}

.abi-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--abi-text-main);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.abi-input, .abi-textarea, .abi-select {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid var(--abi-border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--abi-text-main);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.abi-input:focus, .abi-textarea:focus, .abi-select:focus {
  border-color: var(--abi-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.abi-media-toolbar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.abi-media-btn {
  padding: 8px 4px;
  border: 1px dashed var(--abi-border);
  border-radius: 8px;
  background: var(--abi-surface);
  color: var(--abi-text-main);
  font-size: 11px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.abi-media-btn:hover {
  border-color: var(--abi-primary);
  background: rgba(37, 99, 235, 0.04);
  color: var(--abi-primary);
}

.abi-media-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.abi-media-pill {
  font-size: 11px;
  padding: 4px 8px;
  background: var(--abi-surface);
  border: 1px solid var(--abi-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.abi-pill-remove {
  cursor: pointer;
  color: #ef4444;
  font-weight: bold;
}

.abi-btn-primary {
  width: 100%;
  padding: 12px;
  background: var(--abi-primary);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.abi-btn-primary:hover {
  background: var(--abi-primary-hover);
}

.abi-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Chat window */
.abi-chat-stream {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  background: var(--abi-surface);
  scroll-behavior: smooth;
}

.abi-chat-stream::-webkit-scrollbar {
  width: 5px;
}
.abi-chat-stream::-webkit-scrollbar-track {
  background: transparent;
}
.abi-chat-stream::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.abi-chat-bubble-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: abi-fade-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes abi-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.abi-chat-msg {
  max-width: 80%;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.45;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.abi-chat-msg.customer {
  align-self: flex-end;
  background: linear-gradient(135deg, var(--abi-primary), var(--abi-primary-hover));
  color: #ffffff;
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 4px 10px -2px rgba(37, 99, 235, 0.2);
}

.abi-chat-msg.agent {
  align-self: flex-start;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  color: var(--abi-text-main);
  border-radius: 18px 18px 18px 4px;
  box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.02);
}

.abi-chat-msg-meta {
  font-size: 10px;
  color: var(--abi-text-muted);
  opacity: 0.8;
  margin-top: 1px;
}

.abi-chat-msg.customer .abi-chat-msg-meta {
  align-self: flex-end;
}

.abi-chat-msg.agent .abi-chat-msg-meta {
  align-self: flex-start;
}

.abi-chat-input-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--abi-border);
  background: #ffffff;
  align-items: center;
}

.abi-chat-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 3px 4px 3px 12px;
  transition: all 0.2s ease;
}

.abi-chat-input-wrapper:focus-within {
  border-color: var(--abi-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
  background: #ffffff;
}

.abi-chat-input-field {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--abi-text-main);
  padding: 6px 0;
  font-family: inherit;
}

.abi-chat-send-btn-round {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--abi-primary);
  border: none;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.abi-chat-send-btn-round:hover {
  background: var(--abi-primary-hover);
  transform: scale(1.05);
}

.abi-chat-send-btn-round:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}

/* Annotation Overlay Modal */
.abi-annotation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999999;
  background: rgba(15, 23, 42, 0.85);
  display: flex;
  flex-direction: column;
}

.abi-annotation-bar {
  height: 56px;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  color: #ffffff;
}

.abi-canvas-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 16px;
}

.abi-canvas-container canvas {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  max-width: 90vw;
  max-height: 80vh;
  background: #ffffff;
  cursor: crosshair;
}

.abi-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(0,0,0,0.1);
  border-top-color: var(--abi-primary);
  border-radius: 50%;
  animation: abi-spin 0.8s linear infinite;
}

@keyframes abi-spin {
  to { transform: rotate(360deg); }
}
  `;
}
