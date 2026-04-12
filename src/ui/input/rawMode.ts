type RawModeController = {
  isRawModeSupported: boolean
  setRawMode: (value: boolean) => void
}

export function enableRawMode({
  isRawModeSupported,
  setRawMode,
}: RawModeController) {
  if (!isRawModeSupported) return () => {}

  setRawMode(true)
  return () => {
    setRawMode(false)
  }
}
