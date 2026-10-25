import { useEffect, useId, useRef, useState } from "react"
import {
  fetchEmberHall,
  type EmberHallData,
  type FinalizedWinner,
} from "../../services/leaderboard"

type SeasonStatus = "unconfigured" | "upcoming" | "active" | "ended" | "finalized"

const badgeNames = {
  1: "Eternal Flame",
  2: "Ashen Sovereign",
  3: "Ember Warden",
} as const

function sortWinners(winners: FinalizedWinner[]) {
  return [...winners].sort((a, b) => a.rank - b.rank)
}

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  )
}

function BadgeAward({
  winner,
  seasonId,
}: {
  winner: FinalizedWinner
  seasonId: string
}) {
  const artworkRef = useRef<SVGSVGElement>(null)
  const gradientId = `badge-${useId().replace(/:/g, "")}`
  const [shareStatus, setShareStatus] = useState("")
  const palette =
    winner.rank === 1
      ? { light: "#ffcc72", dark: "#a64a22", edge: "#f4a348" }
      : winner.rank === 2
        ? { light: "#d9dedf", dark: "#45484a", edge: "#aab0b0" }
        : { light: "#d79560", dark: "#603724", edge: "#bd7547" }

  const download = () => {
    const artwork = artworkRef.current
    if (!artwork) return
    const source = new XMLSerializer().serializeToString(artwork)
    const file = new Blob([source], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = `${winner.badgeId.replace(/[^a-z0-9_-]/gi, "-")}.svg`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const share = async () => {
    if (!winner.publicProfileUrl) return
    const title = `${badgeNames[winner.rank]} · ${winner.displayName}`
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `${winner.displayName} placed ${winner.rank} in ${seasonId} with ${winner.score} points.`,
          url: winner.publicProfileUrl,
        })
        return
      }
      await navigator.clipboard.writeText(winner.publicProfileUrl)
      setShareStatus("Achievement link copied.")
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setShareStatus(
        error instanceof Error
          ? `Could not share this achievement: ${error.message}`
          : "Could not share this achievement.",
      )
    }
  }

  return (
    <article className={`champion-card champion-rank-${winner.rank}`}>
      <svg
        ref={artworkRef}
        className="champion-badge"
        viewBox="0 0 240 240"
        width="1200"
        height="1200"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${badgeNames[winner.rank]} award badge for ${winner.displayName}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={palette.light} />
            <stop offset="1" stopColor={palette.dark} />
          </linearGradient>
        </defs>
        <path
          d="M120 12 147 30 180 31 193 61 220 83 209 116 218 147 192 171 183 204 149 208 120 230 91 208 57 204 48 171 22 147 31 116 20 83 47 61 60 31 93 30Z"
          fill="#141210"
          stroke={palette.edge}
          strokeWidth="5"
        />
        <path
          d="M120 29 143 44 171 44 182 70 204 88 195 116 202 143 180 162 172 190 144 193 120 211 96 193 68 190 60 162 38 143 45 116 36 88 58 70 69 44 97 44Z"
          fill={`url(#${gradientId})`}
          stroke="#f5f0e8"
          strokeOpacity=".55"
          strokeWidth="2"
        />
        {winner.rank === 1 ? (
          <g
            fill="#211710"
            stroke="#f9d28d"
            strokeWidth="3"
            strokeLinejoin="round"
          >
            <path d="m119 57 13 28-7 43h-11l-7-43z" />
            <path d="m95 119 25 18 25-18-7 32-18 16-18-16z" />
            <path d="M91 121h58v8H91z" />
            <path d="M108 92h23v8h-23z" />
            <path
              d="M120 169c-14-17-4-30 0-37 4 7 15 20 0 37z"
              fill="#f28c28"
            />
          </g>
        ) : winner.rank === 2 ? (
          <g
            fill="#252729"
            stroke="#e1e4e4"
            strokeWidth="3"
            strokeLinejoin="round"
          >
            <path d="M119 54 131 78l-7 73h-9l-7-73z" />
            <path d="M91 115h58v9H91z" />
            <path
              d="M120 101c-25 0-30 22-24 43 7 23 18 33 24 37 7-4 18-14 25-37 6-21 1-43-25-43z"
              fill="none"
            />
            <path d="m120 127 13 8-13 12-13-12z" fill="#aab0b0" />
          </g>
        ) : (
          <g
            fill="#392219"
            stroke="#f0b27b"
            strokeWidth="3"
            strokeLinejoin="round"
          >
            <path d="M120 58c8 12 24 18 24 36v28c0 24-15 39-24 47-10-8-24-23-24-47V94c0-18 16-24 24-36z" />
            <path
              d="M120 87c11 15 10 25 0 36-10-11-11-21 0-36z"
              fill="#ffb454"
            />
            <path d="M101 132h38v8h-38z" />
          </g>
        )}
        <path
          d="M69 177h102"
          stroke="#f5f0e8"
          strokeOpacity=".65"
          strokeWidth="2"
        />
        <text
          x="120"
          y="195"
          textAnchor="middle"
          fill="#fff4df"
          fontSize="11"
          letterSpacing="2"
        >
          APRAMEYA · {winner.rank}
        </text>
      </svg>
      <div>
        <p className="eyebrow">
          RANK {winner.rank} · {badgeNames[winner.rank]}
        </p>
        <h3>{winner.displayName}</h3>
        <p>
          {winner.score} points · {formatTime(winner.completionMs)}
        </p>
        <p className="badge-metadata">
          {seasonId} · Badge {winner.badgeId} · Awarded{" "}
          {formatDate(winner.awardedAt)}
        </p>
        <button className="button ghost" onClick={download}>
          DOWNLOAD BADGE
        </button>
        {winner.publicProfileUrl && (
          <>
            <a className="badge-profile-link" href={winner.publicProfileUrl}>
              VIEW PUBLIC ACHIEVEMENT ↗
            </a>
            <button className="badge-profile-link" onClick={share}>
              SHARE ACHIEVEMENT
            </button>
            <span className="badge-share-status" aria-live="polite">
              {shareStatus}
            </span>
          </>
        )}
      </div>
    </article>
  )
}

