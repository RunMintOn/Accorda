import React from 'react'
import { render } from 'ink'
import { App } from './ui/App'

export function main() {
  return render(<App />)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
