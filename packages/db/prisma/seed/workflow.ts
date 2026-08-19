import { type PrismaClient, type Prisma } from '@prisma/client';

/**
 * The product's default ticket pipeline, transcribed from the requirements:
 *
 *   Customer -> Widget -> L1 -> L2 -> L3 -> Development -> QA -> Release
 *            -> Verification -> Customer Confirmation -> Closed
 *
 * Seeded with `tenantId = null`, which marks them as global defaults every tenant
 * reads (see the RLS policy on `workflow_transition`). A tenant that needs a
 * different pipeline inserts its own rows rather than having the product patched.
 *
 * Two design points worth noting:
 *
 *  - Escalation states (`ESCALATED_L2`, `ESCALATED_L3`) are hand-off markers, not
 *    working states. The receiving tier accepts the ticket back into `OPEN`, which
 *    keeps "what is being worked on" answerable with one status filter.
 *  - The customer's confirm/reject uses `ticket:confirm_resolution`, never
 *    `ticket:close`. The requirements give Guest ✗ on Close Ticket while the
 *    workflow still ends in Customer Confirmation, and this is how both hold.
 */

type TransitionSeed = Omit<Prisma.WorkflowTransitionCreateManyInput, 'tenantId'>;

const TRANSITIONS: TransitionSeed[] = [
  // ---- Intake and L1 triage ---------------------------------------------
  {
    fromStatus: 'NEW',
    toStatus: 'TRIAGE',
    requiredPermission: 'ticket:update:tenant',
    targetTier: 'L1',
    label: 'Start triage',
    sortOrder: 10,
  },
  {
    fromStatus: 'NEW',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:tenant',
    targetTier: 'L1',
    label: 'Accept and work',
    sortOrder: 20,
  },
  {
    fromStatus: 'NEW',
    toStatus: 'CANCELLED',
    requiredPermission: 'ticket:delete',
    label: 'Cancel',
    requiresComment: true,
    isTerminal: true,
    sortOrder: 900,
  },
  {
    fromStatus: 'TRIAGE',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:tenant',
    label: 'Begin work',
    sortOrder: 10,
  },
  {
    fromStatus: 'TRIAGE',
    toStatus: 'PENDING_CUSTOMER',
    requiredPermission: 'ticket:update:tenant',
    label: 'Request more information',
    requiresComment: true,
    sortOrder: 20,
  },

  // ---- Waiting states ---------------------------------------------------
  {
    fromStatus: 'OPEN',
    toStatus: 'PENDING_CUSTOMER',
    requiredPermission: 'ticket:update:tenant',
    label: 'Request more information',
    requiresComment: true,
    sortOrder: 30,
  },
  {
    fromStatus: 'PENDING_CUSTOMER',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:own',
    label: 'Reply and resume',
    sortOrder: 10,
  },
  {
    fromStatus: 'OPEN',
    toStatus: 'ON_HOLD',
    requiredPermission: 'ticket:update:tenant',
    label: 'Put on hold',
    requiresComment: true,
    sortOrder: 40,
  },
  {
    fromStatus: 'ON_HOLD',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:tenant',
    label: 'Resume',
    sortOrder: 10,
  },

  // ---- Escalation ladder: L1 -> L2 -> L3 --------------------------------
  {
    fromStatus: 'OPEN',
    toStatus: 'ESCALATED_L2',
    requiredPermission: 'ticket:escalate',
    requiredTier: 'L1',
    targetTier: 'L2',
    label: 'Escalate to L2',
    requiresComment: true,
    sortOrder: 50,
  },
  {
    fromStatus: 'TRIAGE',
    toStatus: 'ESCALATED_L2',
    requiredPermission: 'ticket:escalate',
    requiredTier: 'L1',
    targetTier: 'L2',
    label: 'Escalate to L2',
    requiresComment: true,
    sortOrder: 30,
  },
  {
    fromStatus: 'ESCALATED_L2',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:tenant',
    requiredTier: 'L2',
    label: 'Accept at L2',
    sortOrder: 10,
  },
  {
    fromStatus: 'OPEN',
    toStatus: 'ESCALATED_L3',
    requiredPermission: 'ticket:escalate',
    requiredTier: 'L2',
    targetTier: 'L3',
    label: 'Escalate to L3',
    requiresComment: true,
    sortOrder: 60,
  },
  {
    fromStatus: 'ESCALATED_L2',
    toStatus: 'ESCALATED_L3',
    requiredPermission: 'ticket:escalate',
    requiredTier: 'L2',
    targetTier: 'L3',
    label: 'Escalate straight to L3',
    requiresComment: true,
    sortOrder: 20,
  },
  {
    fromStatus: 'ESCALATED_L3',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:tenant',
    requiredTier: 'L3',
    label: 'Accept at L3',
    sortOrder: 10,
  },

  // ---- Engineering hand-off (approval gated) ----------------------------
  {
    fromStatus: 'OPEN',
    toStatus: 'IN_DEVELOPMENT',
    requiredPermission: 'ticket:transition:development',
    requiredTier: 'L3',
    targetTier: 'DEV',
    requiresApproval: true,
    approverRoleKey: 'L3_SUPPORT',
    approvalMode: 'ANY',
    label: 'Raise to development',
    requiresComment: true,
    sortOrder: 70,
  },
  {
    fromStatus: 'ESCALATED_L3',
    toStatus: 'IN_DEVELOPMENT',
    requiredPermission: 'ticket:transition:development',
    requiredTier: 'L3',
    targetTier: 'DEV',
    requiresApproval: true,
    approverRoleKey: 'L3_SUPPORT',
    approvalMode: 'ANY',
    label: 'Raise to development',
    requiresComment: true,
    sortOrder: 20,
  },

  // ---- Development -> QA -> Release --------------------------------------
  {
    fromStatus: 'IN_DEVELOPMENT',
    toStatus: 'IN_QA',
    requiredPermission: 'ticket:transition:qa',
    requiredTier: 'DEV',
    targetTier: 'QA',
    label: 'Hand to QA',
    sortOrder: 10,
  },
  {
    fromStatus: 'IN_QA',
    toStatus: 'IN_DEVELOPMENT',
    requiredPermission: 'ticket:transition:development',
    requiredTier: 'QA',
    targetTier: 'DEV',
    label: 'Reject back to development',
    requiresComment: true,
    sortOrder: 10,
  },
  {
    fromStatus: 'IN_QA',
    toStatus: 'PENDING_RELEASE',
    requiredPermission: 'ticket:transition:release',
    requiredTier: 'QA',
    requiresApproval: true,
    approverRoleKey: 'QA_TEAM',
    approvalMode: 'ANY',
    label: 'Approve for release',
    sortOrder: 20,
  },
  {
    fromStatus: 'PENDING_RELEASE',
    toStatus: 'RELEASED',
    requiredPermission: 'ticket:transition:release',
    label: 'Mark released',
    sortOrder: 10,
  },

  // ---- Verification and customer confirmation ---------------------------
  {
    fromStatus: 'RELEASED',
    toStatus: 'PENDING_VERIFICATION',
    requiredPermission: 'ticket:update:tenant',
    targetTier: 'L2',
    label: 'Verify fix',
    sortOrder: 10,
  },
  {
    fromStatus: 'PENDING_VERIFICATION',
    toStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
    requiredPermission: 'ticket:close',
    label: 'Ask customer to confirm',
    sortOrder: 10,
  },
  {
    fromStatus: 'OPEN',
    toStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
    requiredPermission: 'ticket:close',
    label: 'Propose resolution',
    requiresComment: true,
    sortOrder: 80,
  },
  {
    // The customer's own action. Never `ticket:close`.
    fromStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
    toStatus: 'RESOLVED',
    requiredPermission: 'ticket:confirm_resolution',
    label: 'Confirm resolved',
    sortOrder: 10,
  },
  {
    fromStatus: 'AWAITING_CUSTOMER_CONFIRMATION',
    toStatus: 'REOPENED',
    requiredPermission: 'ticket:confirm_resolution',
    label: 'Not fixed, reopen',
    requiresComment: true,
    sortOrder: 20,
  },
  {
    fromStatus: 'REOPENED',
    toStatus: 'OPEN',
    requiredPermission: 'ticket:update:tenant',
    label: 'Pick back up',
    sortOrder: 10,
  },

  // ---- Resolution and closure -------------------------------------------
  {
    fromStatus: 'OPEN',
    toStatus: 'RESOLVED',
    requiredPermission: 'ticket:close',
    label: 'Resolve',
    requiresComment: true,
    sortOrder: 90,
  },
  {
    fromStatus: 'RESOLVED',
    toStatus: 'CLOSED',
    requiredPermission: 'ticket:close',
    label: 'Close',
    isTerminal: true,
    sortOrder: 10,
  },
  {
    fromStatus: 'RESOLVED',
    toStatus: 'REOPENED',
    requiredPermission: 'ticket:reopen',
    label: 'Reopen',
    requiresComment: true,
    sortOrder: 20,
  },
  {
    fromStatus: 'CLOSED',
    toStatus: 'REOPENED',
    requiredPermission: 'ticket:reopen',
    label: 'Reopen',
    requiresComment: true,
    sortOrder: 10,
  },
  {
    fromStatus: 'OPEN',
    toStatus: 'CANCELLED',
    requiredPermission: 'ticket:delete',
    label: 'Cancel',
    requiresComment: true,
    isTerminal: true,
    sortOrder: 910,
  },
];

export async function seedWorkflowDefaults(prisma: PrismaClient): Promise<number> {
  for (const transition of TRANSITIONS) {
    // No composite unique on (null tenantId, from, to) is usable through Prisma
    // because the constraint is a partial index, so find-then-write.
    const existing = await prisma.workflowTransition.findFirst({
      where: {
        tenantId: null,
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.workflowTransition.update({
        where: { id: existing.id },
        data: { ...transition, tenantId: null },
      });
    } else {
      await prisma.workflowTransition.create({ data: { ...transition, tenantId: null } });
    }
  }

  return TRANSITIONS.length;
}
