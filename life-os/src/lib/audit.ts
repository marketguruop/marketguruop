import { prisma } from '@/lib/db'

export interface AuditInput {
  userId: string
  actor: string
  action: 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'sync'
  entityType: string
  entityId: string
  before?: unknown
  after?: unknown
}

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before === undefined ? null : JSON.stringify(input.before),
      after: input.after === undefined ? null : JSON.stringify(input.after),
    },
  })
}
