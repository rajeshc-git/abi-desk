export interface UploadResult {
  mediaAssetId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export class DirectUploader {
  private apiUrl: string;
  private publicKey: string;
  private authToken?: string;
  private widgetUserEmail?: string;
  private widgetUserToken?: string;

  constructor(apiUrl: string, publicKey: string, authToken?: string) {
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.publicKey = publicKey;
    this.authToken = authToken;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  setWidgetUserEmail(email: string) {
    this.widgetUserEmail = email;
  }

  setWidgetUserToken(token: string) {
    this.widgetUserToken = token;
  }

  async uploadBlob(
    blob: Blob,
    filename: string,
    kind: 'SCREENSHOT' | 'SCREEN_RECORDING' | 'VOICE_RECORDING' | 'ATTACHMENT',
  ): Promise<UploadResult> {
    if (!blob || blob.size === 0) {
      throw new Error(
        'Cannot upload an empty file. The capture may have failed — please try again.',
      );
    }
    const sizeBytes = blob.size;
    const mimeType = blob.type || 'application/octet-stream';

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-widget-public-key': this.publicKey,
    };
    if (this.authToken) {
      headers['authorization'] = `Bearer ${this.authToken}`;
    } else {
      if (this.widgetUserEmail) {
        headers['x-widget-user-email'] = this.widgetUserEmail;
      }
      if (this.widgetUserToken) {
        headers['x-widget-user-token'] = this.widgetUserToken;
      }
    }

    // Step 1: Request presigned PUT URL
    const presignRes = await fetch(`${this.apiUrl}/api/v1/media/uploads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kind,
        originalFilename: filename,
        declaredMimeType: mimeType,
        sizeBytes,
      }),
    });

    if (!presignRes.ok) {
      const errText = await presignRes.text();
      throw new Error(`Failed to initialize upload: ${errText}`);
    }

    const resBody = await presignRes.json();
    const mediaAssetId: string = resBody.media?.id || resBody.mediaAssetId;
    const uploadUrl: string = resBody.upload?.url || resBody.presigned?.url;

    if (!mediaAssetId || !uploadUrl) {
      throw new Error(`Unexpected upload response shape: ${JSON.stringify(resBody)}`);
    }

    // Step 2: Direct PUT to S3 / Object Storage
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': mimeType,
        'content-length': String(sizeBytes),
      },
      body: blob,
    });

    if (!uploadRes.ok) {
      throw new Error(`Direct storage upload failed with status ${uploadRes.status}`);
    }

    // Step 3: Confirm upload with server
    const confirmRes = await fetch(`${this.apiUrl}/api/v1/media/${mediaAssetId}/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });

    if (!confirmRes.ok) {
      const errText = await confirmRes.text();
      throw new Error(`Failed to confirm upload: ${errText}`);
    }

    return {
      mediaAssetId,
      filename,
      mimeType,
      sizeBytes,
    };
  }
}
