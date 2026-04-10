const ALWAYS_ALLOW = new Set(['ls', 'read', 'glob', 'grep'])
const REQUIRE_CONFIRM = new Set(['write', 'edit', 'bash'])

export function getDefaultPermissionMode(
  toolName: string,
): 'allow' | 'confirm' {
  if (ALWAYS_ALLOW.has(toolName)) return 'allow'
  if (REQUIRE_CONFIRM.has(toolName)) return 'confirm'
  return 'confirm'
}
