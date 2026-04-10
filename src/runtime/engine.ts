import type { StageOneRunner } from './stageOne'
import type { StageTwoRunner } from './stageTwo'

type EngineDeps = {
  runStageOne: StageOneRunner
  runStageTwo: StageTwoRunner
}

export function createRuntimeEngine(deps: EngineDeps) {
  return {
    async runTurn(sessionId: string, userText: string) {
      const stageOne = await deps.runStageOne({ sessionId, userText })

      if (stageOne.kind === 'answer') {
        return {
          returnedToStageOne: false,
          finalText: stageOne.text,
        }
      }

      if (stageOne.name === 'clarify') {
        return {
          returnedToStageOne: false,
          finalText: String(stageOne.input.uncertainty ?? ''),
        }
      }

      await deps.runStageTwo({ sessionId, userText })

      return {
        returnedToStageOne: true,
      }
    },
  }
}
