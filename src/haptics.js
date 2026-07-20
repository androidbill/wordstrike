// Vibration pulses (Android; iOS Safari ignores navigator.vibrate).
function buzz(pattern) {
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}

export const hapticHit = () => buzz(30)
export const hapticMiss = () => buzz([15, 40, 15])
export const hapticSolve = () => buzz([40, 30, 60])
export const hapticWrong = () => buzz(80)
export const hapticWin = () => buzz([60, 40, 60, 40, 120])

// In-app turn notification for relaxed games: fires only when the tab is
// hidden, so it never doubles up with what's already on screen.
export async function notifyTurn(title, body) {
  try {
    if (!('Notification' in window) || document.visibilityState === 'visible') return
    if (Notification.permission === 'default') await Notification.requestPermission()
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` })
    }
  } catch { /* notifications unavailable */ }
}

export function requestNotifyPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  } catch { /* ignore */ }
}
