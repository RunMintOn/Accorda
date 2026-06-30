import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'

type ValidationResult = { errors: string[]; warnings: string[] }

const dataDir = join(cwd(), 'demo_data', 'retail')

function parseCsv(content: string) {
  const lines = content.trim().split(/\r?\n/)
  const headers = lines[0]?.split(',') ?? []
  return lines.slice(1).map((line, index) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ''])) as Record<string, string> & { __row?: string }
  }).map((row, index) => ({ ...row, __row: String(index + 2) }))
}

async function readCsv(name: string) {
  const content = await readFile(join(dataDir, name), 'utf8')
  const headers = content.split(/\r?\n/, 1)[0]?.split(',') ?? []
  return { headers, rows: parseCsv(content) }
}

function requireHeaders(file: string, headers: string[], required: string[], result: ValidationResult) {
  for (const header of required) {
    if (!headers.includes(header)) result.errors.push(`${file}: missing required header ${header}`)
  }
}

function nonNegativeNumber(file: string, row: Record<string, string>, field: string, result: ValidationResult) {
  const value = Number(row[field])
  if (!Number.isFinite(value) || value < 0) result.errors.push(`${file} row ${row.__row}: ${field} must be a non-negative number`)
  return value
}

function validDate(file: string, row: Record<string, string>, field: string, result: ValidationResult) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row[field] ?? '')) result.errors.push(`${file} row ${row.__row}: ${field} must be YYYY-MM-DD`)
}

async function main() {
  const result: ValidationResult = { errors: [], warnings: [] }

  let sales: Awaited<ReturnType<typeof readCsv>>
  let inventory: Awaited<ReturnType<typeof readCsv>>
  let products: Awaited<ReturnType<typeof readCsv>>
  let rules: unknown

  try {
    sales = await readCsv('sales.csv')
    inventory = await readCsv('inventory.csv')
    products = await readCsv('products.csv')
    rules = JSON.parse(await readFile(join(dataDir, 'rules.json'), 'utf8'))
  } catch (error) {
    console.error(`Retail data validation failed.\n\nerrors:\n- ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
    return
  }

  requireHeaders('sales.csv', sales.headers, ['date', 'store_id', 'sku', 'units', 'revenue'], result)
  requireHeaders('inventory.csv', inventory.headers, ['store_id', 'sku', 'on_hand', 'safety_stock'], result)
  requireHeaders('products.csv', products.headers, ['sku', 'name', 'category', 'gross_margin', 'lead_time_days'], result)

  const productSkus = new Set(products.rows.map(row => row.sku))
  const salesSkus = new Set(sales.rows.map(row => row.sku))
  const inventorySkus = new Set(inventory.rows.map(row => row.sku))
  const warnedNoSales = new Set<string>()

  for (const row of sales.rows) {
    validDate('sales.csv', row, 'date', result)
    nonNegativeNumber('sales.csv', row, 'units', result)
    nonNegativeNumber('sales.csv', row, 'revenue', result)
    if (!productSkus.has(row.sku)) result.errors.push(`sales.csv row ${row.__row}: unknown sku ${row.sku}`)
  }

  for (const row of inventory.rows) {
    nonNegativeNumber('inventory.csv', row, 'on_hand', result)
    nonNegativeNumber('inventory.csv', row, 'safety_stock', result)
    if (!productSkus.has(row.sku)) result.errors.push(`inventory.csv row ${row.__row}: unknown sku ${row.sku}`)
    if (!salesSkus.has(row.sku) && !warnedNoSales.has(row.sku)) {
      result.warnings.push(`inventory SKU ${row.sku} has no sales rows`)
      warnedNoSales.add(row.sku)
    }
  }

  for (const row of products.rows) {
    const margin = nonNegativeNumber('products.csv', row, 'gross_margin', result)
    if (margin > 1) result.errors.push(`products.csv row ${row.__row}: gross_margin must be between 0 and 1`)
    nonNegativeNumber('products.csv', row, 'lead_time_days', result)
    if (!inventorySkus.has(row.sku)) result.warnings.push(`product SKU ${row.sku} has no inventory rows`)
  }

  if (!rules || typeof rules !== 'object') result.errors.push('rules.json: root must be an object')

  if (result.errors.length > 0) {
    console.error(`Retail data validation failed.\n\nerrors:\n${result.errors.map(error => `- ${error}`).join('\n')}`)
    if (result.warnings.length > 0) console.error(`\nwarnings:\n${result.warnings.map(warning => `- ${warning}`).join('\n')}`)
    process.exitCode = 1
    return
  }

  console.log('Retail data validation passed.\n')
  console.log(`files: 4/4`)
  console.log(`sales rows: ${sales.rows.length}`)
  console.log(`inventory rows: ${inventory.rows.length}`)
  console.log(`products: ${products.rows.length}`)
  console.log(`warnings: ${result.warnings.length}`)
  for (const warning of result.warnings) console.log(`- ${warning}`)
}

void main()
