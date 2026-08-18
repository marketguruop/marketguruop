import type { RiskLevel } from '@/lib/domain/enums'

/**
 * Three-tier action policy. Anything not listed is treated as `confirm`
 * (fail closed) rather than silently allowed.
 */

export const SAFE_ACTIONS = [
  'analyze_text',
  'classify_inbox_item',
  'create_task',
  'update_task',
  'create_draft',
  'create_note',
  'create_idea',
  'compute_priority',
  'build_plan',
  'create_time_block',
  'merge_duplicates',
  'log_energy',
  'create_memory',
] as const

export const CONFIRM_ACTIONS = [
  'create_calendar_event',
  'update_calendar_event',
  'move_calendar_event',
  'delete_calendar_event',
  'send_telegram_message',
  'send_email',
  'publish_content',
  'create_automation',
  'enable_automation',
  'update_finance_record',
  'delete_task',
  'delegate_task',
] as const

export const FORBIDDEN_ACTIONS = [
  'financial_transfer',
  'expose_credentials',
  'change_security_settings',
  'bulk_delete',
  'send_document_to_unknown_recipient',
] as const

export type ActionKind =
  | (typeof SAFE_ACTIONS)[number]
  | (typeof CONFIRM_ACTIONS)[number]
  | (typeof FORBIDDEN_ACTIONS)[number]
  | (string & {})

const SAFE = new Set<string>(SAFE_ACTIONS)
const CONFIRM = new Set<string>(CONFIRM_ACTIONS)
const FORBIDDEN = new Set<string>(FORBIDDEN_ACTIONS)

export function classifyAction(kind: string): RiskLevel {
  if (FORBIDDEN.has(kind)) return 'forbidden'
  if (SAFE.has(kind)) return 'safe'
  if (CONFIRM.has(kind)) return 'confirm'
  return 'confirm'
}

export function isAutoApplicable(kind: string): boolean {
  return classifyAction(kind) === 'safe'
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  safe: 'Выполняется автоматически',
  confirm: 'Нужно подтверждение',
  forbidden: 'Запрещено без отдельного доступа',
}
