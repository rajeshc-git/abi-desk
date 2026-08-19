export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];

  private startTime: number = 0;
  private timerInterval: any = null;

  async start(onTick?: (seconds: number) => void, maxSeconds: number = 180): Promise<void> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen recording is not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 } } as any,
      audio: true,
    });

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(1000); // 1-second chunks

    if (onTick) {
      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        onTick(elapsed);
        if (elapsed >= maxSeconds) {
          this.stop();
        }
      }, 1000);
    }

    // If user stops sharing screen via browser chrome UI
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stop();
      };
    }
  }

  async stop(): Promise<{ blob: Blob; durationSeconds: number }> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const durationSeconds = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        if (this.recordedChunks.length > 0) {
          const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
          resolve({ blob, durationSeconds });
        } else {
          reject(new Error('No recording data available'));
        }
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });

        // Stop all media tracks
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.mediaRecorder = null;

        resolve({ blob, durationSeconds });
      };

      this.mediaRecorder.stop();
    });
  }
}
