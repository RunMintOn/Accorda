import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'

type RetailCase = {
  id: string
  level: number
  input: string
  expectedSkill: string
  expectedDataFiles: string[]
  expectedCalculations: string[]
  expectedMentions: string[]
  mustNotMention: string[]
}

const root = cwd()
const casesPath = join(root, 'eval', 'retail_cases.json')
const dataDir = join(root, 'demo_data', 'retail')
const skillsDir = join(root, '.accorda', 'skills')

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function validateCaseShape(value: unknown, index: number, errors: string[]): RetailCase | null {
  if (!value || typeof value !== 'object') {
    errors.push(`case[${index}]: must be an object`)
    return null
  }
  const candidate = value as Partial<RetailCase>
  for (const field of ['id', 'input', 'expectedSkill'] as const) {
    if (typeof candidate[field] !== 'string' || candidate[field]?.trim() === '') errors.push(`case[${index}]: ${field} must be a non-empty string`)
  }
  if (candidate.level !== 1 && candidate.level !== 2) errors.push(`case[${index}]: level must be 1 or 2`)
  for (const field of ['expectedDataFiles', 'expectedCalculations', 'expectedMentions', 'mustNotMention'] as const) {
    if (!isStringArray(candidate[field])) errors.push(`case[${index}]: ${field} must be a string array`)
  }
  if (typeof candidate.id !== 'string' || typeof candidate.input !== 'string' || typeof candidate.expectedSkill !== 'string' || !isStringArray(candidate.expectedDataFiles) || !isStringArray(candidate.expectedCalculations) || !isStringArray(candidate.expectedMentions) || !isStringArray(candidate.mustNotMention) || (candidate.level !== 1 && candidate.level !== 2)) {
    return null
  }
  return candidate as RetailCase
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  const errors: string[] = []
  let rawCases: unknown

  try {
    rawCases = JSON.parse(await readFile(casesPath, 'utf8'))
  } catch (error) {
    console.error(`Retail eval readiness failed.\n\nerrors:\n- ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
    return
  }

  if (!Array.isArray(rawCases)) {
    console.error('Retail eval readiness failed.\n\nerrors:\n- eval/retail_cases.json must be an array')
    process.exitCode = 1
    return
  }

  const cases = rawCases.map((item, index) => validateCaseShape(item, index, errors)).filter((item): item is RetailCase => Boolean(item))
  const ids = new Set<string>()
  const skillCounts = new Map<string, number>()
  const dataFiles = new Set<string>()

  for (const item of cases) {
    if (ids.has(item.id)) errors.push(`case ${item.id}: duplicate id`)
    ids.add(item.id)
    skillCounts.set(item.expectedSkill, (skillCounts.get(item.expectedSkill) ?? 0) + 1)
    for (const file of item.expectedDataFiles) dataFiles.add(file)

    if (!(await exists(join(skillsDir, item.expectedSkill, 'SKILL.md')))) {
      errors.push(`case ${item.id}: expectedSkill ${item.expectedSkill} does not exist under .accorda/skills`)
    }
    for (const file of item.expectedDataFiles) {
      if (!(await exists(join(dataDir, file)))) errors.push(`case ${item.id}: expectedDataFile ${file} does not exist`)
    }
  }

  if (errors.length > 0) {
    console.error(`Retail eval readiness failed.\n\nerrors:\n${errors.map(error => `- ${error}`).join('\n')}`)
    process.exitCode = 1
    return
  }

  console.log('Retail eval readiness passed.\n')
  console.log(`cases: ${cases.length}`)
  console.log(`level 1: ${cases.filter(item => item.level === 1).length}`)
  console.log(`level 2: ${cases.filter(item => item.level === 2).length}`)
  console.log('skills:')
  for (const [skill, count] of [...skillCounts.entries()].sort()) console.log(`- ${skill}: ${count} cases`)
  console.log('data files:')
  for (const file of [...dataFiles].sort()) console.log(`- ${file}`)
}

void main()
