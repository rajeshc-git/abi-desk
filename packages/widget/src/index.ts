import { ConsoleCapturer } from './telemetry/console-capturer.js';
import { ErrorCapturer } from './telemetry/error-capturer.js';
import { NetworkCapturer } from './telemetry/network-capturer.js';
import { WidgetConfig, WidgetUI } from './ui/widget-ui.js';

export { ConsoleCapturer } from './telemetry/console-capturer.js';
export { NetworkCapturer } from './telemetry/network-capturer.js';
export { ErrorCapturer } from './telemetry/error-capturer.js';
export { collectDeviceDiagnostics } from './telemetry/device-collector.js';
export { ScreenshotCapturer } from './media/screenshot-capturer.js';
export { ImageAnnotator } from './media/annotator.js';
export { ScreenRecorder } from './media/screen-recorder.js';
export { VoiceRecorder } from './media/voice-recorder.js';
export { DirectUploader } from './media/uploader.js';
export { WidgetUI, type WidgetConfig } from './ui/widget-ui.js';

export class AbiDeskWidget {
  private static instance: WidgetUI | null = null;

  static init(config: WidgetConfig): WidgetUI {
    // Install telemetry ring buffers
    ConsoleCapturer.install();
    NetworkCapturer.install();
    ErrorCapturer.install();

    if (!this.instance) {
      this.instance = new WidgetUI(config);
    }
    return this.instance;
  }

  static open() {
    this.instance?.open();
  }

  static close() {
    this.instance?.close();
  }

  static toggle() {
    this.instance?.toggle();
  }
}

// Auto-boot if loaded via embed script tag
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const publicKey = currentScript?.getAttribute('data-public-key');
  // For an embed without an explicit API URL, use the host that served this
  // script. This works for localhost and LAN/IP deployments alike.
  const scriptOrigin = currentScript?.src
    ? new URL(currentScript.src, window.location.href).origin
    : window.location.origin;
  const apiUrl = currentScript?.getAttribute('data-api-url') || scriptOrigin;

  if (publicKey) {
    const boot = () => {
      AbiDeskWidget.init({ publicKey, apiUrl });
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  (window as any).AbiDeskWidget = AbiDeskWidget;
}
