import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { type FastifyReply } from 'fastify';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermission,
} from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { type AnalyticsFilterDto, type ExportReportDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @RequireAnyPermission('report:view:tenant', 'report:view:own')
  getOverview(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getOverview(principal, filter);
  }

  @Get('timeline')
  @RequireAnyPermission('report:view:tenant', 'report:view:own')
  getTimeline(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getTimelineTrends(principal, filter);
  }

  @Get('heatmap')
  @RequireAnyPermission('report:view:tenant', 'report:view:own')
  getHeatmap(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getHourlyHeatmap(principal, filter);
  }

  @Get('volume')
  @RequireAnyPermission('report:view:tenant', 'report:view:own')
  getVolume(@CurrentUser() principal: AuthenticatedPrincipal, @Query() filter: AnalyticsFilterDto) {
    return this.analyticsService.getVolumeBreakdown(principal, filter);
  }

  @Get('sla')
  @RequireAnyPermission('report:view:tenant', 'report:view:own')
  getSlaMetrics(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getSlaMetrics(principal, filter);
  }

  @Get('csat')
  @RequireAnyPermission('report:view:tenant', 'report:view:own')
  getCsat(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.analyticsService.getCsatDistribution(principal);
  }

  @Get('agents')
  @RequirePermission('report:view:tenant')
  getAgentPerformance(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() filter: AnalyticsFilterDto,
  ) {
    return this.analyticsService.getAgentPerformance(principal, filter);
  }

  @Get('queues')
  @RequirePermission('report:view:tenant')
  getQueueDistribution(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.analyticsService.getQueueDistribution(principal);
  }

  @Get('export')
  @RequirePermission('report:export')
  async exportReport(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() dto: ExportReportDto,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.analyticsService.exportReport(principal, dto);
    reply.header('content-type', result.contentType);
    if (dto.format === 'csv') {
      reply.header('content-disposition', 'attachment; filename="ticket-analytics.csv"');
    }
    return reply.send(result.data);
  }
}
