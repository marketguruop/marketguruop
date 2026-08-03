import { z } from 'zod'

/**
 * Every agent that touches data returns one of these shapes. The JSON Schema is
 * sent to the API (`output_config.format`); the Zod schema re-validates the reply.
 * They are kept side by side deliberately so drift is obvious in review.
 */

// ------------------------------------------------------------------ Inbox Agent

export const InboxItemSchema = z.object({
  type: z.enum([
    'task',
    'project',
    'event',
    'idea',
    'content',
    'purchase',
    'contact',
    'finance',
    'health',
    'note',
    'trash',
  ]),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'someday']),
  estimatedMinutes: z.number().int().min(5).max(480),
  energy: z.enum(['low', 'medium', 'high']),
  context: z.enum(['deep', 'admin', 'calls', 'errand', 'creative']).nullable().optional(),
  deadline: z.string().nullable().optional(),
  startsAt: z.string().nullable().optional(),
  nextAction: z.string().nullable().optional(),
  canDelegate: z.boolean(),
  canAutomate: z.boolean(),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable().optional(),
})
export type InboxParsedItem = z.infer<typeof InboxItemSchema>

export const InboxParseSchema = z.object({
  summary: z.string(),
  items: z.array(InboxItemSchema).max(20),
})
export type InboxParseResult = z.infer<typeof InboxParseSchema>

export const INBOX_PARSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string', description: 'Краткое содержание записи, одна строка.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'type',
          'title',
          'description',
          'project',
          'priority',
          'estimatedMinutes',
          'energy',
          'context',
          'deadline',
          'startsAt',
          'nextAction',
          'canDelegate',
          'canAutomate',
          'confidence',
          'needsClarification',
          'clarificationQuestion',
        ],
        properties: {
          type: {
            type: 'string',
            enum: [
              'task', 'project', 'event', 'idea', 'content', 'purchase',
              'contact', 'finance', 'health', 'note', 'trash',
            ],
          },
          title: { type: 'string' },
          description: { type: ['string', 'null'] },
          project: { type: ['string', 'null'], description: 'Название существующего проекта или null.' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'someday'] },
          estimatedMinutes: { type: 'integer' },
          energy: { type: 'string', enum: ['low', 'medium', 'high'] },
          context: { type: ['string', 'null'], enum: ['deep', 'admin', 'calls', 'errand', 'creative', null] },
          deadline: { type: ['string', 'null'], description: 'ISO 8601 или null.' },
          startsAt: { type: ['string', 'null'], description: 'ISO 8601 для событий или null.' },
          nextAction: { type: ['string', 'null'] },
          canDelegate: { type: 'boolean' },
          canAutomate: { type: 'boolean' },
          confidence: { type: 'number' },
          needsClarification: { type: 'boolean' },
          clarificationQuestion: { type: ['string', 'null'] },
        },
      },
    },
  },
}

// ------------------------------------------------------ Chief of Staff briefing

export const BriefSchema = z.object({
  headline: z.string(),
  mainGoal: z.string(),
  outcomes: z.array(z.string()).max(3),
  risks: z.array(z.string()).max(5),
  recommendations: z.array(
    z.object({
      action: z.enum(['do', 'defer', 'delegate', 'automate', 'drop']),
      subject: z.string(),
      why: z.string(),
    }),
  ).max(6),
  closingNote: z.string(),
})
export type BriefResult = z.infer<typeof BriefSchema>

export const BRIEF_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'mainGoal', 'outcomes', 'risks', 'recommendations', 'closingNote'],
  properties: {
    headline: { type: 'string' },
    mainGoal: { type: 'string' },
    outcomes: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'subject', 'why'],
        properties: {
          action: { type: 'string', enum: ['do', 'defer', 'delegate', 'automate', 'drop'] },
          subject: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    closingNote: { type: 'string' },
  },
}

// ---------------------------------------------------------------- Task triage

export const TaskTriageSchema = z.object({
  duplicates: z.array(
    z.object({ keepId: z.string(), mergeIds: z.array(z.string()), reason: z.string() }),
  ).max(20),
  nextActions: z.array(z.object({ taskId: z.string(), nextAction: z.string() })).max(30),
  stalled: z.array(z.object({ taskId: z.string(), reason: z.string() })).max(30),
  delegable: z.array(z.object({ taskId: z.string(), to: z.string(), reason: z.string() })).max(20),
})
export type TaskTriageResult = z.infer<typeof TaskTriageSchema>

