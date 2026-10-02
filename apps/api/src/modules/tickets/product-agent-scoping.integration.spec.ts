import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { AppConfig } from '../../config/app-config';
import { loadEnv } from '../../config/env.schema';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { PermissionResolverService } from '../authorization/permission-resolver.service';
import { TicketService } from './ticket.service';
import { TenancyAdminService } from '../tenancy-admin/tenancy-admin.service';
import { AuthService } from '../auth/auth.service';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import { SessionService } from '../auth/session.service';
import { OneTimeTokenService } from '../auth/one-time-token.service';
import { MailService } from '../../infra/mail/mail.service';
import { StorageService } from '../../infra/storage/storage.service';
import { AuditService } from '../../common/audit/audit.service';
import { SlaService } from '../sla/sla.service';
import { MediaService } from '../media/media.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';

// Deterministic seed tenant IDs
const ACME_TENANT_ID = '11111111-1111-1111-1111-111111111111';
const GLOBEX_TENANT_ID = '22222222-2222-2222-2222-222222222222';

let prisma: PrismaService;
let tenantPrisma: TenantPrismaService;
let contexts: TenantContextService;
let redis: RedisService;
let permissions: PermissionResolverService;
let tickets: TicketService;
let tenancyAdmin: TenancyAdminService;
let auth: AuthService;
let tokens: TokenService;
let passwords: PasswordService;

let adminPrincipal: AuthenticatedPrincipal;
let adminAuthority: any;
let acmeAdminUser: any;
let l2RoleId: string;
let prodClaimbook: any;
let prodDocuVault: any;

let ticketClaimbookId: string;
let ticketDocuVaultId: string;
let ticketGeneralId: string;

let testAgentId: string;
let testAgentEmail = `test-agent-${Date.now()}@acme.example`;

beforeAll(async () => {
  const config = new AppConfig(loadEnv(process.env));
  const logger = pino({ level: 'silent' });

  prisma = new PrismaService(config, logger);
  await prisma.onModuleInit();

  tenantPrisma = new TenantPrismaService(prisma);
  tenantPrisma.onModuleInit();
  contexts = new TenantContextService();

  redis = new RedisService(config, logger);
  await redis.onModuleInit();

  permissions = new PermissionResolverService(tenantPrisma, redis, logger);
  tokens = new TokenService(config);
  passwords = new PasswordService(config);

  const sessions = new SessionService(tenantPrisma, tokens, redis, config, logger);
  const oneTimeTokens = new OneTimeTokenService(redis);
  const mail = new MailService(config, logger);
  const storage = new StorageService(config, logger);

  auth = new AuthService(
    tenantPrisma,
    contexts,
    passwords,
    tokens,
    sessions,
    oneTimeTokens,
    permissions,
    mail,
    config,
    redis,
    storage,
    logger,
  );

  tenancyAdmin = new TenancyAdminService(
    tenantPrisma,
    contexts,
    config,
    mail,
    permissions,
    logger,
  );

  const auditService = new AuditService(tenantPrisma, logger);
  const slaService = new SlaService(tenantPrisma, contexts, logger);
  const mediaService = new MediaService(tenantPrisma, storage);

  tickets = new TicketService(
    tenantPrisma,
    auditService,
    slaService,
    mediaService,
    mail,
    storage,
    logger,
  );

  // Fetch Acme Admin user and L2_SUPPORT role
  await contexts.runWithBypass('setup', {}, async () => {
    acmeAdminUser = await tenantPrisma.client.user.findFirstOrThrow({
      where: { email: 'admin@acme.example', tenantId: ACME_TENANT_ID },
    });

    const l2Role = await tenantPrisma.client.role.findFirstOrThrow({
      where: { key: 'L2_SUPPORT' },
    });
    l2RoleId = l2Role.id;

    // Create or find test products
    prodClaimbook = await tenantPrisma.client.product.upsert({
      where: { tenantId_slug: { tenantId: ACME_TENANT_ID, slug: 'claimbook-test' } },
      create: {
        tenantId: ACME_TENANT_ID,
        slug: 'claimbook-test',
        name: 'Claimbook',
        isActive: true,
      },
      update: { name: 'Claimbook', isActive: true },
    });

    prodDocuVault = await tenantPrisma.client.product.upsert({
      where: { tenantId_slug: { tenantId: ACME_TENANT_ID, slug: 'docuvault-test' } },
      create: {
        tenantId: ACME_TENANT_ID,
        slug: 'docuvault-test',
        name: 'DocuVault',
        isActive: true,
      },
      update: { name: 'DocuVault', isActive: true },
    });

    adminAuthority = await permissions.resolve(acmeAdminUser.id, ACME_TENANT_ID);
  });

  adminPrincipal = {
    userId: acmeAdminUser.id,
    tenantId: ACME_TENANT_ID,
    kind: 'STAFF',
    roles: adminAuthority.roles,
    permissions: new Set(adminAuthority.permissions),
    isPlatformAdmin: false,
  };
});

