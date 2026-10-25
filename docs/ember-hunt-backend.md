# Ember Hunt competitive backend

The website currently provides deterministic local gameplay and a device-only
personal best. It does not submit scores to a global competition. Do not set
the season variables until a trusted service is deployed and the season dates
are confirmed.

## Public configuration

Set these non-secret Vite values in the deployment environment:

- `VITE_EMBER_SEASON_ID`: stable season identifier.
- `VITE_EMBER_SEASON_START`: ISO-8601 start timestamp including timezone.
- `VITE_EMBER_SEASON_END`: ISO-8601 end timestamp including timezone.
- `VITE_EMBER_HALL_ENDPOINT`: HTTPS read-only endpoint that returns the
  current season and finalized Hall of Legends data.

All `VITE_` values are public in the browser bundle. Never put credentials,
service-role keys, or signing secrets in them.

## Read endpoint contract

The frontend makes `GET {endpoint}?season={seasonId}` and expects JSON in this
shape:

```json
{
  "seasonId": "season-identifier",
  "finalized": false,
  "entries": [
    {
      "displayName": "Public name",
      "score": 450,
      "completionMs": 62000,
      "personalBest": 450,
      "isCurrentPlayer": false
    }
  ],
  "legends": [
    {
      "seasonId": "previous-season",
      "awardedAt": "2026-01-01T00:00:00Z",
      "winners": [
        {
          "rank": 1,
          "displayName": "First public name",
          "score": 450,
          "completionMs": 62000,
          "badgeId": "unique-first-award-id",
          "awardedAt": "2026-01-01T00:00:00Z"
        },
        {
          "rank": 2,
          "displayName": "Second public name",
          "score": 400,
          "completionMs": 65000,
          "badgeId": "unique-second-award-id",
          "awardedAt": "2026-01-01T00:00:00Z"
        },
        {
          "rank": 3,
          "displayName": "Third public name",
          "score": 350,
          "completionMs": 71000,
          "badgeId": "unique-third-award-id",
          "awardedAt": "2026-01-01T00:00:00Z"
        }
      ]
    }
  ]
}
```

Return only public display names and approved public profile URLs. Never return
email addresses, internal account IDs, auth tokens, or private profile fields.
`entries` are ordered by score descending, then completion time ascending, then
display name ascending, with the server's stable record ordering preserved for
exact ties. The frontend applies the same ordering before display.

## Required trusted score flow before opening a season

The GET endpoint is only for displaying standings; it does not establish that
a browser-submitted score is valid. Before enabling a competitive season, add a
server-side submission flow that:

1. Requires a stable authenticated player identity and validates the display
   name.
2. Issues a unique server-created run ID and records the season and initial
   conditions.
3. Validates run duration, movement/events, collectible claims, completion,
   scoring, and duplicate submissions on the server.
4. Applies rate limits and database uniqueness/consistency constraints.
5. Calculates the score itself and permits users to read only public standings.
6. Finalizes winners transactionally and issues one badge per player, rank, and
   season only after the season closes.

Never accept a client score as proof of a verified result. The current
client-side game is intentionally not described as cheat-proof. No auth
provider, database, server endpoint, or season configuration exists in this
project yet.
