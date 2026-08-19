import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';

export const ChatConversationStatusEnum = z.enum(['OPEN', 'QUEUED', 'WAITING', 'CLOSED']);
export type ChatConversationStatus = z.infer<typeof ChatConversationStatusEnum>;

export const ChatMessageKindEnum = z.enum(['TEXT', 'ATTACHMENT', 'SYSTEM', 'TICKET_LINK']);
export type ChatMessageKind = z.infer<typeof ChatMessageKindEnum>;

export const StartConversationSchema = z.object({
  brandId: z.string().uuid().optional(),
  subject: z.string().max(300).optional(),
  pageUrl: z.string().url().max(2048).optional(),
  initialMessage: z.string().min(1).max(5000).optional(),
});
export class StartConversationDto extends createZodDto(StartConversationSchema) {}

export const SendMessageSchema = z.object({
  body: z.string().max(5000).optional(),
  kind: ChatMessageKindEnum.default('TEXT'),
  clientMessageId: z.string().max(64).optional(),
  mediaAssetIds: z.array(z.string().uuid()).optional(),
});
export class SendMessageDto extends createZodDto(SendMessageSchema) {}

export const UpdateTypingSchema = z.object({
  isTyping: z.boolean(),
});
export class UpdateTypingDto extends createZodDto(UpdateTypingSchema) {}

export const PromoteToTicketSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).default('NORMAL'),
  tier: z.enum(['L1', 'L2', 'L3', 'DEV', 'QA']).default('L1'),
  category: z.string().max(100).optional(),
  brandId: z.string().uuid().optional(),
});
export class PromoteToTicketDto extends createZodDto(PromoteToTicketSchema) {}

export const ListConversationsQuerySchema = z.object({
  status: ChatConversationStatusEnum.optional(),
  brandId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export class ListConversationsQueryDto extends createZodDto(ListConversationsQuerySchema) {}
