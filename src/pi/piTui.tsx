import React from 'react'
import { render } from 'ink'
import { PiTuiApp } from './PiTuiApp.js'

export function runPiTui() {
  render(<PiTuiApp />)
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runPiTui()
}
