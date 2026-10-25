/**
 * useMusicController
 *
 * A React hook that manages background music for Aprameya.
 *
 * Responsibilities:
 *  - Creates and manages a single HTMLAudioElement per session.
 *  - Switches tracks when the route (pathname) changes.
 *  - Persists the user's mute/stopped preference in localStorage.
 *  - Respects browser autoplay policy — never throws unhandled rejections.
 *  - Cleans up on unmount.
 *
 * State model:
 *   muted    — user explicitly wants no audio (persisted)
 *   playing  — audio element is currently producing sound
 *
 * On load:
 *   Autoplay is attempted. If blocked by the browser (common), the icon
 *   shows "muted/off" and the user can click to start manually. A single
 *   click starts playback.
 *
 * Toggle behaviour:
 *   If not playing  → attempt to start (unmuted state)
 *   If playing      → pause (muted state)
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { BACKGROUND_VOLUME, type Track, trackForPath } from "./tracks"

const STORAGE_KEY = "aprameya-music-muted"

function readMutedPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function writeMutedPref(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(muted))
  } catch {
    // Storage not available — silently ignore.
  }
}

export type MusicController = {
  /** Currently active track metadata */
  currentTrack: Track
  /** Whether the user has muted music (persisted preference) */
  muted: boolean
  /** Whether audio is currently producing sound */
  playing: boolean
  /** Toggle between playing and muted/stopped. */
  toggleMute: () => void
  /**
   * Notify the controller that the pathname changed.
   * Call this whenever location.pathname changes.
   */
  onPathChange: (pathname: string) => void
}

export function useMusicController(initialPathname: string): MusicController {
  const [currentTrack, setCurrentTrack] = useState<Track>(() =>
    trackForPath(initialPathname),
  )
  // User's saved preference: true = they want it off
  const [muted, setMuted] = useState<boolean>(readMutedPref)
  // Actual playback state of the audio element
  const [playing, setPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Track id currently loaded into the audio element
  const loadedTrackIdRef = useRef<string | null>(null)

  // ── Initialise the single audio element ───────────────────────────────────
  useEffect(() => {
    const audio = new Audio()
    audio.volume = BACKGROUND_VOLUME
    audio.loop = true
    audio.preload = "none"
    audioRef.current = audio

    audio.addEventListener("play", () => setPlaying(true))
    audio.addEventListener("pause", () => setPlaying(false))
    audio.addEventListener("ended", () => setPlaying(false))

    // Attempt autoplay on mount if the user hasn't muted
    if (!readMutedPref()) {
      audio.src = trackForPath(initialPathname).audioPath
      audio.load()
      loadedTrackIdRef.current = trackForPath(initialPathname).id
      audio.play().catch((err: Error) => {
        // Expected: browser blocked autoplay before user interaction.
        // We simply stay in the "not playing" state.
        if (err.name !== "AbortError") {
          console.info(
            "[Aprameya Music] Autoplay blocked — click the music button to start.",
          )
        }
      })
    }

    return () => {
      audio.pause()
      audio.src = ""
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load & attempt play for a given track ─────────────────────────────────
  const loadAndPlay = useCallback(async (track: Track) => {
    const audio = audioRef.current
    if (!audio) return

    if (loadedTrackIdRef.current !== track.id) {
      const wasPlaying = !audio.paused
      if (wasPlaying) audio.pause()
      audio.src = track.audioPath
      audio.load()
      loadedTrackIdRef.current = track.id
      if (!wasPlaying) return // track changed while paused — don't autostart
    }

    try {
      await audio.play()
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        console.warn("[Aprameya Music] Playback failed:", (err as Error).message)
      }
    }
  }, [])

  // ── React to track changes (route changes) ────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || muted) return
    // Only switch if something is already playing (don't force-start on nav)
    if (!audio.paused) {
      loadAndPlay(currentTrack)
    } else {
      // Update the src so next manual play uses the right track
      if (loadedTrackIdRef.current !== currentTrack.id) {
        audio.src = currentTrack.audioPath
        audio.load()
        loadedTrackIdRef.current = currentTrack.id
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack.id])

  // ── Toggle: play ↔ pause ──────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused || !playing) {
      // User wants to start/resume playback
      setMuted(false)
      writeMutedPref(false)
      loadAndPlay(currentTrack)
    } else {
      // User wants to pause/mute
      audio.pause()
      setMuted(true)
      writeMutedPref(true)
    }
  }, [playing, currentTrack, loadAndPlay])

  // ── Handle pathname changes ────────────────────────────────────────────────
  const onPathChange = useCallback((pathname: string) => {
    const next = trackForPath(pathname)
    setCurrentTrack((prev) => {
      if (prev.id === next.id) return prev
      return next
    })
  }, [])

  return { currentTrack, muted, playing, toggleMute, onPathChange }
}
