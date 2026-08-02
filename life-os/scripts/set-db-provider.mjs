#!/usr/bin/env node
/**
 * Prisma requires a literal `provider` in the datasource block — env() is
 * rejected at validation time. This script rewrites that one line to match
 * DATABASE_URL so the same schema serves SQLite locally and PostgreSQL in
 * production, instead of maintaining two schema files that drift apart.
 *
 *   node scripts/set-db-provider.mjs            # infer from DATABASE_URL
 *   node scripts/set-db-provider.mjs postgresql # force
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(here, '..', 'prisma', 'schema.prisma')

function inferProvider() {
  const explicit = process.argv[2]
  if (explicit) return explicit
  const url = process.env.DATABASE_URL ?? ''
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgresql'
  if (url.startsWith('mysql://')) return 'mysql'
  return 'sqlite'
}

const provider = inferProvider()
if (!['sqlite', 'postgresql', 'mysql'].includes(provider)) {
  console.error(`Unsupported provider: ${provider}`)
  process.exit(1)
}

const schema = readFileSync(schemaPath, 'utf8')
const updated = schema.replace(/provider\s*=\s*"(sqlite|postgresql|mysql)"/, `provider = "${provider}"`)

if (updated === schema) {
  console.log(`Prisma provider already set to "${provider}".`)
} else {
  writeFileSync(schemaPath, updated)
  console.log(`Prisma provider set to "${provider}".`)
}
