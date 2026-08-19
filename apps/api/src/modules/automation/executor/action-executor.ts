import { type Prisma } from '@abi-desk/db';
import { type TenantTransaction } from '../../../infra/tenancy/tenant-prisma.service';
import { type AutomationAction } from '../automation.dto';

export interface ActionResult {
  type: string;
  success: boolean;
  details?: Record<string, unknown>;
  error?: string;
}

export class ActionExecutor {
  /**
   * Executes a list of actions against a ticket inside a transaction.
   */
  static async executeActions(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    ruleId: string,
    ruleName: string,
    actions: AutomationAction[],
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      try {
        const res = await this.executeSingleAction(
          tx,
          tenantId,
          ticketId,
          ruleId,
          ruleName,
          action,
        );
        results.push(res);
      } catch (err) {
        results.push({
          type: action.type,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  private static async executeSingleAction(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    ruleId: string,
    ruleName: string,
    action: AutomationAction,
  ): Promise<ActionResult> {
    const systemActorLabel = `Automation: ${ruleName}`;

    switch (action.type) {
      case 'assign_agent': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: { assigneeId: action.userId, lastActivityAt: new Date() },
          select: { id: true, assigneeId: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'ASSIGNED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.userId,
            metadata: { ruleId, action: 'assign_agent', userId: action.userId },
          },
        });

        return { type: 'assign_agent', success: true, details: { assigneeId: ticket.assigneeId } };
      }

      case 'assign_queue': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: { queueId: action.queueId, lastActivityAt: new Date() },
          select: { id: true, queueId: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'QUEUE_CHANGED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.queueId,
            metadata: { ruleId, action: 'assign_queue', queueId: action.queueId },
          },
        });

        return { type: 'assign_queue', success: true, details: { queueId: ticket.queueId } };
      }

      case 'assign_team': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: { teamId: action.teamId, lastActivityAt: new Date() },
          select: { id: true, teamId: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'TEAM_CHANGED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.teamId,
            metadata: { ruleId, action: 'assign_team', teamId: action.teamId },
          },
        });

        return { type: 'assign_team', success: true, details: { teamId: ticket.teamId } };
      }

      case 'set_priority': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: { priority: action.priority, lastActivityAt: new Date() },
          select: { id: true, priority: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'PRIORITY_CHANGED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.priority,
            metadata: { ruleId, action: 'set_priority', priority: action.priority },
          },
        });

        return { type: 'set_priority', success: true, details: { priority: ticket.priority } };
      }

      case 'set_status': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: { status: action.status, lastActivityAt: new Date() },
          select: { id: true, status: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'STATUS_CHANGED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.status,
            metadata: { ruleId, action: 'set_status', status: action.status },
          },
        });

        return { type: 'set_status', success: true, details: { status: ticket.status } };
      }

      case 'set_tier': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: { tier: action.tier, lastActivityAt: new Date() },
          select: { id: true, tier: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'TIER_CHANGED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.tier,
            metadata: { ruleId, action: 'set_tier', tier: action.tier },
          },
        });

        return { type: 'set_tier', success: true, details: { tier: ticket.tier } };
      }

      case 'set_category': {
        const ticket = await tx.ticket.update({
          where: { id: ticketId },
          data: {
            category: action.category,
            subcategory: action.subcategory ?? null,
            lastActivityAt: new Date(),
          },
          select: { id: true, category: true, subcategory: true },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'CATEGORY_CHANGED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.category,
            metadata: {
              ruleId,
              action: 'set_category',
              category: action.category,
              subcategory: action.subcategory,
            },
          },
        });

        return {
          type: 'set_category',
          success: true,
          details: { category: ticket.category, subcategory: ticket.subcategory },
        };
      }

      case 'add_tag': {
        const tagSlug = action.tag.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const tag = await tx.tag.upsert({
          where: { tenantId_slug: { tenantId, slug: tagSlug } },
          create: { tenantId, name: action.tag, slug: tagSlug, usageCount: 1 },
          update: { usageCount: { increment: 1 } },
        });

        await tx.ticketTag.upsert({
          where: { ticketId_tagId: { ticketId, tagId: tag.id } },
          create: { tenantId, ticketId, tagId: tag.id },
          update: {},
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'TAG_ADDED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.tag,
            metadata: { ruleId, action: 'add_tag', tag: action.tag },
          },
        });

        return { type: 'add_tag', success: true, details: { tag: action.tag, tagId: tag.id } };
      }

      case 'remove_tag': {
        const tagSlug = action.tag.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const tag = await tx.tag.findUnique({
          where: { tenantId_slug: { tenantId, slug: tagSlug } },
        });

        if (tag) {
          await tx.ticketTag.deleteMany({
            where: { ticketId, tagId: tag.id },
          });

          await tx.ticketEvent.create({
            data: {
              tenantId,
              ticketId,
              type: 'TAG_REMOVED',
              actorType: 'SYSTEM',
              actorLabel: systemActorLabel,
              toValue: action.tag,
              metadata: { ruleId, action: 'remove_tag', tag: action.tag },
            },
          });
        }

        return { type: 'remove_tag', success: true, details: { tag: action.tag } };
      }

      case 'add_internal_note': {
        const comment = await tx.ticketComment.create({
          data: {
            tenantId,
            ticketId,
            visibility: 'INTERNAL',
            body: action.body,
            isSystem: true,
            systemLabel: systemActorLabel,
          },
        });

        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            internalNoteCount: { increment: 1 },
            lastActivityAt: new Date(),
          },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'INTERNAL_NOTE_ADDED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            metadata: { ruleId, commentId: comment.id },
          },
        });

        return { type: 'add_internal_note', success: true, details: { commentId: comment.id } };
      }

      case 'add_public_comment': {
        const comment = await tx.ticketComment.create({
          data: {
            tenantId,
            ticketId,
            visibility: 'PUBLIC',
            body: action.body,
            isSystem: true,
            systemLabel: systemActorLabel,
          },
        });

        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            publicCommentCount: { increment: 1 },
            lastAgentReplyAt: new Date(),
            lastActivityAt: new Date(),
          },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'COMMENT_ADDED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            metadata: { ruleId, commentId: comment.id },
          },
        });

        return { type: 'add_public_comment', success: true, details: { commentId: comment.id } };
      }

      case 'add_watcher': {
        await tx.ticketWatcher.upsert({
          where: { ticketId_userId: { ticketId, userId: action.userId } },
          create: { tenantId, ticketId, userId: action.userId, isImplicit: true },
          update: {},
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'WATCHER_ADDED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: action.userId,
            metadata: { ruleId, action: 'add_watcher', userId: action.userId },
          },
        });

        return { type: 'add_watcher', success: true, details: { userId: action.userId } };
      }

      case 'mark_spam': {
        await tx.ticket.update({
          where: { id: ticketId },
          data: { isSpam: action.isSpam, lastActivityAt: new Date() },
        });

        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'SPAM_MARKED',
            actorType: 'SYSTEM',
            actorLabel: systemActorLabel,
            toValue: String(action.isSpam),
            metadata: { ruleId, action: 'mark_spam', isSpam: action.isSpam },
          },
        });

        return { type: 'mark_spam', success: true, details: { isSpam: action.isSpam } };
      }

      default: {
        return {
          type: (action as { type: string }).type,
          success: false,
          error: `Unsupported action type: ${(action as { type: string }).type}`,
        };
      }
    }
  }
}
