import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';

export interface PresignedUpload {
  url: string;
  /** Seconds until the URL stops working. */
  expiresInSeconds: number;
}

export interface HeadResult {
  sizeBytes: number;
  contentType: string | undefined;
}

/**
 * Object storage: presigned uploads and downloads against MinIO locally, any S3-API
 * provider in production.
 *
 * Bytes never transit this process. A client asks the API for a presigned PUT, uploads
 * straight to the bucket, then tells the API it is done; downloads are the same in
 * reverse. That keeps the API's memory and bandwidth flat regardless of attachment
 * size or concurrent upload count - the thing that would not scale is proxying binary
 * payloads through a Node process per request.
 *
 * Every URL this service issues is short-lived and scoped to one object. Nothing here
 * generates a durable public link, because `media_asset.storageKey` is not meant to be
 * guessable or bookmarkable - access has to be re-checked (tenant, ticket scope,
 * comment visibility) on every request for a fresh URL.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  /** Talks to storage over the private endpoint. Used for every server-side operation. */
  private client!: S3Client;
  /**
   * Signs URLs only. Bound to the public endpoint because a presigned URL's host is
   * part of what gets signed, so it must be signed with the name the browser will use -
   * signing `http://minio:9000` and handing that to a client produces a URL that either
   * fails DNS or, behind a proxy, fails the signature check.
   *
   * Identical to `client` when no separate public endpoint is configured.
   */
  private presigner!: S3Client;
  private readonly logger: Logger;

  constructor(
    private readonly config: AppConfig,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'StorageService' });
  }

  async onModuleInit(): Promise<void> {
    const storage = this.config.storage;

    const credentials = {
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
    };

    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials,
    });

    this.presigner =
      storage.publicEndpoint === storage.endpoint
        ? this.client
        : new S3Client({
            endpoint: storage.publicEndpoint,
            region: storage.region,
            forcePathStyle: storage.forcePathStyle,
            credentials,
          });

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: storage.bucket }));
      this.logger.info(
        { bucket: storage.bucket, endpoint: storage.endpoint },
        'Object storage ready',
      );
    } catch (error) {
      // Not fatal at boot: minio-init creates the bucket as a separate compose step
      // that may still be running. The readiness probe is what should fail loudly if
      // this never recovers, not the app crashing on startup.
      this.logger.warn(
        { err: error, bucket: storage.bucket },
        'Object storage bucket not reachable yet',
      );
    }
  }

  get bucket(): string {
    return this.config.storage.bucket;
  }

  /**
   * A presigned PUT for a client to upload directly to.
   *
   * `contentLength` is bound into the signature via `ContentLength`, which makes the
   * signed URL only valid for exactly that many bytes - a client cannot reuse the URL
   * to upload something larger than what was declared and approved.
   */
  async presignUpload(
    key: string,
    options: { contentType: string; contentLength: number; expiresInSeconds?: number },
  ): Promise<PresignedUpload> {
    const expiresInSeconds = options.expiresInSeconds ?? 300;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
    });

    const url = await getSignedUrl(this.presigner, command, { expiresIn: expiresInSeconds });
    return { url, expiresInSeconds };
  }

  /** A presigned GET for a client to download directly from. */
  async presignDownload(
    key: string,
    options: {
      expiresInSeconds?: number;
      downloadFilename?: string;
      disposition?: 'inline' | 'attachment';
      contentType?: string;
    } = {},
  ): Promise<PresignedUpload> {
    const expiresInSeconds = options.expiresInSeconds ?? 300;
    const disposition = options.disposition ?? 'inline';

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options.contentType ? { ResponseContentType: options.contentType } : {}),
      ...(options.downloadFilename
        ? {
            ResponseContentDisposition: `${disposition}; filename="${sanitizeFilename(
              options.downloadFilename,
            )}"`,
          }
        : {}),
    });

    const url = await getSignedUrl(this.presigner, command, { expiresIn: expiresInSeconds });
    return { url, expiresInSeconds };
  }

  /**
   * Confirms an object exists and reports its real size and type as stored.
   *
   * Used to verify an upload actually completed before a `MediaAsset` moves out of
   * `PENDING_UPLOAD` - the client's "I'm done" claim is not trusted on its own,
   * because a failed or truncated upload would otherwise be recorded as successful.
   */
  async head(key: string): Promise<HeadResult | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        sizeBytes: result.ContentLength ?? 0,
        contentType: result.ContentType,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  /** Downloads an object's full body. Used server-side only (thumbnailing, virus scan, redaction). */
  async getObjectBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return collectBody(result.Body);
  }

  /**
   * Downloads a byte range.
   *
   * Content-type verification needs only the first few dozen bytes, and reading those
   * instead of the whole object is what keeps a 400 MB upload from becoming a 400 MB
   * allocation in this process during confirmation.
   *
   * `end` is inclusive, matching HTTP `Range` semantics rather than JavaScript slice
   * semantics - worth stating because mixing the two off-by-one is easy.
   */
  async getObjectRange(key: string, start: number, end: number): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=${start}-${end}` }),
    );

    return collectBody(result.Body);
  }

  /** Writes an object directly. Used by the worker for derived assets (thumbnails). */
  async putObjectBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * Drains an S3 response body into a Buffer.
 *
 * The SDK types `Body` as a union covering browser streams too; under Node it is always
 * an async-iterable Readable, which is why it is narrowed rather than feature-detected.
 */
async function collectBody(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);

  const chunks: Buffer[] = [];

  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'NotFound'
  );
}

/**
 * Strips characters that would break the `Content-Disposition` header or let a
 * filename escape its quoted value. The original filename is user-supplied and never
 * used as a path component - only ever as a header value.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n]/g, '').slice(0, 255);
}
