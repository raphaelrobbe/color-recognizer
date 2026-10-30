import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (ios) setIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (promptEvent) {
    return (
      <button
        type="button"
        className="mt-4 rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white"
        onClick={() => {
          void promptEvent.prompt().then(() => setPromptEvent(null))
        }}
      >
        Installer l'application
      </button>
    )
  }

  if (iosHint) {
    return (
      <p className="mt-4 text-sm text-neutral-700">
        Pour l'installer sur l'iPhone : Partager, puis Sur l'écran d'accueil.
      </p>
    )
  }

  return null
}
