export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastState {
  id: string
  type: ToastType
  message: string
  count: number
  /** bumps whenever the same toast repeats so the dismiss timer restarts */
  nonce: number
}

export const SUCCESS_MS = 3000
export const INFO_MS = 4000
export const ERROR_MS = 6000

export function toastDuration(type: ToastType): number {
  if (type === 'success') return SUCCESS_MS
  if (type === 'error' || type === 'warning') return ERROR_MS
  return INFO_MS
}

/** Only one toast is visible; a repeat of the same type+message is consolidated into a counter. */
export function pushToast(current: ToastState | null, message: string, type: ToastType, id: string): ToastState {
  if (current && current.type === type && current.message === message) {
    return { ...current, count: current.count + 1, nonce: current.nonce + 1 }
  }
  return { id, type, message, count: 1, nonce: 0 }
}