export const TASK_TRIAGE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['duplicates', 'nextActions', 'stalled', 'delegable'],
  properties: {
    duplicates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['keepId', 'mergeIds', 'reason'],
        properties: {
          keepId: { type: 'string' },
          mergeIds: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
        },
      },
    },
    nextActions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taskId', 'nextAction'],
        properties: { taskId: { type: 'string' }, nextAction: { type: 'string' } },
      },
    },
    stalled: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taskId', 'reason'],
        properties: { taskId: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    delegable: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taskId', 'to', 'reason'],
        properties: {
          taskId: { type: 'string' },
          to: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
  },
}

// ------------------------------------------------------------ Specialist writes
// Content, Finance, CRM, Business, Energy and Automation return proposals in one
// shared shape. A single materialiser turns them into rows, and anything
// outward-facing is routed through the Approval Center instead of being applied.

export const ProposalKind = z.enum([
  'task',
  'content_idea',
  'content_item',
  'follow_up',
  'automation',
  'project_update',
  'note',
])
export type ProposalKind = z.infer<typeof ProposalKind>

export const ProposalSchema = z.object({
  kind: ProposalKind,
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).nullable().optional(),
  /** Why this is worth doing — shown to the user, never invented filler. */
  reason: z.string().max(500),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'someday']).default('medium'),
  estimatedMinutes: z.number().int().min(5).max(480).default(30),
  /** Name of an existing project; unmatched names are ignored, never created. */
  projectName: z.string().max(120).nullable().optional(),
  contactName: z.string().max(120).nullable().optional(),
  platform: z.enum(['instagram', 'reels', 'stories', 'tiktok', 'threads', 'telegram', 'youtube']).nullable().optional(),
  hook: z.string().max(300).nullable().optional(),
  script: z.string().max(2000).nullable().optional(),
  shotList: z.array(z.string().max(160)).max(12).nullable().optional(),
  dueAt: z.string().nullable().optional(),
  shootAt: z.string().nullable().optional(),
  publishAt: z.string().nullable().optional(),
  savedMinutesPerWeek: z.number().int().min(0).max(600).nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.6),
})
export type Proposal = z.infer<typeof ProposalSchema>

export const SpecialistSchema = z.object({
  summary: z.string(),
  findings: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
    }),
  ).max(8),
  proposals: z.array(ProposalSchema).max(12),
})
export type SpecialistResult = z.infer<typeof SpecialistSchema>

export const SPECIALIST_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings', 'proposals'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'severity'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        },
      },
    },
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind', 'title', 'detail', 'reason', 'priority', 'estimatedMinutes',
          'projectName', 'contactName', 'platform', 'hook', 'script', 'shotList',
          'dueAt', 'shootAt', 'publishAt', 'savedMinutesPerWeek', 'confidence',
        ],
        properties: {
          kind: {
            type: 'string',
            enum: ['task', 'content_idea', 'content_item', 'follow_up', 'automation', 'project_update', 'note'],
          },
          title: { type: 'string' },
          detail: { type: ['string', 'null'] },
          reason: { type: 'string' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'someday'] },
          estimatedMinutes: { type: 'integer' },
          projectName: { type: ['string', 'null'] },
          contactName: { type: ['string', 'null'] },
          platform: {
            type: ['string', 'null'],
            enum: ['instagram', 'reels', 'stories', 'tiktok', 'threads', 'telegram', 'youtube', null],
          },
          hook: { type: ['string', 'null'] },
          script: { type: ['string', 'null'] },
          shotList: { type: ['array', 'null'], items: { type: 'string' } },
          dueAt: { type: ['string', 'null'], description: 'ISO 8601 или null' },
          shootAt: { type: ['string', 'null'] },
          publishAt: { type: ['string', 'null'] },
          savedMinutesPerWeek: { type: ['integer', 'null'] },
          confidence: { type: 'number' },
        },
      },
    },
  },
}

// ------------------------------------------------------------- Advisory report
// Kept for callers that only want analysis without any write.

export const AdvisorySchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({ title: z.string(), detail: z.string(), severity: z.enum(['info', 'warning', 'critical']) })).max(10),
  proposedTasks: z.array(
    z.object({
      title: z.string(),
      nextAction: z.string(),
      priority: z.enum(['critical', 'high', 'medium', 'low', 'someday']),
      estimatedMinutes: z.number().int().min(5).max(480),
    }),
  ).max(10),
})
export type AdvisoryResult = z.infer<typeof AdvisorySchema>

export const ADVISORY_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings', 'proposedTasks'],
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'detail', 'severity'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        },
      },
    },
    proposedTasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'nextAction', 'priority', 'estimatedMinutes'],
        properties: {
          title: { type: 'string' },
          nextAction: { type: 'string' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'someday'] },
          estimatedMinutes: { type: 'integer' },
        },
      },
    },
  },
}
