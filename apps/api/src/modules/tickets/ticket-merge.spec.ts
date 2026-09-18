import { describe, expect, it } from 'vitest';
import { mergeTicketsSchema, unmergeTicketSchema } from './ticket.dto';

describe('Ticket Merge & Unmerge DTO & Logic Validation', () => {
  const validUuid1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validUuid2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const validUuid3 = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  it('validates valid mergeTickets payload successfully', () => {
    const payload = {
      primaryTicketId: validUuid1,
      secondaryTicketIds: [validUuid2, validUuid3],
      note: 'Customer opened duplicate tickets via portal and email',
    };

    const parsed = mergeTicketsSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.primaryTicketId).toBe(validUuid1);
      expect(parsed.data.secondaryTicketIds).toHaveLength(2);
      expect(parsed.data.note).toBe('Customer opened duplicate tickets via portal and email');
    }
  });

  it('rejects merge payload when secondaryTicketIds is empty', () => {
    const payload = {
      primaryTicketId: validUuid1,
      secondaryTicketIds: [],
    };

    const parsed = mergeTicketsSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects merge payload with invalid UUIDs', () => {
    const payload = {
      primaryTicketId: 'invalid-id',
      secondaryTicketIds: [validUuid2],
    };

    const parsed = mergeTicketsSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('validates valid unmerge payload successfully', () => {
    const payload = {
      secondaryTicketId: validUuid2,
      note: 'Mistakenly merged ticket, separate customer issue',
    };

    const parsed = unmergeTicketSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.secondaryTicketId).toBe(validUuid2);
      expect(parsed.data.note).toBe('Mistakenly merged ticket, separate customer issue');
    }
  });

  it('simulates merge state transition and relational link properties', () => {
    // Master ticket
    const masterTicket = {
      id: validUuid1,
      number: 'ABI-5000',
      subject: 'Login issues on dashboard',
      status: 'OPEN',
      linksTo: [] as any[],
    };

    // Secondary ticket
    const secondaryTicket = {
      id: validUuid2,
      number: 'ABI-5001',
      subject: 'Cannot login to account',
      status: 'OPEN',
      linksFrom: [] as any[],
    };

    // 1. Perform merge simulation
    const mergeLink = {
      id: 'link-1',
      type: 'MERGED_INTO',
      sourceId: secondaryTicket.id,
      targetId: masterTicket.id,
      source: {
        id: secondaryTicket.id,
        number: secondaryTicket.number,
        subject: secondaryTicket.subject,
        status: 'CLOSED',
      },
      target: {
        id: masterTicket.id,
        number: masterTicket.number,
        subject: masterTicket.subject,
        status: masterTicket.status,
      },
    };

    secondaryTicket.status = 'CLOSED';
    masterTicket.linksTo.push(mergeLink);
    secondaryTicket.linksFrom.push(mergeLink);

    expect(secondaryTicket.status).toBe('CLOSED');
    expect(masterTicket.linksTo).toHaveLength(1);
    expect(masterTicket.linksTo[0].source.number).toBe('ABI-5001');
    expect(secondaryTicket.linksFrom[0].target.number).toBe('ABI-5000');

    // 2. Perform unmerge simulation
    masterTicket.linksTo = masterTicket.linksTo.filter((l) => l.sourceId !== secondaryTicket.id);
    secondaryTicket.linksFrom = secondaryTicket.linksFrom.filter((l) => l.targetId !== masterTicket.id);
    secondaryTicket.status = 'OPEN';

    expect(masterTicket.linksTo).toHaveLength(0);
    expect(secondaryTicket.linksFrom).toHaveLength(0);
    expect(secondaryTicket.status).toBe('OPEN');
  });
});
