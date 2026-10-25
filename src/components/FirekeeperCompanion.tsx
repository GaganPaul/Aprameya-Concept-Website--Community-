/**
 * FirekeeperCompanion
 *
 * A small floating Firekeeper mascot in the bottom-right corner of the
 * viewport that invites visitors to enter the Sanctuary.
 *
 * Behaviour:
 *  - Shows a one-time invitation message ("The Firekeeper invites you to
 *    the Sanctuary.") after a short delay on the first eligible page load.
 *  - Uses sessionStorage so the message does not re-appear during the same
 *    browsing session once dismissed.
 *  - Clicking the mascot or the invitation navigates to /sanctuary.
 *  - Must never render on /sanctuary itself (handled by the caller — App.tsx
 *    only renders this inside <Site />, which never matches /sanctuary).
 *  - Respects prefers-reduced-motion for all animations.
 *  - Fully keyboard accessible.
 */

import { useEffect, useRef, useState } from "react"
import "./FirekeeperCompanion.css"

const INVITATION_SEEN_KEY = "aprameya-fk-invitation-seen"
const INVITATION_DELAY_MS = 3200

function hasSeenInvitation(): boolean {
  try {
    return sessionStorage.getItem(INVITATION_SEEN_KEY) === "true"
  } catch {
    return false
  }
}

function markInvitationSeen(): void {
  try {
    sessionStorage.setItem(INVITATION_SEEN_KEY, "true")
  } catch {
    // sessionStorage unavailable — treat as unseen, no crash.
  }
}

export default function FirekeeperCompanion() {
  const [invitationVisible, setInvitationVisible] = useState(false)
  const [companionReady, setCompanionReady] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Small mount delay so the companion fades in after the page settles.
    const mountTimer = window.setTimeout(() => {
      setCompanionReady(true)
    }, 600)

    // Show the invitation if not already seen this session.
    if (!hasSeenInvitation()) {
      timerRef.current = window.setTimeout(() => {
        setInvitationVisible(true)
      }, INVITATION_DELAY_MS)
    }

    return () => {
      window.clearTimeout(mountTimer)
      window.clearTimeout(timerRef.current)
    }
  }, [])

  const dismiss = () => {
    markInvitationSeen()
    setInvitationVisible(false)
  }

  const handleDismissKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      dismiss()
    }
  }

  return (
    <div
      className={`fk-companion ${companionReady ? "fk-companion--ready" : ""}`}
      aria-label="Firekeeper companion"
    >
      {/* ── Invitation panel ── */}
      <div
        className={`fk-invitation ${invitationVisible ? "fk-invitation--visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="fk-invitation__message">
          The Firekeeper invites you to the{" "}
          <a
            href="/sanctuary"
            className="fk-invitation__link"
            aria-label="Enter the Sanctuary"
          >
            Sanctuary.
          </a>
        </p>
        {invitationVisible && (
          <button
            className="fk-invitation__dismiss"
            type="button"
            aria-label="Dismiss invitation"
            onClick={dismiss}
            onKeyDown={handleDismissKeyDown}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Mascot image link ── */}
      <a
        href="/sanctuary"
        className="fk-mascot-link"
        aria-label="Visit the Sanctuary"
        title="Enter the Sanctuary"
      >
        <picture>
          <img
            src="/assets/firekeeper-mascot.png"
            alt="The Firekeeper — your guide to the Sanctuary"
            className="fk-mascot-img"
            width="88"
            loading="lazy"
            draggable={false}
          />
        </picture>
        <span className="fk-tooltip" aria-hidden="true">
          Enter the Sanctuary
        </span>
      </a>
    </div>
  )
}
