import { ApiClient } from './client';

export interface CreateTicketDto {
  subject: string;
  description: string;
  type?: 'INCIDENT' | 'PROBLEM' | 'CHANGE_REQUEST' | 'SERVICE_REQUEST' | 'QUESTION';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';
  tier?: 'L1' | 'L2' | 'L3' | 'DEV' | 'QA';
  brandId?: string;
  queueId?: string;
  requesterEmail: string;
  requesterName: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

export const TicketsApi = {
  list: (params?: Record<string, any>) => ApiClient.get('/tickets', params),
  getById: (id: string) => ApiClient.get(`/tickets/${id}`),
  create: (data: CreateTicketDto) => ApiClient.post('/tickets', data),
  update: (id: string, data: Record<string, any>) => ApiClient.patch(`/tickets/${id}`, data),
  assign: (id: string, assigneeId: string | null) =>
    ApiClient.post(`/tickets/${id}/assign`, { assigneeId }),
  addComment: (id: string, body: string, isInternal: boolean) =>
    ApiClient.post(`/tickets/${id}/comments`, {
      body,
      visibility: isInternal ? 'INTERNAL' : 'PUBLIC',
    }),
  transitionStatus: (id: string, toStatus: string) =>
    ApiClient.post(`/tickets/${id}/transitions`, { toStatus }),
  escalateTier: (id: string, toTier: string, reason: string) =>
    ApiClient.post(`/tickets/${id}/escalate`, { toTier, reason }),
  bulkUpdate: (ticketIds: string[], updates: Record<string, any>) =>
    ApiClient.post('/tickets/bulk', {
      ticketIds,
      toStatus: updates.toStatus || updates.status,
      status: updates.status || updates.toStatus,
      ...updates,
    }),
  uploadFile: async (
    file: File,
    kind: 'SCREENSHOT' | 'SCREEN_RECORDING' | 'VOICE_RECORDING' | 'ATTACHMENT' = 'ATTACHMENT',
  ) => {
    const presignRes = await ApiClient.post<any>('/media/uploads', {
      kind,
      originalFilename: file.name,
      declaredMimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    });

    const mediaAssetId = presignRes.media?.id || presignRes.mediaAssetId;
    const uploadUrl = presignRes.upload?.url || presignRes.presigned?.url;

    if (!mediaAssetId || !uploadUrl) {
      throw new Error('Unexpected response from upload initialization');
    }

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload to storage failed with status ${uploadRes.status}`);
    }

    await ApiClient.post(`/media/${mediaAssetId}/confirm`, {});

    return {
      id: mediaAssetId,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    };
  },
};
