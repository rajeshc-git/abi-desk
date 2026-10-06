import { Controller, Post, Body, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { Client } from 'pg';
import { Public, SkipCsrf } from '../../common/auth/auth.decorators';

/**
 * Normalizes SQL query strings:
 * - Strips zero-width characters and UTF-8 BOM
 * - Normalizes Unicode spaces and non-breaking spaces
 * - Normalizes smart quotes (curly quotes) to standard SQL quotes
 * - Converts MySQL backticks (`identifier`) to standard PostgreSQL double quotes ("identifier")
 */
function normalizeSql(rawSql: string): string {
  if (!rawSql) return '';

  let cleaned = rawSql
    // Remove UTF-8 byte order mark (BOM) & zero-width characters
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
    // Normalize Unicode spaces (non-breaking space, thin space, etc.) to regular space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Normalize Unicode / smart double quotes to standard double quotes
    .replace(/[“”„‟«»]/g, '"')
    // Normalize Unicode / smart single quotes & backticks used as quotes to standard single quotes
    .replace(/[‘’‚‛′‵]/g, "'");

  // Convert MySQL backticks `tableName` -> "tableName" if used as identifiers
  cleaned = cleaned.replace(/`([^`]+)`/g, '"$1"');

  // Automatically wrap PostgreSQL reserved table keywords (e.g. user, role, session, order, group)
  // in double quotes when they appear in table positions (FROM, UPDATE, INTO, JOIN, TABLE, TRUNCATE)
  const reservedTables = ['user', 'role', 'session', 'order', 'group', 'table'];
  for (const t of reservedTables) {
    const tableRegex = new RegExp(`\\b(FROM|UPDATE|INTO|JOIN|TABLE|TRUNCATE)\\s+(ONLY\\s+)?(${t})\\b`, 'gi');
    cleaned = cleaned.replace(tableRegex, (_match, p1, p2, p3) => {
      const only = p2 ? `${p2}` : '';
      return `${p1} ${only}"${p3.toLowerCase()}"`;
    });
  }

  return cleaned.trim();
}

@Controller({ path: 'db-explorer', version: '1' })
export class DbExplorerController {
  private getClient(): Client {
    // Read from owner connection string so it has migration and full DDL/DML permissions
    const connStr = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || '';

    return new Client({
      connectionString: connStr,
    });
  }

  @Public()
  @SkipCsrf()
  @Post('query')
  @HttpCode(HttpStatus.OK)
  async runQuery(@Body() dto: { sql: string }) {
    const rawSql = dto?.sql || '';
    const cleanedSql = normalizeSql(rawSql);

    if (!cleanedSql) {
      return {
        success: false,
        error: 'SQL query cannot be empty.',
        executionTimeMs: 0,
        notices: [],
      };
    }

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
      const res = await client.query(cleanedSql);
      const executionTimeMs = Date.now() - startTime;

      const results: any[] = Array.isArray(res) ? res : [res];
      const lastResult = results[results.length - 1] || {};

      // Find if any statement produced rows (e.g. SELECT, UPDATE/INSERT ... RETURNING)
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
        } else if (['CREATE', 'ALTER', 'DROP', 'TRUNCATE'].some((d) => cmd.includes(d))) {
          return `${cmd} executed successfully`;
        }
        return `${r.command || 'COMMAND'} executed successfully (rows: ${count})`;
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
        schema: err.schema,
        table: err.table,
        column: err.column,
        dataType: err.dataType,
        constraint: err.constraint,
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
