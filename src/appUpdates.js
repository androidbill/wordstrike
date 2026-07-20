import { useEffect, useState } from 'react'
import { APP_VERSION } from './version.js'

export async function hardRefresh() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Reload even if the browser does not allow cache or service-worker access.
  }
  window.location.reload()
}

function isNewerVersion(candidate, current) {
  const candidateParts = candidate.split('.').map(Number)
  const currentParts = current.split('.').map(Number)
  const length = Math.max(candidateParts.length, currentParts.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (candidateParts[index] || 0) - (currentParts[index] || 0)
    if (difference !== 0) return difference > 0
  }
  return false
}

export function useUpdateCheck() {
  const [latestVersion, setLatestVersion] = useState(null)

  useEffect(() => {
    let stopped = false

    const check = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
          cache: 'no-store'
        })
        if (!response.ok) return
        const data = await response.json()
        if (!stopped && data.version && isNewerVersion(data.version, APP_VERSION)) {
          setLatestVersion(data.version)
        }
      } catch {
        // Being offline is expected for an installed PWA; try again later.
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }

    check()
    const interval = window.setInterval(check, 10 * 60 * 1000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopped = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return latestVersion
}
