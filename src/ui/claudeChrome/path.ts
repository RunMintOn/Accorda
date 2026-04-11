export function truncatePath(path: string, maxWidth = 46): string {
  if (path.length <= maxWidth) return path

  const keep = Math.max(8, maxWidth - 3)
  const left = Math.ceil(keep / 2)
  const right = Math.floor(keep / 2)

  return `${path.slice(0, left)}...${path.slice(path.length - right)}`
}
