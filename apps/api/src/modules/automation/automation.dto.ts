import { z } from 'zod';

export const ConditionOperatorSchema = z.enum([
  'eq',
  'neq',
  'in',
  'not_in',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'gt',
  'gte',
  'lt',
  'lte',
  'is_empty',
  'is_not_empty',
]);

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

export const SingleConditionSchema = z.object({
  field: z.string().min(1).max(80),
  op: ConditionOperatorSchema,
  value: z.unknown().optional(),
});

export type SingleCondition = z.infer<typeof SingleConditionSchema>;

export interface ConditionGroup {
  all?: Array<SingleCondition | ConditionGroup>;
  any?: Array<SingleCondition | ConditionGroup>;
  none?: Array<SingleCondition | ConditionGroup>;
}

export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    all: z.array(z.union([SingleConditionSchema, ConditionGroupSchema])).optional(),
    any: z.array(z.union([SingleConditionSchema, ConditionGroupSchema])).optional(),
    none: z.array(z.union([SingleConditionSchema, ConditionGroupSchema])).optional(),
  }),
);

export const AutomationActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('assign_agent'),
    userId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('assign_queue'),
    queueId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('assign_team'),
    teamId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('set_priority'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']),
  }),
  z.object({
    type: z.literal('set_status'),
    status: z.enum([
      'NEW',
      'TRIAGE',
      'OPEN',
      'PENDING_CUSTOMER',
      'ON_HOLD',
      'ESCALATED_L2',
      'ESCALATED_L3',
      'IN_DEVELOPMENT',
      'IN_QA',
      'PENDING_RELEASE',
      'RELEASED',
      'PENDING_VERIFICATION',
      'AWAITING_CUSTOMER_CONFIRMATION',
      'RESOLVED',
      'CLOSED',
      'REOPENED',
      'CANCELLED',
    ]),
  }),
  z.object({
    type: z.literal('set_tier'),
    tier: z.enum(['L1', 'L2', 'L3', 'DEV', 'QA']),
  }),
  z.object({
    type: z.literal('set_category'),
    category: z.string().min(1).max(120),
    subcategory: z.string().max(120).optional(),
  }),
  z.object({
    type: z.literal('add_tag'),
    tag: z.string().min(1).max(60),
  }),
  z.object({
    type: z.literal('remove_tag'),
    tag: z.string().min(1).max(60),
  }),
  z.object({
    type: z.literal('add_internal_note'),
    body: z.string().min(1).max(10000),
  }),
  z.object({
    type: z.literal('add_public_comment'),
    body: z.string().min(1).max(10000),
  }),
  z.object({
    type: z.literal('add_watcher'),
    userId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('mark_spam'),
    isSpam: z.boolean(),
  }),
]);

export type AutomationAction = z.infer<typeof AutomationActionSchema>;

export const AutomationTriggerEnum = z.enum([
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_STATUS_CHANGED',
  'TICKET_ASSIGNED',
  'TICKET_COMMENTED',
  'TICKET_REOPENED',
  'SLA_WARNING',
  'SLA_BREACHED',
  'SCHEDULE',
]);

export type AutomationTrigger = z.infer<typeof AutomationTriggerEnum>;

export const CreateAutomationRuleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  trigger: AutomationTriggerEnum,
  conditions: z.union([SingleConditionSchema, ConditionGroupSchema]).default({}),
  actions: z.array(AutomationActionSchema).min(1),
  schedule: z.string().max(120).optional(),
  priority: z.number().int().min(0).default(0),
  stopOnMatch: z.boolean().default(false),
  maxRunsPerTicket: z.number().int().min(1).max(20).default(3),
  isActive: z.boolean().default(true),
});

export type CreateAutomationRuleDto = z.infer<typeof CreateAutomationRuleSchema>;

export const UpdateAutomationRuleSchema = CreateAutomationRuleSchema.partial();
export type UpdateAutomationRuleDto = z.infer<typeof UpdateAutomationRuleSchema>;

export const AutomationRuleIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type AutomationRuleIdParamDto = z.infer<typeof AutomationRuleIdParamSchema>;

export const ListAutomationRulesSchema = z.object({
  trigger: AutomationTriggerEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});
export type ListAutomationRulesDto = z.infer<typeof ListAutomationRulesSchema>;

export const TestAutomationRuleSchema = z.object({
  ticketId: z.string().uuid(),
});
export type TestAutomationRuleDto = z.infer<typeof TestAutomationRuleSchema>;

export const ReorderAutomationRulesSchema = z.object({
  ruleIds: z.array(z.string().uuid()).min(1),
});
export type ReorderAutomationRulesDto = z.infer<typeof ReorderAutomationRulesSchema>;
