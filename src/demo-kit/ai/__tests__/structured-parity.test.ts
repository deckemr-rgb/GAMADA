/// <reference types="node" />
/**
 * Parity: the site's structured-kind schemas (STRUCTURED_SCHEMAS in ai/live.ts, the default validators of validateStructured in ai/live.ts)
 * must equal the proxy's tool schemas (server/ai-proxy/src/schemas.ts → TOOLS). Both are converted to JSON Schema
 * (input side), descriptions dropped and enums sorted, then compared kind by kind. Also: every proxy mock example
 * passes the site validator, followups + Extracted shapes agree.
 * Needs server/ai-proxy/node_modules (npm --prefix server/ai-proxy install).
 * Run: npx tsx src/demo-kit/ai/__tests__/structured-parity.test.ts
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { z } from 'zod'
import { ExtractedSchema, FOLLOWUPS_SCHEMA, STRUCTURED_KINDS, STRUCTURED_SCHEMAS, validateStructured } from '../live'

function assert(c: unknown, msg: string): asserts c {
  if (!c) throw new Error(msg)
}

interface ServerTool {
  name: string
  kind: string
  schema: unknown
}
interface ServerSchemas {
  TOOLS: Record<string, ServerTool>
  STRUCTURED_KINDS: string[]
  ExtractedSchema: unknown
  toInputSchema: (schema: unknown) => Record<string, unknown>
}
interface ServerMock {
  MOCK_STRUCTURED: Record<string, Record<string, unknown>>
  mockExtract: (kind: string) => unknown
}

const here = path.dirname(fileURLToPath(import.meta.url))
const serverSrc = path.resolve(here, '../../../../server/ai-proxy/src')
const load = async <T,>(file: string): Promise<T> => (await import(pathToFileURL(path.join(serverSrc, file)).href)) as T

/** JSON Schema without descriptions / $schema, enums sorted, object keys sorted → comparable string. */
function canon(js: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (!v || typeof v !== 'object') return v
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v).sort()) {
      if (k === 'description' || k === '$schema') continue
      const x = (v as Record<string, unknown>)[k]
      out[k] = k === 'enum' && Array.isArray(x) ? [...x].sort() : walk(x)
    }
    return out
  }
  return JSON.stringify(walk(js))
}
const siteJson = (schema: z.ZodType) => {
  const js = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>
  return { ...js, type: 'object' }
}

async function main() {
  const server = await load<ServerSchemas>('schemas.ts')
  const mock = await load<ServerMock>('mock.ts')

  // 1. same kinds
  const serverKinds = [...server.STRUCTURED_KINDS].sort()
  const siteKinds = [...STRUCTURED_KINDS].sort()
  assert(JSON.stringify(serverKinds) === JSON.stringify(siteKinds), `kinds differ:\n server ${serverKinds}\n site   ${siteKinds}`)
  assert(siteKinds.length === 31, `31 kinds (${siteKinds.length})`)
  console.log(`kinds: ${siteKinds.length} on both sides OK`)

  // 2. same shape per kind
  const byKind = new Map(Object.values(server.TOOLS).map((t) => [t.kind, t]))
  const diffs: string[] = []
  for (const kind of STRUCTURED_KINDS) {
    const t = byKind.get(kind)!
    const a = canon(server.toInputSchema(t.schema))
    const b = canon(siteJson(STRUCTURED_SCHEMAS[kind]))
    if (a !== b) diffs.push(`${kind} (${t.name}):\n  server ${a}\n  site   ${b}`)
  }
  assert(diffs.length === 0, `shape drift:\n${diffs.join('\n')}`)
  const fu = canon(server.toInputSchema(byKind.get('followups')!.schema)) === canon(siteJson(FOLLOWUPS_SCHEMA))
  assert(fu, 'followups shape drift')
  console.log('shapes: every kind + followups identical (JSON Schema, descriptions ignored) OK')

  // 3. proxy mock examples pass the site validator (validateStructured in ai/live.ts); garbage does not
  for (const t of Object.values(server.TOOLS)) {
    if (t.kind === 'followups') continue
    const v = validateStructured({ kind: t.kind, data: mock.MOCK_STRUCTURED[t.name] })
    assert(v && v.kind === t.kind, `mock ${t.name} rejected by the site`)
    assert(validateStructured({ kind: t.kind, data: { invalid: true } }) === null, `${t.kind}: {invalid:true} accepted`)
  }
  console.log('validator: 24 proxy examples accepted, invalid data rejected OK')

  // 4. Extracted: proxy mock bodies parse on the site; shapes equal apart from `mode` (optional on the site)
  for (const k of ['document', 'invoice', 'cv', 'ktp-specimen']) {
    assert(ExtractedSchema.safeParse(mock.mockExtract(k)).success, `mockExtract(${k}) rejected by the site`)
  }
  const strip = (js: Record<string, unknown>) => {
    const props = { ...(js.properties as Record<string, unknown>) }
    delete props.mode
    return { ...js, properties: props, required: ((js.required as string[]) ?? []).filter((r) => r !== 'mode') }
  }
  const ea = canon(strip(server.toInputSchema(server.ExtractedSchema)))
  const eb = canon(strip(siteJson(ExtractedSchema)))
  assert(ea === eb, `Extracted drift:\n  server ${ea}\n  site   ${eb}`)
  console.log('extract: Extracted shape identical OK')
  console.log('structured parity: all OK')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
