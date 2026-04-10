import type { EventRecord } from '../core/contracts'
import { STAGE_ONE_TOOLS, STAGE_TWO_TOOLS } from '../tools/registry'

type APIRole = 'user' | 'assistant' | 'tool'

type APIMessage = {
  role: APIRole
  content: string
}

function projectEventToMessage(event: EventRecord): APIMessage | null {
  switch (event.type) {
    case 'user_message':
      return { role: 'user', content: String(event.payload.text ?? '') }
    case 'assistant_text':
      return { role: 'assistant', content: String(event.payload.text ?? '') }
    case 'tool_result':
      return { role: 'tool', content: JSON.stringify(event.payload) }
    default:
      return null
  }
}

export function compileStageOneInput(events: EventRecord[]) {
  return {
    messages: events.map(projectEventToMessage).filter(Boolean),
    toolNames: STAGE_ONE_TOOLS.map(tool => tool.name),
  }
}

export function compileStageTwoInput(events: EventRecord[]) {
  return {
    messages: events.map(projectEventToMessage).filter(Boolean),
    toolNames: STAGE_TWO_TOOLS.map(tool => tool.name),
  }
}
