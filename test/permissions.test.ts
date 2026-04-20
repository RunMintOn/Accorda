import { describe, expect, it } from 'vitest'
import { getDefaultPermissionMode } from '../src/permissions/policy'

describe('default permission policy', () => {
  it('auto-allows read-only and control tools, confirms write and exec tools', () => {
    expect(getDefaultPermissionMode('read')).toBe('allow')
    expect(getDefaultPermissionMode('glob')).toBe('allow')
    expect(getDefaultPermissionMode('ask_user')).toBe('allow')
    expect(getDefaultPermissionMode('finish')).toBe('allow')
    expect(getDefaultPermissionMode('write')).toBe('confirm')
    expect(getDefaultPermissionMode('edit')).toBe('confirm')
    expect(getDefaultPermissionMode('bash')).toBe('confirm')
  })
})
