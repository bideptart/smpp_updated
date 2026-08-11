import prisma from './db';

export type AuditAction =
  | 'login_success' | 'login_failed'
  | 'company_created' | 'company_updated' | 'company_deleted'
  | 'connection_created' | 'connection_updated' | 'connection_deleted'
  | 'user_created' | 'user_deleted' | 'password_reset' | 'role_changed';

export async function auditLog(opts: {
  userId?: number | null;
  action: AuditAction;
  resource?: string;
  resourceId?: string | number;
  ip?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const resourceIdStr = opts.resourceId != null ? String(opts.resourceId) : null;
    const detailsJson = opts.details ? JSON.stringify(opts.details) : null;
    await prisma.$executeRawUnsafe(
      `INSERT INTO audit_logs (user_id, action, resource, resource_id, ip_address, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      opts.userId ?? null,
      opts.action,
      opts.resource ?? null,
      resourceIdStr,
      opts.ip ?? null,
      detailsJson
    );
  } catch (e) {
    console.error('[audit]', e);
  }
}