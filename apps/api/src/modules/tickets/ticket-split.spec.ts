import { describe, expect, it } from 'vitest';
import { splitTicketSchema } from './ticket.dto';

describe('Ticket Split DTO & Relationship Logic Validation', () => {
  const validUuidComment = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validUuidSource = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const validUuidTeam = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  it('validates valid splitTicket payload successfully', () => {
    const payload = {
      commentId: validUuidComment,
      subject: 'Refund request for invoice #4001',
      description: 'Customer specifically requested a refund on invoice #4001',
      priority: 'HIGH',
      category: 'Billing & Payments',
      tier: 'L2',
      organization: 'Acme Health Corp',
      product: 'Cardiology Pro Suite',
      teamId: validUuidTeam,
    };

    const parsed = splitTicketSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.commentId).toBe(validUuidComment);
      expect(parsed.data.subject).toBe('Refund request for invoice #4001');
      expect(parsed.data.description).toBe('Customer specifically requested a refund on invoice #4001');
      expect(parsed.data.priority).toBe('HIGH');
      expect(parsed.data.category).toBe('Billing & Payments');
      expect(parsed.data.tier).toBe('L2');
      expect(parsed.data.organization).toBe('Acme Health Corp');
      expect(parsed.data.product).toBe('Cardiology Pro Suite');
      expect(parsed.data.teamId).toBe(validUuidTeam);
    }
  });

  it('rejects split payload when subject is too short', () => {
    const payload = {
      commentId: validUuidComment,
      subject: 'ab',
    };

    const parsed = splitTicketSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects split payload when commentId is invalid UUID', () => {
    const payload = {
      commentId: 'invalid-comment-uuid',
      subject: 'New issue from thread',
    };

    const parsed = splitTicketSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('simulates split creation and bidirectional RELATED link', () => {
    // 1. Source Parent Ticket
    const parentTicket = {
      id: validUuidSource,
      number: 'ABI-100',
      subject: 'Lab report generation issue',
      status: 'OPEN',
      tier: 'L2',
      linksTo: [] as any[],
    };

    // 2. Customer Comment to Split
    const customerComment = {
      id: validUuidComment,
      ticketId: parentTicket.id,
      body: 'Can you also provide user access for our new lab tech?',
      author: {
        id: 'cust-1',
        email: 'doctor@hospital.com',
        kind: 'CUSTOMER',
      },
    };

    // 3. New Split Ticket generated
    const splitTicket = {
      id: 'split-ticket-uuid',
      number: 'ABI-101',
      subject: 'User access for new lab tech',
      description: customerComment.body,
      requesterId: customerComment.author.id,
      status: 'OPEN',
      tier: 'L1',
      linksFrom: [] as any[],
    };

    // 4. Create RELATED link
    const relatedLink = {
      id: 'link-split-1',
      type: 'RELATED',
      sourceId: parentTicket.id,
      targetId: splitTicket.id,
      source: {
        id: parentTicket.id,
        number: parentTicket.number,
      },
      target: {
        id: splitTicket.id,
        number: splitTicket.number,
      },
    };

    parentTicket.linksTo.push(relatedLink);
    splitTicket.linksFrom.push(relatedLink);

    // Verify properties
    expect(splitTicket.description).toBe(customerComment.body);
    expect(splitTicket.requesterId).toBe('cust-1');
    expect(parentTicket.linksTo).toHaveLength(1);
    expect(parentTicket.linksTo[0].target.number).toBe('ABI-101');
    expect(splitTicket.linksFrom[0].source.number).toBe('ABI-100');
  });
});
