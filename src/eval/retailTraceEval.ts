import { readFile } from 'node:fs/promises'
import { cwd } from 'node:process'
import { isAbsolute, join } from 'node:path'

type RetailCase = {
  id: string
  expectedSkill: string
  expectedDataFiles: string[]
  expectedMentions: string[]
  mustNotMention: string[]
}

type Check = { label: string; passed: boolean; details?: string }

type TraceEvent = {
  type?: string
  input?: string
  tool?: string
  command?: string
  target?: string
  summary?: string
  intent?: string
  status?: string
}

const [, , caseId, traceArg] = process.argv

function usage() {
  console.error('Usage: npm run eval:retail:trace -- <case-id> <trace-path>')
}

function parseJsonl(content: string) {
  return content
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line) as TraceEvent
      } catch (error) {
        throw new Error(`trace line ${index + 1}: invalid JSON`)
      }
    })
}

function contains(text: string, needle: string) {
  return text.toLowerCase().includes(needle.toLowerCase())
}

function printGroup(title: string, checks: Check[]) {
  console.log(`\n${title}`)
  for (const check of checks) {
    console.log(`${check.passed ? '✓' : '✗'} ${check.label}${check.details ? ` — ${check.details}` : ''}`)
  }
}

async function main() {
  if (!caseId || !traceArg) {
    usage()
    process.exitCode = 1
    return
  }

  const cases = JSON.parse(await readFile(join(cwd(), 'eval', 'retail_cases.json'), 'utf8')) as RetailCase[]
  const targetCase = cases.find(item => item.id === caseId)
  if (!targetCase) {
    console.error(`Unknown retail eval case: ${caseId}`)
    process.exitCode = 1
    return
  }

  const tracePath = isAbsolute(traceArg) ? traceArg : join(cwd(), traceArg)
  const traceContent = await readFile(tracePath, 'utf8')
  const events = parseJsonl(traceContent)
  const traceText = traceContent
  const commandText = events.map(event => [event.input, event.command, event.target, event.summary, event.intent].filter(Boolean).join('\n')).join('\n')
  const tools = new Set(events.map(event => event.tool).filter(Boolean))

  const skillChecks: Check[] = [
    {
      label: `expected skill ${targetCase.expectedSkill}`,
      passed: events.some(event => typeof event.input === 'string' && contains(event.input, `/skill:${targetCase.expectedSkill}`)),
      details: 'checked trace_started.input',
    },
  ]

  const dataChecks = targetCase.expectedDataFiles.map(file => ({
    label: file,
    passed: contains(commandText, file),
  }))

  const toolChecks: Check[] = [
    { label: 'bash tool used', passed: tools.has('bash') },
  ]

  const mentionChecks = targetCase.expectedMentions.map(mention => ({
    label: mention,
    passed: contains(traceText, mention),
    details: 'trace only contains readable event summaries, not full assistant output',
  }))

  const forbiddenChecks = targetCase.mustNotMention.map(mention => ({
    label: `no ${mention}`,
    passed: !contains(traceText, mention),
  }))

  const jsonChecks: Check[] = [
    {
      label: 'JSON block evidence detected',
      passed: contains(traceText, '```json') || contains(traceText, '"rows"'),
      details: 'may be unavailable because readable trace intentionally omits full tool/assistant output',
    },
  ]

  const hardChecks = [...skillChecks, ...dataChecks, ...toolChecks, ...forbiddenChecks]
  const softChecks = [...mentionChecks, ...jsonChecks]
  const failed = hardChecks.filter(check => !check.passed)
  const warnings = softChecks.filter(check => !check.passed)

  console.log(`Trace eval: ${targetCase.id}`)
  console.log(`trace: ${tracePath}`)
  printGroup('Skill', skillChecks)
  printGroup('Data files', dataChecks)
  printGroup('Tool usage', toolChecks)
  printGroup('Expected mentions (soft)', mentionChecks)
  printGroup('Forbidden mentions', forbiddenChecks)
  printGroup('JSON-grounded evidence (soft)', jsonChecks)

  if (failed.length > 0) {
    console.log(`\nResult: FAIL (${failed.length} failed, ${warnings.length} warning)`)
    process.exitCode = 1
    return
  }

  console.log(`\nResult: PASS (${warnings.length} warning)`)
  if (warnings.length > 0) {
    console.log('Note: expected mentions and JSON evidence are soft checks because readable trace does not store full tool/assistant output.')
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
