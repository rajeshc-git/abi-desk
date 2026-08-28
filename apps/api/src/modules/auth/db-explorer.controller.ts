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
    const startTime = Date.now();
    const notices: string[] = [];

    // Capture postgres notices and warnings
    client.on('notice', (msg) => {
      if (msg && msg.message) {
        notices.push(msg.message);
      }
    });

    try {
      await client.connect();
      const res = await client.query(dto.sql);
      const executionTimeMs = Date.now() - startTime;

      const results: any[] = Array.isArray(res) ? res : [res];
      const lastResult = results[results.length - 1] || {};

      // Find if any statement produced rows (e.g. SELECT)
      const resultWithRows =
        results.slice().reverse().find((r) => r.rows && r.rows.length > 0) || lastResult;

      const command = results.map((r) => r.command || 'QUERY').join('; ');
      const totalRowCount = results.reduce(
        (acc, r) => acc + (typeof r.rowCount === 'number' ? r.rowCount : 0),
        0,
      );
      const fields = (resultWithRows.fields || []).map((f: any) => ({ name: f.name }));
      const rows = resultWithRows.rows || [];

      // Generate message lines for each statement in multi-query execution
      const statementMessages = results.map((r) => {
        const cmd = (r.command || 'QUERY').toUpperCase();
        const count = typeof r.rowCount === 'number' ? r.rowCount : 0;
        if (['UPDATE', 'DELETE', 'INSERT'].includes(cmd)) {
          return `${cmd} ${count} (${count} row(s) affected)`;
        } else if (cmd === 'SELECT') {
          return `SELECT (${(r.rows || []).length} row(s) returned)`;
        }
        return `${r.command || 'COMMAND'} executed successfully`;
      });

      const message = `${statementMessages.join(' | ')} (in ${executionTimeMs} ms)`;

      return {
        success: true,
        command,
        rowCount: totalRowCount,
        fields,
        rows,
        executionTimeMs,
        notices,
        message,
        statementMessages,
      };
    } catch (err: any) {
      const executionTimeMs = Date.now() - startTime;
      return {
        success: false,
        error: err.message || String(err),
        executionTimeMs,
        notices,
        position: err.position,
        detail: err.detail,
        hint: err.hint,
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
