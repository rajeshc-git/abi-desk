import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { Client } from 'pg';
import { Public, SkipCsrf } from '../../common/auth/auth.decorators';

@Controller({ path: 'db-explorer', version: '1' })
export class DbExplorerController {
  private getClient(): Client {
    // Read from owner connection string so it has migration and schema permissions
    let connStr = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || '';

    // Adapt localhost connections for docker container internal network
    if (connStr.includes('@localhost') || connStr.includes('@127.0.0.1')) {
      connStr = connStr.replace('@localhost', '@postgres').replace('@127.0.0.1', '@postgres');
    }

    return new Client({
      connectionString: connStr,
    });
  }

  @Public()
  @SkipCsrf()
  @Post('query')
  @HttpCode(HttpStatus.OK)
  async runQuery(@Body() dto: { sql: string }) {
    const client = this.getClient();
    try {
      await client.connect();
      const res = await client.query(dto.sql);

      return {
        success: true,
        command: res.command,
        rowCount: res.rowCount,
        fields: res.fields.map((f) => ({ name: f.name })),
        rows: res.rows,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
      };
    } finally {
      await client.end().catch(() => {});
    }
  }

  @Public()
  @SkipCsrf()
  @Get('meta')
  @HttpCode(HttpStatus.OK)
  async getMeta() {
    const client = this.getClient();
    try {
      await client.connect();

      // Get all tables in public schema
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      const tables = tablesRes.rows.map((r) => r.table_name);

      return {
        success: true,
        tables,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err),
      };
    } finally {
      await client.end().catch(() => {});
    }
  }
}
