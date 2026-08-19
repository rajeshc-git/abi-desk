export class ScreenshotCapturer {
  /**
   * Captures a high-resolution screenshot using the browser's Screen Capture API.
   */
  static async captureDisplay(): Promise<Blob> {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen capture is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as any,
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error('No video track available for screenshot.');
    }

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => resolve())
          .catch(() => resolve());
      };
    });

    // Wait a brief tick for the first frame to render
    await new Promise((r) => setTimeout(r, 200));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || window.innerWidth;
    canvas.height = video.videoHeight || window.innerHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      track.stop();
      throw new Error('Failed to create canvas 2D context.');
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    track.stop();

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate PNG blob from canvas.'));
      }, 'image/png');
    });
  }
}
