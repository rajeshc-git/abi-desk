export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];

  private startTime: number = 0;
  private timerInterval: any = null;

  async start(onTick?: (seconds: number) => void, maxSeconds: number = 180): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.recordedChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(500);

    if (onTick) {
      this.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        onTick(elapsed);
        if (elapsed >= maxSeconds) {
          this.stop();
        }
      }, 1000);
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
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          resolve({ blob, durationSeconds });
        } else {
          reject(new Error('No voice recording available'));
        }
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });

        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.mediaRecorder = null;

        resolve({ blob, durationSeconds });
      };

      this.mediaRecorder.stop();
    });
  }
}