afterAll(async () => {
  // Cleanup test tickets & users
  await contexts.runWithBypass('cleanup', {}, async () => {
    if (ticketClaimbookId) await tenantPrisma.client.ticket.deleteMany({ where: { id: ticketClaimbookId } });
    if (ticketDocuVaultId) await tenantPrisma.client.ticket.deleteMany({ where: { id: ticketDocuVaultId } });
    if (ticketGeneralId) await tenantPrisma.client.ticket.deleteMany({ where: { id: ticketGeneralId } });
    if (testAgentId) {
      await tenantPrisma.client.userProduct.deleteMany({ where: { userId: testAgentId } });
      await tenantPrisma.client.userRole.deleteMany({ where: { userId: testAgentId } });
      await tenantPrisma.client.user.deleteMany({ where: { id: testAgentId } });
    }
    await tenantPrisma.client.invitation.deleteMany({ where: { email: testAgentEmail } });
  });

  await redis.onModuleDestroy();
  await prisma.onModuleDestroy();
});

describe('Product-Based Agent Login & Ticket Scoping (Dry Test)', () => {
  it('1. Creates tickets with different product tags under Acme', async () => {
    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      const t1 = await tickets.create(adminPrincipal, {
        subject: 'Claimbook reimbursement issue',
        description: 'Unable to process medical claim #1029.',
        priority: 'HIGH',
        category: 'Billing',
        channel: 'PORTAL',
        customFields: { product: 'Claimbook', organization: 'General Hospital' },
      });
      ticketClaimbookId = t1.id;
      expect(t1.id).toBeDefined();

      const t2 = await tickets.create(adminPrincipal, {
        subject: 'DocuVault certificate sync failed',
        description: 'Syncing documents to vault fails with timeout.',
        priority: 'NORMAL',
        category: 'Technical',
        channel: 'PORTAL',
        customFields: { product: 'DocuVault', organization: 'City Clinic' },
      });
      ticketDocuVaultId = t2.id;
      expect(t2.id).toBeDefined();

      const t3 = await tickets.create(adminPrincipal, {
        subject: 'General enquiry about portal',
        description: 'How do I change my notification settings?',
        priority: 'LOW',
        category: 'General',
        channel: 'PORTAL',
      });
      ticketGeneralId = t3.id;
      expect(t3.id).toBeDefined();
    });
  });

  it('2. Invites an agent scoped strictly to Claimbook', async () => {
    let inviteToken: string = '';

    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      const inviteResult = await tenancyAdmin.inviteUser(adminPrincipal, {
        email: testAgentEmail,
        roleId: l2RoleId,
        productIds: [prodClaimbook.id],
      });
      inviteToken = inviteResult.token;
      expect(inviteResult.email).toBe(testAgentEmail.toLowerCase());
    });

    // Verify invitation preview contains product name
    const preview = await auth.describeInvitation(inviteToken);
    expect(preview.email).toBe(testAgentEmail.toLowerCase());
    expect(preview.productNames).toContain('Claimbook');
    expect(preview.productNames).not.toContain('DocuVault');

    // Accept invitation and create password
    const acceptRes = await auth.acceptInvitation({
      token: inviteToken,
      fullName: 'Claimbook Specialist Agent',
      password: 'StrongPassword123!@#',
      origin: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
    });

    expect(acceptRes.principal.userId).toBeDefined();
    testAgentId = acceptRes.principal.userId;
    expect(acceptRes.principal.productNames).toContain('Claimbook');

    // Verify UserProduct association was created
    const createdUser = await contexts.runWithBypass('verify', {}, async () => {
      return tenantPrisma.client.user.findFirst({
        where: { email: testAgentEmail.toLowerCase() },
        include: { products: { include: { product: true } } },
      });
    });

    expect(createdUser).toBeDefined();
    expect(createdUser!.products).toHaveLength(1);
    expect(createdUser!.products[0].product.name).toBe('Claimbook');
  });

  it('3. Enforces ticket visibility: agent only sees Claimbook tickets', async () => {
    const authority = await contexts.runWithBypass('resolve', {}, () =>
      permissions.resolve(testAgentId, ACME_TENANT_ID),
    );
    expect(authority.productNames).toEqual(['Claimbook']);
    expect(authority.productIds).toEqual([prodClaimbook.id]);

    const agentPrincipal: AuthenticatedPrincipal = {
      userId: testAgentId,
      tenantId: ACME_TENANT_ID,
      kind: 'STAFF',
      roles: authority.roles,
      permissions: new Set(authority.permissions),
      productIds: authority.productIds,
      productNames: authority.productNames,
      isPlatformAdmin: false,
    };

    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      // List tickets as Claimbook agent
      const list = await tickets.list(agentPrincipal, { page: 1, pageSize: 50 });
      const visibleTicketIds = list.tickets.map((t) => t.id);

      // Must see Claimbook ticket
      expect(visibleTicketIds).toContain(ticketClaimbookId);

      // Must NOT see DocuVault or General tickets
      expect(visibleTicketIds).not.toContain(ticketDocuVaultId);
      expect(visibleTicketIds).not.toContain(ticketGeneralId);

      // findById on Claimbook ticket succeeds
      const cbTicket = await tickets.findByIdOrThrow(agentPrincipal, ticketClaimbookId);
      expect(cbTicket.id).toBe(ticketClaimbookId);

      // findById on DocuVault ticket throws 404 (scoped out)
      await expect(tickets.findByIdOrThrow(agentPrincipal, ticketDocuVaultId)).rejects.toThrow();
    });
  });

  it('4. Enforces strict product isolation even when ticket is assigned to the agent', async () => {
    // Directly assign DocuVault ticket to this agent
    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      await tenantPrisma.client.ticket.update({
        where: { id: ticketDocuVaultId },
        data: { assigneeId: testAgentId },
      });
    });

    const authority = await contexts.runWithBypass('resolve', {}, () =>
      permissions.resolve(testAgentId, ACME_TENANT_ID),
    );
    const agentPrincipal: AuthenticatedPrincipal = {
      userId: testAgentId,
      tenantId: ACME_TENANT_ID,
      kind: 'STAFF',
      roles: authority.roles,
      permissions: new Set(authority.permissions),
      productIds: authority.productIds,
      productNames: authority.productNames,
      isPlatformAdmin: false,
    };

    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      const list = await tickets.list(agentPrincipal, { page: 1, pageSize: 50 });
      const visibleTicketIds = list.tickets.map((t) => t.id);

      // Strictly visible only for assigned product (Claimbook)
      expect(visibleTicketIds).toContain(ticketClaimbookId);
      expect(visibleTicketIds).not.toContain(ticketDocuVaultId);
      expect(visibleTicketIds).not.toContain(ticketGeneralId);

      // findById on out-of-scope ticket fails with 404
      await expect(tickets.findByIdOrThrow(agentPrincipal, ticketDocuVaultId)).rejects.toThrow();
    });
  });

  it('5. Tenant Admin updates agent product assignment to include both products', async () => {
    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      await tenancyAdmin.updateUserAdmin(adminPrincipal, testAgentId, {
        productIds: [prodClaimbook.id, prodDocuVault.id],
      });
    });

    // Re-resolve authority (cache was invalidated by updateUserAdmin)
    const updatedAuthority = await contexts.runWithBypass('resolve', {}, () =>
      permissions.resolve(testAgentId, ACME_TENANT_ID),
    );
    expect(updatedAuthority.productNames).toContain('Claimbook');
    expect(updatedAuthority.productNames).toContain('DocuVault');
    expect(updatedAuthority.productIds).toHaveLength(2);

    const multiAgentPrincipal: AuthenticatedPrincipal = {
      userId: testAgentId,
      tenantId: ACME_TENANT_ID,
      kind: 'STAFF',
      roles: updatedAuthority.roles,
      permissions: new Set(updatedAuthority.permissions),
      productIds: updatedAuthority.productIds,
      productNames: updatedAuthority.productNames,
      isPlatformAdmin: false,
    };

    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      const list = await tickets.list(multiAgentPrincipal, { page: 1, pageSize: 50 });
      const visibleTicketIds = list.tickets.map((t) => t.id);

      expect(visibleTicketIds).toContain(ticketClaimbookId);
      expect(visibleTicketIds).toContain(ticketDocuVaultId);
    });
  });

  it('6. Tenant Admin clears product assignments -> agent gets full tenant scope', async () => {
    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      await tenancyAdmin.updateUserAdmin(adminPrincipal, testAgentId, {
        productIds: [],
      });
    });

    const unrestrictedAuthority = await contexts.runWithBypass('resolve', {}, () =>
      permissions.resolve(testAgentId, ACME_TENANT_ID),
    );
    expect(unrestrictedAuthority.productNames).toEqual([]);
    expect(unrestrictedAuthority.productIds).toEqual([]);

    const unrestrictedPrincipal: AuthenticatedPrincipal = {
      userId: testAgentId,
      tenantId: ACME_TENANT_ID,
      kind: 'STAFF',
      roles: unrestrictedAuthority.roles,
      permissions: new Set(unrestrictedAuthority.permissions),
      productIds: unrestrictedAuthority.productIds,
      productNames: unrestrictedAuthority.productNames,
      isPlatformAdmin: false,
    };

    await contexts.runWithTenant(ACME_TENANT_ID, {}, async () => {
      const list = await tickets.list(unrestrictedPrincipal, { page: 1, pageSize: 50 });
      const visibleTicketIds = list.tickets.map((t) => t.id);

      // Now all 3 tickets are visible
      expect(visibleTicketIds).toContain(ticketClaimbookId);
      expect(visibleTicketIds).toContain(ticketDocuVaultId);
      expect(visibleTicketIds).toContain(ticketGeneralId);
    });
  });
});
