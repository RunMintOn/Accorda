import type { InputAction } from './inputState'

export function parseKeyBuffer(buffer: Buffer): InputAction | null {
  const bytes = Array.from(buffer)

  if (bytes.length === 1 && bytes[0] === 13) return { type: 'submit' }
  if (bytes.length === 2 && bytes[0] === 27 && bytes[1] === 13) {
    return { type: 'submit' }
  }
  if (
    bytes.length === 3 &&
    bytes[0] === 27 &&
    bytes[1] === 91 &&
    bytes[2] === 68
  ) {
    return { type: 'move_left' }
  }
  if (
    bytes.length === 3 &&
    bytes[0] === 27 &&
    bytes[1] === 91 &&
    bytes[2] === 67
  ) {
    return { type: 'move_right' }
  }
  if (bytes.length === 1 && (bytes[0] === 127 || bytes[0] === 8)) {
    return { type: 'backspace' }
  }
  if (bytes.length === 1 && bytes[0] === 3) return null

  const text = buffer.toString('utf8')
  if (text) return { type: 'insert', text }
  return null
}
