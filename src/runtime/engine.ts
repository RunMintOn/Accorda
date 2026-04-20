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
          status:
            stageOne.status ??
            {
              message: 'Answer ready',
              level: 'info',
              stage: 'answering',
              reason: stageOne.reason ?? 'stage_one_direct_answer',
              source: 'stage_one',
            },
          metadata: stageOne.metadata,
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
        status:
          stageTwo.status ??
          {
            message: 'Execution entered',
            level: 'info',
            stage: 'executing',
            reason: stageTwo.reason ?? stageOne.reason ?? 'entered_execution_layer',
            source: 'stage_two',
          },
        metadata: stageTwo.metadata,
      }
    },
  }
}
