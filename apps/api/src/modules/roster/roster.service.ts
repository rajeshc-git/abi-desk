import { Injectable } from '@nestjs/common';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { AppException } from '../../common/errors/app-exception';
import {
  type CreateOrUpdateRosterDto,
  type SaveTeamRosterConfigDto,
  type UpdateManualEditsDto,
} from './roster.dto';
import { Prisma } from '@abi-desk/db';

@Injectable()
export class RosterService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // =========================================================================
  // Team Roster Configuration & Rules
  // =========================================================================

  async getTeamConfig(_principal: AuthenticatedPrincipal, teamId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const team = await this.db.client.team.findFirst({
      where: { id: teamId, tenantId },
      include: {
        brand: true,
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, displayName: true, email: true, status: true, isAvailable: true },
            },
          },
        },
      },
    });

    if (!team) {
      throw AppException.notFound(`Team '${teamId}' not found under this tenant.`);
    }

    const config = await this.db.client.rosterTeamConfig.findUnique({
      where: { teamId },
    });

    return {
      team,
      config: config || {
        teamId,
        morningPerDay: 2,
        eveningPerDay: 2,
        step: 4,
        anchorDate: new Date(),
        offDay: 0,
        skeleton: 1,
        maxDuty: 2,
        rotationOrder: team.members.map((m) => m.userId),
        leaves: [],
        comps: [],
        weekendDuties: [],
        weekdayOverrides: [],
      },
    };
  }

  async saveTeamConfig(
    _principal: AuthenticatedPrincipal,
    teamId: string,
    dto: SaveTeamRosterConfigDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const team = await this.db.client.team.findFirst({
      where: { id: teamId, tenantId },
    });
    if (!team) {
      throw AppException.notFound(`Team '${teamId}' not found under this tenant.`);
    }

    return this.db.client.rosterTeamConfig.upsert({
      where: { teamId },
      create: {
        tenantId,
        teamId,
        morningPerDay: dto.morningPerDay,
        eveningPerDay: dto.eveningPerDay,
        step: dto.step,
        anchorDate: new Date(dto.anchorDate),
        offDay: dto.offDay,
        skeleton: dto.skeleton,
        maxDuty: dto.maxDuty,
        rotationOrder: dto.rotationOrder as Prisma.InputJsonValue,
        leaves: dto.leaves as unknown as Prisma.InputJsonValue,
        comps: dto.comps as unknown as Prisma.InputJsonValue,
        weekendDuties: dto.weekendDuties as unknown as Prisma.InputJsonValue,
        weekdayOverrides: dto.weekdayOverrides as unknown as Prisma.InputJsonValue,
      },
      update: {
        morningPerDay: dto.morningPerDay,
        eveningPerDay: dto.eveningPerDay,
        step: dto.step,
        anchorDate: new Date(dto.anchorDate),
        offDay: dto.offDay,
        skeleton: dto.skeleton,
        maxDuty: dto.maxDuty,
        rotationOrder: dto.rotationOrder as Prisma.InputJsonValue,
        leaves: dto.leaves as unknown as Prisma.InputJsonValue,
        comps: dto.comps as unknown as Prisma.InputJsonValue,
        weekendDuties: dto.weekendDuties as unknown as Prisma.InputJsonValue,
        weekdayOverrides: dto.weekdayOverrides as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // =========================================================================
  // Shift Roster Schedules & Revisions
  // =========================================================================

  async listRosters(_principal: AuthenticatedPrincipal, teamId?: string) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.shiftRoster.findMany({
      where: {
        tenantId,
        ...(teamId ? { teamId } : {}),
      },
      include: {
        team: {
          select: { id: true, name: true, slug: true, tier: true, brandId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoster(_principal: AuthenticatedPrincipal, rosterId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const roster = await this.db.client.shiftRoster.findFirst({
      where: { id: rosterId, tenantId },
      include: {
        team: {
          include: {
            brand: true,
            members: {
              include: {
                user: {
                  select: { id: true, fullName: true, displayName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!roster) {
      throw AppException.notFound(`Shift roster '${rosterId}' not found.`);
    }

    return roster;
  }

  async createRoster(
    _principal: AuthenticatedPrincipal,
    teamId: string,
    dto: CreateOrUpdateRosterDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const team = await this.db.client.team.findFirst({
      where: { id: teamId, tenantId },
    });
    if (!team) {
      throw AppException.notFound(`Team '${teamId}' not found under this tenant.`);
    }

    return this.db.client.shiftRoster.create({
      data: {
        tenantId,
        teamId,
        title: dto.title,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status,
        revision: dto.revision,
        configSnap: dto.configSnap as Prisma.InputJsonValue,
        gridData: dto.gridData as Prisma.InputJsonValue,
        manualEdits: dto.manualEdits as Prisma.InputJsonValue,
        changelog: dto.changelog as unknown as Prisma.InputJsonValue,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }

  async updateRoster(
    _principal: AuthenticatedPrincipal,
    rosterId: string,
    dto: Partial<CreateOrUpdateRosterDto>,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const roster = await this.db.client.shiftRoster.findFirst({
      where: { id: rosterId, tenantId },
    });
    if (!roster) {
      throw AppException.notFound(`Shift roster '${rosterId}' not found.`);
    }

    return this.db.client.shiftRoster.update({
      where: { id: rosterId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.revision !== undefined ? { revision: dto.revision } : {}),
        ...(dto.configSnap !== undefined ? { configSnap: dto.configSnap as Prisma.InputJsonValue } : {}),
        ...(dto.gridData !== undefined ? { gridData: dto.gridData as Prisma.InputJsonValue } : {}),
        ...(dto.manualEdits !== undefined ? { manualEdits: dto.manualEdits as Prisma.InputJsonValue } : {}),
        ...(dto.changelog !== undefined ? { changelog: dto.changelog as unknown as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async publishRoster(
    principal: AuthenticatedPrincipal,
    rosterId: string,
    note?: string,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.shiftRoster.findFirst({
      where: { id: rosterId, tenantId },
    });
    if (!existing) {
      throw AppException.notFound(`Shift roster '${rosterId}' not found.`);
    }

    const nextRevision = existing.revision + (existing.status === 'PUBLISHED' ? 1 : 0);
    const existingLog = (Array.isArray(existing.changelog) ? existing.changelog : []) as Array<Record<string, any>>;
    const updatedLog = [
      {
        at: new Date().toISOString(),
        revision: nextRevision,
        note: note || (existing.status === 'PUBLISHED' ? 'Amended and republished' : 'Published roster schedule'),
        by: principal.userId,
      },
      ...existingLog,
    ];

    return this.db.client.shiftRoster.update({
      where: { id: rosterId },
      data: {
        status: existing.status === 'PUBLISHED' ? 'AMENDED' : 'PUBLISHED',
        revision: nextRevision,
        publishedAt: new Date(),
        changelog: updatedLog as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async deleteRoster(_principal: AuthenticatedPrincipal, rosterId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const roster = await this.db.client.shiftRoster.findFirst({
      where: { id: rosterId, tenantId },
    });
    if (!roster) {
      throw AppException.notFound(`Shift roster '${rosterId}' not found.`);
    }

    await this.db.client.shiftRoster.delete({
      where: { id: rosterId },
    });

    return { success: true, id: rosterId };
  }

  // =========================================================================
  // Product / Application Management
  // =========================================================================

  async listProducts(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.product.findMany({
      where: { tenantId },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        teams: { select: { id: true, name: true, tier: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createProduct(
    _principal: AuthenticatedPrincipal,
    dto: { name: string; slug: string; brandId?: string | null; description?: string },
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.product.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        brandId: dto.brandId ?? null,
        description: dto.description ?? null,
        isActive: true,
      },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async updateProduct(
    _principal: AuthenticatedPrincipal,
    productId: string,
    dto: { name?: string; slug?: string; brandId?: string | null; description?: string; isActive?: boolean },
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!existing) {
      throw AppException.notFound(`Product '${productId}' not found.`);
    }

    return this.db.client.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.brandId !== undefined ? { brandId: dto.brandId ?? null } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async deleteProduct(_principal: AuthenticatedPrincipal, productId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!existing) {
      throw AppException.notFound(`Product '${productId}' not found.`);
    }

    await this.db.client.product.delete({
      where: { id: productId },
    });

    return { success: true, id: productId };
  }
}
