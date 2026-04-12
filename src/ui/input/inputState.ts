export type InputAction =
  | { type: 'insert'; text: string }
  | { type: 'move_left' }
  | { type: 'move_right' }
  | { type: 'backspace' }
  | { type: 'newline' }
  | { type: 'submit' }

export type InputState = {
  value: string
  cursor: number
  submitted: boolean
}

export function createInputState(value = ''): InputState {
  return {
    value,
    cursor: value.length,
    submitted: false,
  }
}

export function applyInputAction(
  state: InputState,
  action: InputAction,
): InputState {
  if (action.type === 'insert') {
    const value =
      state.value.slice(0, state.cursor) +
      action.text +
      state.value.slice(state.cursor)
    return {
      value,
      cursor: state.cursor + action.text.length,
      submitted: false,
    }
  }

  if (action.type === 'move_left') {
    return { ...state, cursor: Math.max(0, state.cursor - 1), submitted: false }
  }

  if (action.type === 'move_right') {
    return {
      ...state,
      cursor: Math.min(state.value.length, state.cursor + 1),
      submitted: false,
    }
  }

  if (action.type === 'backspace') {
    if (state.cursor === 0) return { ...state, submitted: false }

    return {
      value:
        state.value.slice(0, state.cursor - 1) +
        state.value.slice(state.cursor),
      cursor: state.cursor - 1,
      submitted: false,
    }
  }

  if (action.type === 'newline') {
    return applyInputAction(state, { type: 'insert', text: '\n' })
  }

  return {
    ...state,
    submitted: state.value.trim().length > 0,
  }
}
