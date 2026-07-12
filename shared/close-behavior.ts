export type CloseBehavior = 'ask' | 'tray' | 'quit'
export type ConfirmCloseBehavior = Exclude<CloseBehavior, 'ask'>
export type ConfirmClosePayload = {
  behavior: ConfirmCloseBehavior
  remember: boolean
}

export const DEFAULT_CLOSE_BEHAVIOR: CloseBehavior = 'ask'

export function mergeCloseBehavior(raw?: string | null): CloseBehavior {
  if (raw === 'tray' || raw === 'quit' || raw === 'ask') return raw
  return DEFAULT_CLOSE_BEHAVIOR
}
