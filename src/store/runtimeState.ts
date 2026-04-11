import type { RuntimeStage, RuntimeState } from '../core/contracts'

export function createRuntimeState(
  stage: RuntimeStage = 'idle',
  reason = 'ready_for_input',
): RuntimeState {
  return {
    stage,
    reason,
    streamingText: '',
    pendingPermissionRequest: null,
  }
}
