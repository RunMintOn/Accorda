import { runCli } from './cli/bootstrap'

export async function main() {
  return runCli(process.argv.slice(2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => {
    process.exitCode = code
  })
}
