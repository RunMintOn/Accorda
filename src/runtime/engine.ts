import type { RuntimeTurnResult } from '../core/contracts'
import { createRuntimeState } from '../store/runtimeState'
import type { StageOneRunner } from './stageOne'
import type { StageTwoRunner } from './stageTwo'

type EngineDeps = {
  runStageOne: StageOneRunner
  runStageTwo: StageTwoRunner
}

export function createRuntimeEngine(deps: EngineDeps) {
  return {
    async runTurn(sessionId: string, userText: string): Promise<RuntimeTurnResult> {
      const stageOne = await deps.runStageOne({ sessionId, userText })

      if (stageOne.kind === 'answer') {
        return {
          state: createRuntimeState(
            'answering',
            stageOne.reason ?? 'stage_one_direct_answer',
          ),
          returnedToStageOne: false,
          finalText: stageOne.text,
        }
      }

      if (stageOne.name === 'clarify') {
        return {
          state: createRuntimeState(
            'answering',
            stageOne.reason ?? 'stage_one_clarify_request',
          ),
          returnedToStageOne: false,
          finalText: String(stageOne.input.uncertainty ?? ''),
        }
      }

      const stageTwo = await deps.runStageTwo({ sessionId, userText })

      return {
        state: createRuntimeState(
          'executing',
          stageTwo.reason ?? stageOne.reason ?? 'entered_execution_layer',
        ),
        returnedToStageOne: true,
        finalText: stageTwo.finalText,
        events: stageTwo.events,
      }
    },
  }
}
