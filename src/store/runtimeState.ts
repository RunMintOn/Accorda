import type { RuntimeState } from '../core/contracts'

export function createRuntimeState(): RuntimeState {
  return {
    isLoading: false,
    inStageTwo: false,
    streamingText: '',
    pendingPermissionRequest: null,
  }
}
