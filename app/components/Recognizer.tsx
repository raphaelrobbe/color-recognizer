import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { InstallApp } from '~/components/InstallApp'
import {
  averageRgb,
  colorCodes,
  deltaE,
  fitOklch,
  inkOn,
  maxOklchChroma,
  oklchToRgb,
  rgbToHex,
  rgbToNcs,
  rgbToOklch,
  type Oklch,
  type Rgb,
} from '~/lib/color'
import { loadSavedColors, storeSavedColors, type SavedColor } from '~/lib/saved-colors'
import { colorShareUrl, rgbFromSearch } from '~/lib/share-link'

type Facing = 'environment' | 'user'
type Phase = 'idle' | 'camera' | 'photo' | 'saved' | 'library'

function linkedColor(): Rgb | null {
  if (typeof window === 'undefined') return null
  return rgbFromSearch(window.location.search)
}

const primaryButton =
  'rounded-full bg-neutral-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50'
const secondaryButton =
  'rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 ring-1 ring-black/10'

export function Recognizer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pointRef = useRef<{ x: number; y: number } | null>(null)
  const gestureCleanupRef = useRef<(() => void) | null>(null)

  const [phase, setPhase] = useState<Phase>(() => (linkedColor() ? 'saved' : 'idle'))
  const [facing, setFacing] = useState<Facing>('environment')
  const [opening, setOpening] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [sample, setSample] = useState<Rgb | null>(linkedColor)
  const [draft, setDraft] = useState<Oklch | null>(() => {
    const rgb = linkedColor()
    return rgb ? rgbToOklch(rgb) : null
  })
  const [tweaked, setTweaked] = useState(false)
  const [radius, setRadius] = useState(4)
  const [copied, setCopied] = useState<string | null>(null)
  const [savedColors, setSavedColors] = useState<SavedColor[]>([])
  const [colorName, setColorName] = useState('')
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [libraryFrom, setLibraryFrom] = useState<Phase>('idle')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  pointRef.current = point

  const shown = sample && draft ? (tweaked ? oklchToRgb(draft) : sample) : null
  const codes = shown ? colorCodes(shown) : null
  const shift = sample && shown ? deltaE(sample, shown) : 0

  useEffect(() => {
    setSavedColors(loadSavedColors())
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      gestureCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    return () => {
      if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl)
    }
  }, [photoUrl])

  useEffect(() => {
    if (phase !== 'camera') return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => undefined)
  }, [phase, facing])

  useEffect(() => {
    const current = pointRef.current
    if (!current || !canvasRef.current) return
    readSample(current.x, current.y, radius)
    // The radius is the only trigger: a new tap already samples itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius])

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setReady(false)
  }

  async function openCamera(nextFacing: Facing) {
    setError(null)
    setOpening(true)
    setReady(false)
    stopStream()
    if (!navigator.mediaDevices?.getUserMedia) {
      setOpening(false)
      setError("Cet appareil ne donne pas accès à la caméra depuis cette page. Importez une photo à la place.")
      setPhase('idle')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      setFacing(nextFacing)
      setPhase('camera')
    } catch (caught) {
      setError(cameraMessage(caught))
      setPhase('idle')
    } finally {
      setOpening(false)
    }
  }

  function clearPick() {
    setPoint(null)
    setSample(null)
    setDraft(null)
    setTweaked(false)
  }

  function openExample() {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 900
      canvas.height = 720
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = '#f3eee6'
      context.fillRect(0, 0, canvas.width, canvas.height)
      const logoWidth = 760
      const logoHeight = logoWidth * (46 / 64)
      context.drawImage(image, (canvas.width - logoWidth) / 2, (canvas.height - logoHeight) / 2, logoWidth, logoHeight)
      usePhoto(canvas.toDataURL('image/png'))
    }
    image.src = `${import.meta.env.BASE_URL}logo.svg`
  }

  function usePhoto(url: string) {
    stopStream()
    clearPick()
    setNatural(null)
    setPhotoUrl((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous)
      return url
    })
    setPhase('photo')
  }

  function capture() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    if (facing === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0)
    usePhoto(canvas.toDataURL('image/jpeg', 0.92))
  }

  function onFile(file: File | undefined) {
    if (!file) return
    usePhoto(URL.createObjectURL(file))
  }

  function onImageLoad() {
    const image = imageRef.current
    if (!image) return
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.drawImage(image, 0, 0)
    canvasRef.current = canvas
    setNatural({ w: image.naturalWidth, h: image.naturalHeight })
  }

  function readSample(x: number, y: number, nextRadius: number) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    const sampleRadius = Math.max(0, nextRadius)
    const size = sampleRadius * 2 + 1
    const x0 = clamp(Math.round(x) - sampleRadius, 0, canvas.width - 1)
    const y0 = clamp(Math.round(y) - sampleRadius, 0, canvas.height - 1)
    const width = Math.min(size, canvas.width - x0)
    const height = Math.min(size, canvas.height - y0)
    const rgb = averageRgb(context.getImageData(x0, y0, width, height).data)
    setPoint({ x, y })
    setSample(rgb)
    setDraft(rgbToOklch(rgb))
    setTweaked(false)
  }

  function onPhotoPointerDown(event: PointerEvent<HTMLImageElement>) {
    if (event.button !== 0) return
    const image = imageRef.current
    if (!image || !canvasRef.current) return
    const rect = image.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * image.naturalWidth
    const y = ((event.clientY - rect.top) / rect.height) * image.naturalHeight
    if (x < 0 || y < 0 || x > image.naturalWidth || y > image.naturalHeight) return

    const startX = event.clientX
    const startY = event.clientY
    const pointerId = event.pointerId
    let moved = false

    const onMove = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 12) moved = true
    }
    const finish = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      detach()
      if (ev.type === 'pointercancel' || moved) return
      readSample(x, y, radius)
    }
    const detach = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (gestureCleanupRef.current === detach) gestureCleanupRef.current = null
    }
    gestureCleanupRef.current?.()
    gestureCleanupRef.current = detach
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function openSaved(entry: SavedColor) {
    stopStream()
    setPhotoUrl((previous) => {
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous)
      return null
    })
    setPoint(null)
    setNatural(null)
    canvasRef.current = null
    const rgb = { r: entry.r, g: entry.g, b: entry.b }
    setSample(rgb)
    setDraft(rgbToOklch(rgb))
    setTweaked(false)
    setColorName('')
    setSavedNotice(null)
    setPhase('saved')
  }

  function rememberColor() {
    if (!shown) return
    const name = colorName.trim()
    if (!name) return
    const next = [{ id: newColorId(), name, r: shown.r, g: shown.g, b: shown.b }, ...savedColors]
    setSavedColors(next)
    storeSavedColors(next)
    setColorName('')
    setSavedNotice(name)
  }

  function forgetColor(id: string) {
    const next = savedColors.filter((entry) => entry.id !== id)
    setSavedColors(next)
    storeSavedColors(next)
    if (renamingId === id) setRenamingId(null)
  }

  function openLibrary() {
    setRenamingId(null)
    setLibraryFrom(phase === 'library' ? libraryFrom : phase)
    setPhase('library')
  }

  function closeLibrary() {
    setRenamingId(null)
    setPhase(libraryFrom === 'library' ? 'idle' : libraryFrom)
  }

  function startRename(entry: SavedColor) {
    setRenamingId(entry.id)
    setRenameValue(entry.name)
  }

  function renameColor(id: string) {
    const name = renameValue.trim()
    if (!name) return
    const next = savedColors.map((entry) => (entry.id === id ? { ...entry, name } : entry))
    setSavedColors(next)
    storeSavedColors(next)
    setRenamingId(null)
  }

  function updateDraft(next: Oklch) {
    setDraft(fitOklch(next))
    setTweaked(true)
  }

  async function shareColor(rgb: Rgb, label: string) {
    const url = colorShareUrl(rgb)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'ColorRecognizer', text: label, url })
        return
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
      }
    }
    await copyText('share', url)
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1400)
    } catch {
      setCopied(null)
      setError("La copie a été bloquée par le navigateur.")
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="text-neutral-950">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt=""
            width={78}
            height={56}
            className="h-14 w-auto shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">ColorRecognizer</h1>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          Prenez une photo, touchez l'endroit à mesurer, puis ajustez la pastille avec les curseurs
          jusqu'à ce qu'elle colle à ce que vous voyez.
          <br />
          Enregistrez, partagez.
        </p>
        <InstallApp />
      </header>

      {phase === 'idle' ? (
        <section className="mt-8 rounded-3xl bg-white p-5 shadow-lg">
          <ol className="space-y-3 text-sm text-neutral-700">
            <li><span className="font-semibold text-neutral-950">1.</span> Prenez la photo, à la lumière du lieu.</li>
            <li><span className="font-semibold text-neutral-950">2.</span> Touchez le point dont vous voulez le code.</li>
            <li><span className="font-semibold text-neutral-950">3.</span> Corrigez la teinte, l'intensité et la clarté.</li>
          </ol>
          <div className="mt-6 flex flex-col gap-3">
            <button type="button" className={primaryButton} disabled={opening} onClick={() => void openCamera('environment')}>
              {opening ? 'Ouverture de l’appareil photo…' : 'Prendre une photo'}
            </button>
            <button type="button" className={secondaryButton} onClick={() => fileRef.current?.click()}>
              Importer une image
            </button>
            <button type="button" className={secondaryButton} onClick={() => void openExample()}>
              Essayer sur une image d'exemple
            </button>
            <button type="button" className={secondaryButton} onClick={openLibrary}>
              Couleurs enregistrées{savedColors.length > 0 ? ` (${savedColors.length})` : ''}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </section>
      ) : null}

      {phase === 'library' ? (
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Couleurs enregistrées</h2>
            <button type="button" className="text-sm font-semibold text-neutral-700 underline" onClick={closeLibrary}>
              Retour
            </button>
          </div>
          {savedColors.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">Aucune couleur enregistrée pour le moment.</p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-200">
              {savedColors.map((entry) => (
                <li key={entry.id} className="py-2">
                  {renamingId === entry.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        renameColor(entry.id)
                      }}
                    >
                      <span className="size-10 shrink-0 rounded-xl ring-1 ring-black/10" style={{ backgroundColor: rgbToHex(entry) }} />
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        aria-label="Nouveau nom"
                        maxLength={80}
                        autoFocus
                        className="min-w-0 flex-1 rounded-full border border-neutral-300 px-3 py-2 text-sm text-neutral-950"
                      />
                      <button type="submit" className="shrink-0 text-sm font-semibold text-neutral-950 underline" disabled={!renameValue.trim()}>
                        Valider
                      </button>
                      <button type="button" className="shrink-0 text-sm text-neutral-500 underline" onClick={() => setRenamingId(null)}>
                        Annuler
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openSaved(entry)}>
                        <span className="size-10 shrink-0 rounded-xl ring-1 ring-black/10" style={{ backgroundColor: rgbToHex(entry) }} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{entry.name}</span>
                          <span className="block text-xs text-neutral-500">{rgbToNcs(entry).precise}</span>
                        </span>
                      </button>
                      <button type="button" className="shrink-0 text-sm font-semibold text-neutral-700 underline" onClick={() => startRename(entry)}>
                        Renommer
                      </button>
                      <button type="button" className="shrink-0 text-sm text-neutral-500 underline" onClick={() => forgetColor(entry.id)}>
                        Retirer
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {phase === 'camera' ? (
        <section className="mt-6">
          <div className="overflow-hidden rounded-3xl bg-black shadow-lg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
              className={`aspect-[3/4] w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" className={secondaryButton} onClick={() => { stopStream(); setPhase('idle') }}>
              Annuler
            </button>
            <button
              type="button"
              aria-label="Déclencher"
              disabled={!ready}
              onClick={capture}
              className="size-16 rounded-full border-4 border-neutral-950 bg-white shadow-lg disabled:opacity-40"
            />
            <button
              type="button"
              className={secondaryButton}
              onClick={() => void openCamera(facing === 'environment' ? 'user' : 'environment')}
            >
              Inverser
            </button>
          </div>
        </section>
      ) : null}

      {(phase === 'photo' && photoUrl) || phase === 'saved' ? (
        <section className="mt-6 space-y-4">
          {phase === 'saved' ? (
            <button type="button" className={secondaryButton} onClick={() => setPhase('idle')}>
              Retour
            </button>
          ) : null}
          {phase === 'photo' && photoUrl ? (
            <>
          <div className="relative overflow-hidden rounded-3xl bg-black shadow-lg">
            <img
              ref={imageRef}
              src={photoUrl}
              alt="Photo à mesurer"
              onLoad={onImageLoad}
              onPointerDown={onPhotoPointerDown}
              draggable={false}
              className="block h-auto w-full cursor-crosshair touch-manipulation select-none"
            />
            {point && natural ? (
              <>
                <span
                  className="pointer-events-none absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
                  style={{ left: `${(point.x / natural.w) * 100}%`, top: `${(point.y / natural.h) * 100}%` }}
                />
                {radius > 0 ? (
                  <span
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80"
                    style={{
                      left: `${(point.x / natural.w) * 100}%`,
                      top: `${(point.y / natural.h) * 100}%`,
                      width: `${((radius * 2 + 1) / natural.w) * 100}%`,
                      height: `${((radius * 2 + 1) / natural.h) * 100}%`,
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button type="button" className={secondaryButton} onClick={() => void openCamera(facing)}>
              Reprendre
            </button>
            <button type="button" className={secondaryButton} onClick={() => fileRef.current?.click()}>
              Importer
            </button>
          </div>

          <label className="block rounded-3xl bg-white p-4 shadow-lg">
            <span className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">Lissage du prélèvement</span>
              <span className="tabular-nums text-neutral-500">{radius === 0 ? 'pixel unique' : `rayon ${radius} px`}</span>
            </span>
            <input
              className="mt-3 h-8 w-full"
              type="range"
              min={0}
              max={12}
              step={1}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </label>
            </>
          ) : null}

          {!shown ? (
            <p className="rounded-3xl bg-white px-4 py-5 text-sm text-neutral-700 shadow-lg">
              Touchez l'endroit choisi sur la photo.
            </p>
          ) : null}

          {shown && codes && draft ? (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl shadow-lg" style={{ backgroundColor: rgbToHex(shown) }}>
                <button
                  type="button"
                  aria-label={copied === 'share' ? 'Lien copié' : 'Partager'}
                  className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/15"
                  style={{ color: inkOn(shown) }}
                  onClick={() => void shareColor(shown, codes.ncs.precise)}
                >
                  <ShareIcon />
                </button>
                <div className="flex min-h-52 flex-col items-center justify-center px-4 py-8 text-center" style={{ color: inkOn(shown) }}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">À comparer à ce que vous voyez</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{codes.ncs.precise}</p>
                  {codes.ncs.nearest !== codes.ncs.precise ? (
                    <p className="mt-1 text-sm opacity-80">Nuancier proche : {codes.ncs.nearest}</p>
                  ) : null}
                </div>
              </div>
              {copied === 'share' ? <p className="text-center text-sm font-semibold text-neutral-700">Lien copié.</p> : null}

              <div className="rounded-3xl bg-white p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  {sample ? <Swatch rgb={sample} label="Prélevée" /> : null}
                  <Swatch rgb={shown} label="Corrigée" />
                  <p className="text-sm text-neutral-600">
                    {shift < 0.5 ? 'Pas encore de correction.' : `Écart avec le prélèvement : ΔE ${shift.toFixed(1)}`}
                  </p>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-neutral-600">
                  Ces curseurs compensent l'écart de l'objectif et du capteur. Tenez la pastille à côté de ce que
                  vous voyez et arrêtez-vous quand les deux se confondent.
                </p>
                <div className="mt-4 space-y-4">
                  <Slider
                    label="Teinte"
                    valueLabel={`${Math.round(draft.h)}°`}
                    min={0}
                    max={360}
                    step={1}
                    value={draft.h}
                    background="linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
                    onChange={(value) => updateDraft({ ...draft, h: value })}
                  />
                  <Slider
                    label="Intensité"
                    valueLabel={draft.c.toFixed(3)}
                    min={0}
                    max={Math.max(maxOklchChroma(draft.l, draft.h), 0.001)}
                    step={0.001}
                    value={draft.c}
                    background={`linear-gradient(to right, ${rgbToHex(oklchToRgb({ ...draft, c: 0 }))}, ${rgbToHex(oklchToRgb({ l: draft.l, c: 0.5, h: draft.h }))})`}
                    onChange={(value) => updateDraft({ ...draft, c: value })}
                  />
                  <Slider
                    label="Clarté"
                    valueLabel={`${Math.round(draft.l * 100)}`}
                    min={0}
                    max={1}
                    step={0.001}
                    value={draft.l}
                    background={`linear-gradient(to right, ${rgbToHex(oklchToRgb({ ...draft, l: 0.05 }))}, ${rgbToHex(oklchToRgb({ ...draft, l: 0.96 }))})`}
                    onChange={(value) => updateDraft({ ...draft, l: value })}
                  />
                </div>
                <button
                  type="button"
                  className={`${secondaryButton} mt-4`}
                  disabled={shift < 0.5}
                  onClick={() => {
                    if (!sample) return
                    setDraft(rgbToOklch(sample))
                    setTweaked(false)
                  }}
                >
                  Réinitialiser la correction
                </button>
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    rememberColor()
                  }}
                >
                  <input
                    value={colorName}
                    onChange={(event) => setColorName(event.target.value)}
                    placeholder="Nom de la couleur"
                    aria-label="Nom de la couleur"
                    maxLength={80}
                    className="min-w-0 flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-950"
                  />
                  <button type="submit" className={primaryButton} disabled={!colorName.trim()}>
                    Enregistrer
                  </button>
                </form>
                {savedNotice ? <p className="mt-2 text-sm text-neutral-600">« {savedNotice} » est enregistrée.</p> : null}
                <button type="button" className={`${secondaryButton} mt-4`} onClick={openLibrary}>
                  Couleurs enregistrées{savedColors.length > 0 ? ` (${savedColors.length})` : ''}
                </button>
              </div>

              <div className="rounded-3xl bg-white p-4 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold">Codes de la pastille corrigée</h2>
                  <button type="button" className="text-sm font-semibold text-neutral-700 underline" onClick={() => void copyText('all', codes.text)}>
                    {copied === 'all' ? 'Copié' : 'Tout copier'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Noirceur {codes.ncs.blackness} · chromaticité {codes.ncs.chromaticness} · blancheur {codes.ncs.whiteness} · {codes.ncs.hueLabel}
                </p>
                <ul className="mt-3 divide-y divide-neutral-200">
                  {codes.lines.map((line) => (
                    <li key={line.id} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-neutral-500">{line.label}</p>
                        <p className={`tabular-nums ${line.id === 'ncs' ? 'text-lg font-semibold' : 'text-sm'}`}>{line.value}</p>
                      </div>
                      <button type="button" className="shrink-0 text-sm font-semibold text-neutral-700 underline" onClick={() => void copyText(line.id, line.value)}>
                        {copied === line.id ? 'Copié' : 'Copier'}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                  Le NCS affiché est une estimation CIELAB (noirceur d'Evans, teintes élémentaires R 25°, Y 92°, G 163°, B 253°).
                  Le nuancier officiel est sous licence : confirmez le code sur un éventail avant une commande de peinture.
                  RVB, hexadécimal, TSL, TSV, CMJN, CIELAB et OKLCH décrivent la pastille affichée.
                </p>
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-800">{error}</p> : null}
        </section>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          onFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </main>
  )
}

function newColorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `color-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.5v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 8 12 3.5 16.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12.5V18a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Slider({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  background,
  onChange,
}: {
  label: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  background: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-neutral-500">{valueLabel}</span>
      </span>
      <input
        className="h-8 w-full cursor-pointer appearance-none rounded-full"
        style={{ background }}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function Swatch({ rgb, label }: { rgb: Rgb; label: string }) {
  return (
    <div className="shrink-0">
      <div className="size-12 rounded-2xl ring-1 ring-black/10" style={{ backgroundColor: rgbToHex(rgb) }} />
      <p className="mt-1 text-center text-xs text-neutral-500">{label}</p>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cameraMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return "L'accès à l'appareil photo a été refusé."
    if (error.name === 'NotFoundError') return 'Aucun appareil photo trouvé sur cet appareil.'
    if (error.name === 'NotReadableError') return "L'appareil photo est déjà utilisé par une autre application."
  }
  return "Impossible d'ouvrir l'appareil photo. Importez une photo à la place."
}
