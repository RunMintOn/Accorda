import { describe, expect, it } from 'vitest'
import {
  applyInputAction,
  createInputState,
} from '../src/ui/input/inputState'
import { parseKeyBuffer } from '../src/ui/input/keyParser'

describe('inputState', () => {
  it('inserts text at the cursor and moves left/right', () => {
    let state = createInputState()
    state = applyInputAction(state, { type: 'insert', text: 'abc' })
    state = applyInputAction(state, { type: 'move_left' })
    state = applyInputAction(state, { type: 'insert', text: 'X' })

    expect(state.value).toBe('abXc')
    expect(state.cursor).toBe(3)
  })

  it('treats Enter as newline and Ctrl+Enter as submit', () => {
    let state = createInputState()
    state = applyInputAction(state, { type: 'insert', text: 'line1' })
    state = applyInputAction(state, { type: 'newline' })
    state = applyInputAction(state, { type: 'insert', text: 'line2' })

    expect(state.value).toBe('line1\nline2')
    expect(state.cursor).toBe('line1\nline2'.length)
    expect(applyInputAction(state, { type: 'submit' }).submitted).toBe(true)
  })

  it('deletes with backspace and ignores empty submission', () => {
    let state = createInputState()
    expect(applyInputAction(state, { type: 'submit' }).submitted).toBe(false)

    state = applyInputAction(state, { type: 'insert', text: 'ab' })
    state = applyInputAction(state, { type: 'backspace' })

    expect(state.value).toBe('a')
    expect(state.cursor).toBe(1)
  })
})

describe('parseKeyBuffer', () => {
  it('maps enter to newline and ctrl+enter to submit', () => {
    expect(parseKeyBuffer(Buffer.from([13]))).toEqual({ type: 'newline' })
    expect(parseKeyBuffer(Buffer.from([27, 13]))).toEqual({ type: 'submit' })
  })

  it('maps arrows and backspace to editor actions', () => {
    expect(parseKeyBuffer(Buffer.from([27, 91, 68]))).toEqual({
      type: 'move_left',
    })
    expect(parseKeyBuffer(Buffer.from([27, 91, 67]))).toEqual({
      type: 'move_right',
    })
    expect(parseKeyBuffer(Buffer.from([127]))).toEqual({ type: 'backspace' })
  })

  it('ignores ctrl-c instead of inserting it into the prompt', () => {
    expect(parseKeyBuffer(Buffer.from([3]))).toBeNull()
  })
})
