/**
 * MusicControl
 *
 * A compact music playback toggle and attribution control for the Aprameya
 * navigation header.
 *
 * Visual design:
 *  - Single music-note icon button (inline SVG — no icon library required).
 *  - Antique gold accent, subtle glow on hover/focus, matching the site theme.
 *  - A tooltip appears on hover (desktop) and is always accessible via focus.
 *  - Tooltip shows: current playback action label + track attribution link.
 *  - Attribution link opens the creator's YouTube page in a new tab.
 *
 * Accessibility:
 *  - aria-pressed reflects mute/play state on the button.
 *  - aria-label describes the current action.
 *  - Tooltip is role="tooltip" and linked via aria-describedby.
 *  - Keyboard: Enter/Space toggles playback; Tab reaches the attribution link.
 *  - Reduced-motion: decorative glow animation is suppressed.
 */

import { useId, useRef, useState } from "react"
import type { MusicController } from "../audio/useMusicController"
import "./MusicControl.css"

type Props = Pick<MusicController, "muted" | "playing" | "toggleMute" | "currentTrack">

export default function MusicControl({
  muted,
  playing,
  toggleMute,
  currentTrack,
}: Props) {
  const tooltipId = useId()
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const hideTimeoutRef = useRef<number | undefined>(undefined)

  // Show/hide tooltip with a small delay on leave to allow clicking links.
  const showTooltip = () => {
    window.clearTimeout(hideTimeoutRef.current)
    setTooltipVisible(true)
  }
  const hideTooltip = () => {
    hideTimeoutRef.current = window.setTimeout(
      () => setTooltipVisible(false),
      160,
    )
  }

  const actionLabel = muted || !playing ? "Play music" : "Mute music"
  const stateLabel = muted || !playing ? "Music off" : "Music on"

  return (
    <div
      className="music-control"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocusCapture={showTooltip}
      onBlurCapture={hideTooltip}
    >
      {/* ── Playback toggle button ── */}
      <button
        className={`music-btn ${playing && !muted ? "music-btn--playing" : ""}`}
        type="button"
        onClick={toggleMute}
        aria-pressed={playing && !muted}
        aria-label={`${stateLabel}. ${actionLabel}`}
        aria-describedby={tooltipId}
      >
        {/* Music note SVG — inline, no icon dependency */}
        <svg
          className="music-icon"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          {muted || !playing ? (
            /* Muted: music note with a small strike */
            <>
              <path
                d="M8 14.5V5.5l8-2v9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="6" cy="14.5" r="2" fill="currentColor" opacity="0.9" />
              <circle cx="14" cy="12.5" r="2" fill="currentColor" opacity="0.9" />
              {/* Strike-through line */}
              <line
                x1="3"
                y1="17"
                x2="17"
                y2="3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.7"
              />
            </>
          ) : (
            /* Playing: music note with animated bars */
            <>
              <path
                d="M8 14.5V5.5l8-2v9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="6" cy="14.5" r="2" fill="currentColor" opacity="0.9" />
              <circle cx="14" cy="12.5" r="2" fill="currentColor" opacity="0.9" />
            </>
          )}
        </svg>
        <span className="sr-only">{stateLabel}</span>
      </button>

      {/* ── Tooltip ── */}
      <div
        id={tooltipId}
        role="tooltip"
        className={`music-tooltip ${tooltipVisible ? "music-tooltip--visible" : ""}`}
        aria-hidden={!tooltipVisible}
      >
        <span className="music-tooltip__action">{actionLabel}</span>
        <div className="music-tooltip__track">
          <span className="music-tooltip__label">♪</span>
          <span className="music-tooltip__title">{currentTrack.title}</span>
        </div>
        <a
          className="music-tooltip__credit"
          href={currentTrack.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={tooltipVisible ? 0 : -1}
          aria-label={`Music by ${currentTrack.creator} — opens on YouTube`}
        >
          Music by {currentTrack.creator} ↗
        </a>
      </div>
    </div>
  )
}