export default function EmberHall({ personalBest }: { personalBest: number }) {
  const seasonId = import.meta.env.VITE_EMBER_SEASON_ID?.trim() ?? ""
  const seasonStart = Date.parse(import.meta.env.VITE_EMBER_SEASON_START ?? "")
  const seasonEnd = Date.parse(import.meta.env.VITE_EMBER_SEASON_END ?? "")
  const endpoint = import.meta.env.VITE_EMBER_HALL_ENDPOINT?.trim() ?? ""
  const validSeason =
    !!seasonId &&
    Number.isFinite(seasonStart) &&
    Number.isFinite(seasonEnd) &&
    seasonEnd > seasonStart
  const timelineStatus: SeasonStatus = !validSeason
    ? "unconfigured"
    : Date.now() < seasonStart
      ? "upcoming"
      : Date.now() < seasonEnd
        ? "active"
        : "ended"
  const [data, setData] = useState<EmberHallData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [refreshToken, setRefreshToken] = useState(0)
  const seasonStatus =
    timelineStatus === "ended" && data?.finalized ? "finalized" : timelineStatus
  const visibleLegendRecords =
    data?.legends.filter(
      (record) =>
        record.seasonId !== data.seasonId ||
        (timelineStatus === "ended" && data.finalized),
    ) ?? []

  useEffect(() => {
    if (!endpoint || !validSeason) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    setData(null)
    fetchEmberHall(endpoint, seasonId, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load the Ember Hall.",
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [endpoint, refreshToken, seasonId, validSeason])

  return (
    <section className="ember-hall" id="ember-hall">
      <div className="ember-hall-heading">
        <div>
          <p className="eyebrow">THE EMBER HALL</p>
          <h2>
            THREE WILL BE <em>REMEMBERED.</em>
          </h2>
        </div>
        <p>
          The three highest-ranked eligible seekers at season&apos;s end will
          receive exclusive Aprameya digital badges. Their forms remain hidden
          until the results are finalized.
        </p>
      </div>

      <div className="season-ledger">
        <div className="season-status-line">
          <span>SEASON</span>
          <strong>{validSeason ? seasonId : "NOT YET CONFIGURED"}</strong>
          <span className={`season-status season-${seasonStatus}`}>
            {seasonStatus === "unconfigured"
              ? "UNCONFIGURED · DATES UNSET"
              : seasonStatus === "finalized"
                ? "RESULTS FINALIZED"
                : seasonStatus.toUpperCase()}
          </span>
          {endpoint && validSeason && (
            <button
              className="hall-refresh"
              onClick={() => setRefreshToken((value) => value + 1)}
              disabled={loading}
            >
              {loading ? "REFRESHING..." : "REFRESH RECORD"}
            </button>
          )}
        </div>
        <p className="season-trust-note">
          {loading
            ? "The Hall is opening its record..."
            : error
              ? "The verified record could not be reached. Local scores remain on this device."
              : !validSeason
                ? "No season dates or verified scoring service are configured. Local runs are not global rankings."
                : !endpoint
                  ? "Season dates are configured, but no verified leaderboard service is connected. Local runs are not uploaded."
                  : seasonStatus === "ended" && !data?.finalized
                    ? "The season has ended; verified results are awaiting finalization."
                    : seasonStatus === "finalized"
                      ? "Verified results are final. The seasonal badges and permanent records are shown below."
                      : "The Hall records scores supplied by the configured leaderboard service."}
        </p>

        {error && (
          <div className="hall-empty hall-error" role="status">
            <strong>THE RECORD IS UNAVAILABLE.</strong>
            <p>{error}</p>
          </div>
        )}
        {!error && !loading && data?.entries.length === 0 && (
          <div className="hall-empty">
            <strong>THE HALL IS SILENT.</strong>
            <p>No seeker has yet claimed a verified place in this season.</p>
          </div>
        )}
        {!error && !loading && !data && (
          <div className="hall-empty">
            <strong>THE HALL AWAITS ITS FIRST VERIFIED SEEKER.</strong>
            <p>
              Your local personal best is <b>{personalBest}</b>. It is saved
              only in this browser and does not appear in global standings.
            </p>
          </div>
        )}
        {data && data.entries.length > 0 && (
          <>
            <div className="leaderboard-podium">
              {data.entries.slice(0, 3).map((entry, index) => (
                <article
                  key={`podium-${entry.displayName}-${entry.score}-${entry.completionMs}`}
                  className={`podium-place podium-place-${index + 1}`}
                >
                  <span>RANK {String(index + 1).padStart(2, "0")}</span>
                  <strong>{entry.displayName}</strong>
                  <b>{entry.score} PTS</b>
                  <span>FINISHED IN {formatTime(entry.completionMs)}</span>
                  {entry.isCurrentPlayer && (
                    <span className="you-label">YOUR RECORD</span>
                  )}
                </article>
              ))}
            </div>
            <div className="leaderboard-list">
              {data.entries.slice(3, 10).map((entry, offset) => (
                <div
                  key={`${entry.displayName}-${entry.score}-${entry.completionMs}`}
                  className={`leaderboard-row ${
                    entry.isCurrentPlayer ? "leaderboard-current" : ""
                  }`}
                >
                  <span className="leaderboard-place">{offset + 4}</span>
                  <strong>{entry.displayName}</strong>
                  {entry.isCurrentPlayer && (
                    <span className="you-label">YOU</span>
                  )}
                  <span>{entry.score} PTS</span>
                  <span>{formatTime(entry.completionMs)}</span>
                </div>
              ))}
            </div>
            {data.entries.some((entry) => entry.isCurrentPlayer) && (
              <p className="current-rank-note">
                Your verified rank is{" "}
                {data.entries.findIndex((entry) => entry.isCurrentPlayer) + 1}.
                Local best: {personalBest}.
              </p>
            )}
          </>
        )}
      </div>

      <div className="hall-of-legends" id="hall-of-legends">
        <p className="eyebrow">HALL OF LEGENDS</p>
        <h3>THE NAMES THAT REMAIN.</h3>
        {!visibleLegendRecords.length && (
          <p className="hall-empty-copy">
            {seasonStatus === "finalized"
              ? "This season is finalized, but its award record was not included by the leaderboard service."
              : data
                ? "No previous season has been finalized; the first legends have yet to be recorded."
                : "Verified Hall of Legends records will appear here once a season and trusted leaderboard service are configured."}
          </p>
        )}
        {visibleLegendRecords.map((record) => {
          const winners = sortWinners(record.winners)
          return (
            <div className="season-record" key={record.seasonId}>
              <p className="season-record-title">
                {record.seasonId} · Finalized {formatDate(record.awardedAt)}
              </p>
              {winners.map((winner) => (
                <BadgeAward
                  key={winner.badgeId}
                  winner={winner}
                  seasonId={record.seasonId}
                />
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
