export type LeaderboardPlayer = {
  displayName: string
  score: number
  completionMs: number
  personalBest?: number
  isCurrentPlayer?: boolean
}

export type FinalizedWinner = LeaderboardPlayer & {
  rank: 1 | 2 | 3
  badgeId: string
  awardedAt: string
  publicProfileUrl?: string
}

export type HallRecord = {
  seasonId: string
  awardedAt: string
  winners: FinalizedWinner[]
}

export type EmberHallData = {
  seasonId: string
  finalized: boolean
  entries: LeaderboardPlayer[]
  legends: HallRecord[]
}

function isPlayer(value: unknown): value is LeaderboardPlayer {
  if (!value || typeof value !== "object") return false
  const player = value as Record<string, unknown>
  return (
    typeof player.displayName === "string" &&
    player.displayName.trim().length > 0 &&
    player.displayName.trim().length <= 32 &&
    Number.isSafeInteger(player.score) &&
    Number(player.score) >= 0 &&
    Number.isFinite(player.completionMs) &&
    Number(player.completionMs) >= 0
  )
}

function isWinner(value: unknown): value is FinalizedWinner {
  if (!isPlayer(value)) return false
  const winner = value as FinalizedWinner
  return (
    (winner.rank === 1 || winner.rank === 2 || winner.rank === 3) &&
    typeof winner.badgeId === "string" &&
    winner.badgeId.length > 0 &&
    typeof winner.awardedAt === "string" &&
    Number.isFinite(Date.parse(winner.awardedAt)) &&
    (!winner.publicProfileUrl ||
      (typeof winner.publicProfileUrl === "string" &&
        /^https?:\/\//i.test(winner.publicProfileUrl)))
  )
}

function isHallRecord(value: unknown): value is HallRecord {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  if (
    typeof record.seasonId !== "string" ||
    typeof record.awardedAt !== "string" ||
    !Number.isFinite(Date.parse(record.awardedAt)) ||
    !Array.isArray(record.winners) ||
    record.winners.length !== 3 ||
    !record.winners.every(isWinner)
  )
    return false

  const winners = record.winners as FinalizedWinner[]
  return (
    new Set(winners.map((winner) => winner.rank)).size === 3 &&
    new Set(winners.map((winner) => winner.badgeId)).size === 3
  )
}

export async function fetchEmberHall(
  endpoint: string,
  seasonId: string,
  signal: AbortSignal,
): Promise<EmberHallData> {
  const url = new URL(endpoint, window.location.origin)
  url.searchParams.set("season", seasonId)
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Leaderboard service returned HTTP ${response.status}.`)
  }
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object") {
    throw new Error("Leaderboard response was not valid JSON data.")
  }

  const data = payload as Record<string, unknown>
  if (
    data.seasonId !== seasonId ||
    typeof data.finalized !== "boolean" ||
    !Array.isArray(data.entries) ||
    !Array.isArray(data.legends) ||
    !data.entries.every(isPlayer)
  ) {
    throw new Error("Leaderboard response did not match the expected format.")
  }

  const entries = [...data.entries].sort(
    (a, b) =>
      b.score - a.score ||
      a.completionMs - b.completionMs ||
      a.displayName.localeCompare(b.displayName),
  )

  if (!data.legends.every(isHallRecord)) {
    throw new Error("Hall of Legends response contained invalid award records.")
  }

  return {
    seasonId,
    finalized: data.finalized,
    entries,
    legends: data.legends,
  }
}
