/**
 * Background music track configuration for Aprameya.
 *
 * ⚠️  LICENSING NOTICE  ⚠️
 * Both tracks below are from the Dark Souls III Official Soundtrack
 * composed by Yuki Kitamura, © FROM SOFTWARE / BANDAI NAMCO ENTERTAINMENT.
 *
 * These tracks are protected by copyright. Using them on a publicly deployed
 * website likely requires explicit permission from the rights holders.
 * Before deploying, you must either:
 *   a) Obtain a licence from FROM SOFTWARE / BANDAI NAMCO ENTERTAINMENT, OR
 *   b) Replace these files with music licensed for public web use (e.g. a
 *      Creative Commons or royalty-free track), OR
 *   c) Confirm this site qualifies as a non-commercial fan work that falls
 *      within the rights holders' stated fan-content policy.
 *
 * The implementation below is ready for any properly licensed replacement.
 * Simply update `audioPath`, `title`, `creator`, and `youtubeUrl` per track.
 */

export type Track = {
  /** Internal identifier */
  id: string
  /** Display title shown in the attribution tooltip */
  title: string
  /** Original creator name */
  creator: string
  /** Path inside public/ served by Vite as a static asset */
  audioPath: string
  /**
   * Original YouTube URL.
   * Opens in a new tab from the attribution link.
   * Provide the real creator URL; do not invent one.
   */
  youtubeUrl: string
  /** Optional: source page or playlist URL */
  sourceUrl?: string
  /** Optional: licence note */
  licenseNote?: string
}

/**
 * Playback volume for all tracks (0–1).
 * Keep low — these are background ambience tracks.
 */
export const BACKGROUND_VOLUME = 0.22

/**
 * Main website soundtrack — plays on every page except /sanctuary.
 *
 * File expected at: public/audio/main-theme.mp3
 */
export const MAIN_TRACK: Track = {
  id: "main",
  title: "DARK SOULS Ⅲ",
  creator: "Yuki Kitamura",
  audioPath: "/audio/main-theme.mp3",
  youtubeUrl: "https://www.youtube.com/watch?v=eXLRwFoB6tU",
  licenseNote:
    "© FROM SOFTWARE / BANDAI NAMCO ENTERTAINMENT. Licence required for public web use.",
}

/**
 * Sanctuary soundtrack — plays only on the /sanctuary route.
 *
 * File expected at: public/audio/sanctuary-theme.mp3
 */
export const SANCTUARY_TRACK: Track = {
  id: "sanctuary",
  title: "Firelink Shrine",
  creator: "Yuki Kitamura",
  audioPath: "/audio/sanctuary-theme.mp3",
  youtubeUrl: "https://www.youtube.com/watch?v=h5CwbYfkV64",
  licenseNote:
    "© FROM SOFTWARE / BANDAI NAMCO ENTERTAINMENT. Licence required for public web use.",
}

/** Returns the correct track for the current pathname. */
export function trackForPath(pathname: string): Track {
  return pathname.replace(/\/$/, "") === "/sanctuary"
    ? SANCTUARY_TRACK
    : MAIN_TRACK
}
