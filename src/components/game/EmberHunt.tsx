import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import {
  createMaze,
  MAZE_SIZE,
  PERSONAL_BEST_KEY,
  type Cell,
  type MazeLayout,
} from "../../game/maze"

const GAME_SECONDS = 90
const EMBER_POINTS = 50
const HIDDEN_EMBER_POINTS = 100
const EXIT_BONUS = 100
const TIME_BONUS = 2
const HAZARD_PENALTY = 8

type GamePhase = "ready" | "playing" | "paused" | "completed" | "failed"

function drawMaze(
  canvas: HTMLCanvasElement,
  layout: MazeLayout,
  player: Cell,
  found: string[],
  time: number,
) {
  const bounds = canvas.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const resolution = Math.floor(
    Math.min(bounds.width, bounds.height) * pixelRatio,
  )
  if (canvas.width !== resolution || canvas.height !== resolution) {
    canvas.width = resolution
    canvas.height = resolution
  }

  const context = canvas.getContext("2d")
  if (!context) return
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  const boardSize = resolution / pixelRatio
  const tileSize = boardSize / MAZE_SIZE
  const tick = time / 1000
  context.clearRect(0, 0, boardSize, boardSize)
  context.fillStyle = "#100f0d"
  context.fillRect(0, 0, boardSize, boardSize)

  for (let y = 0; y < MAZE_SIZE; y += 1) {
    for (let x = 0; x < MAZE_SIZE; x += 1) {
      const left = x * tileSize
      const top = y * tileSize
      if (layout.walls[y][x]) {
        context.fillStyle = "#29251f"
        context.fillRect(left, top, tileSize, tileSize)
        context.fillStyle = "#393229"
        context.fillRect(left + 1, top + 1, tileSize - 2, 3)
        context.fillStyle = "#171513"
        context.fillRect(left + 2, top + tileSize - 4, tileSize - 3, 3)
        if ((x * 13 + y * 7) % 5 === 0) {
          context.fillStyle = "rgba(188, 132, 74, 0.12)"
          context.fillRect(
            left + tileSize * 0.27,
            top + tileSize * 0.4,
            tileSize * 0.12,
            tileSize * 0.12,
          )
        }
      } else {
        context.fillStyle = (x + y) % 2 ? "#191816" : "#1d1b18"
        context.fillRect(left, top, tileSize, tileSize)
        context.fillStyle = "rgba(226, 207, 169, 0.05)"
        context.fillRect(left + tileSize * 0.18, top + tileSize * 0.2, 2, 2)
      }
    }
  }

  for (const hazard of layout.hazards) {
    const centerX = (hazard.x + 0.5) * tileSize
    const centerY = (hazard.y + 0.5) * tileSize
    context.fillStyle = "#702f25"
    context.fillRect(
      centerX - tileSize * 0.28,
      centerY - tileSize * 0.28,
      tileSize * 0.56,
      tileSize * 0.56,
    )
    context.fillStyle = "#e7753f"
    context.fillRect(
      centerX - tileSize * 0.1,
      centerY - tileSize * 0.1,
      tileSize * 0.2,
      tileSize * 0.2,
    )
  }

  const exitX = (layout.exit.x + 0.5) * tileSize
  const exitY = (layout.exit.y + 0.5) * tileSize
  context.strokeStyle = "#d8ad62"
  context.lineWidth = Math.max(2, tileSize * 0.07)
  context.strokeRect(
    exitX - tileSize * 0.31,
    exitY - tileSize * 0.36,
    tileSize * 0.62,
    tileSize * 0.72,
  )
  context.fillStyle = "#ffb454"
  context.fillRect(
    exitX - tileSize * 0.035,
    exitY - tileSize * 0.03,
    tileSize * 0.07,
    tileSize * 0.07,
  )

  for (const ember of layout.embers) {
    if (found.includes(ember.id)) continue
    const distance = Math.abs(player.x - ember.x) + Math.abs(player.y - ember.y)
    if (ember.hidden && distance > 2) continue

    const centerX = (ember.x + 0.5) * tileSize
    const centerY = (ember.y + 0.5) * tileSize
    const pulse = 0.8 + Math.sin(tick * 4 + ember.x) * 0.18
    context.save()
    context.shadowColor = ember.hidden ? "#f28c28" : "#ffb454"
    context.shadowBlur = tileSize * pulse
    context.fillStyle = ember.hidden ? "#df6d32" : "#ffd47a"
    context.beginPath()
    context.moveTo(centerX, centerY - tileSize * 0.23)
    context.lineTo(centerX + tileSize * 0.18, centerY + tileSize * 0.12)
    context.lineTo(centerX, centerY + tileSize * 0.2)
    context.lineTo(centerX - tileSize * 0.18, centerY + tileSize * 0.12)
    context.closePath()
    context.fill()
    context.restore()
  }

  const playerX = player.x * tileSize
  const playerY = player.y * tileSize
  context.save()
  context.shadowColor = "rgba(255, 164, 75, 0.55)"
  context.shadowBlur = tileSize * 0.24
  context.fillStyle = "#d8c8a6"
  context.fillRect(
    playerX + tileSize * 0.34,
    playerY + tileSize * 0.12,
    tileSize * 0.32,
    tileSize * 0.3,
  )
  context.fillStyle = "#9f4b2d"
  context.fillRect(
    playerX + tileSize * 0.25,
    playerY + tileSize * 0.44,
    tileSize * 0.5,
    tileSize * 0.38,
  )
  context.fillStyle = "#d8ad62"
  context.fillRect(
    playerX + tileSize * 0.29,
    playerY + tileSize * 0.82,
    tileSize * 0.15,
    tileSize * 0.1,
  )
  context.fillRect(
    playerX + tileSize * 0.56,
    playerY + tileSize * 0.82,
    tileSize * 0.15,
    tileSize * 0.1,
  )
  context.restore()
}

export default function EmberHunt({
  onEarn,
  personalBest,
  onPersonalBest,
}: {
  onEarn: (value: number) => void
  personalBest: number
  onPersonalBest: (value: number) => void
}) {
  const layout = useMemo(() => createMaze(), [])
  const boardRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef(layout.start)
  const scoreRef = useRef(0)
  const timeRef = useRef(GAME_SECONDS)
  const [phase, setPhase] = useState<GamePhase>("ready")
  const [player, setPlayer] = useState(layout.start)
  const [found, setFound] = useState<string[]>([])
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS)
  const [message, setMessage] = useState(
    "The fire has faded. The embers remain.",
  )
  const [newBest, setNewBest] = useState(false)
  const [previousBest, setPreviousBest] = useState(0)

  useEffect(() => {
    const canvas = boardRef.current
    if (!canvas) return
    let frame = 0
    let animationFrame = 0
    const render = (now: number) => {
      if (now - frame >= 50) {
        drawMaze(canvas, layout, player, found, now)
        frame = now
      }
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)
    const resizeObserver = new ResizeObserver(() => {
      drawMaze(canvas, layout, player, found, performance.now())
    })
    resizeObserver.observe(canvas)
    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [layout, player, found, phase])

  const startGame = useCallback(() => {
    playerRef.current = layout.start
    scoreRef.current = 0
    timeRef.current = GAME_SECONDS
    setPlayer(layout.start)
    setFound([])
    setScore(0)
    setTimeLeft(GAME_SECONDS)
    setNewBest(false)
    setMessage("The trial begins. Leave nothing glowing behind.")
    setPhase("playing")
    requestAnimationFrame(() => stageRef.current?.focus())
  }, [layout.start])

  const finishRun = useCallback(
    (completed: boolean, finalScore: number) => {
      scoreRef.current = finalScore
      setScore(finalScore)
      const best = Math.max(personalBest, finalScore)
      setNewBest(finalScore > personalBest)
      setPreviousBest(personalBest)
      onPersonalBest(best)
      localStorage.setItem(PERSONAL_BEST_KEY, String(best))
      setMessage(
        completed
          ? "The maze has witnessed your attempt."
          : "The trial ends here. The path remains.",
      )
      setPhase(completed ? "completed" : "failed")
    },
    [onPersonalBest, personalBest],
  )

  useEffect(() => {
    if (phase !== "playing") return
    const timer = window.setInterval(() => {
      timeRef.current = Math.max(0, timeRef.current - 1)
      setTimeLeft(timeRef.current)
      if (timeRef.current === 0) finishRun(false, scoreRef.current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [finishRun, phase])

  const move = useCallback(
    (dx: number, dy: number) => {
      if (phase !== "playing") return
      const next = {
        x: playerRef.current.x + dx,
        y: playerRef.current.y + dy,
      }
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= MAZE_SIZE ||
        next.y >= MAZE_SIZE ||
        layout.walls[next.y][next.x]
      )
        return

      playerRef.current = next
      setPlayer(next)
      const ember = layout.embers.find(
        (item) =>
          item.x === next.x && item.y === next.y && !found.includes(item.id),
      )
      if (ember) {
        const points = ember.hidden ? HIDDEN_EMBER_POINTS : EMBER_POINTS
        const nextScore = scoreRef.current + points
        scoreRef.current = nextScore
        setScore(nextScore)
        setFound((previous) => [...previous, ember.id])
        setMessage(
          ember.hidden
            ? "A forgotten fragment has been reclaimed."
            : "The fire remembers.",
        )
        onEarn(10)
      }

      if (
        layout.hazards.some(
          (hazard) => hazard.x === next.x && hazard.y === next.y,
        )
      ) {
        timeRef.current = Math.max(0, timeRef.current - HAZARD_PENALTY)
        setTimeLeft(timeRef.current)
        setMessage("Ash bites at your heels. Eight seconds lost.")
      }

      if (next.x === layout.exit.x && next.y === layout.exit.y) {
        const bonus = EXIT_BONUS + timeRef.current * TIME_BONUS
        finishRun(true, scoreRef.current + bonus)
      } else if (timeRef.current === 0) {
        finishRun(false, scoreRef.current)
      }
    },
    [finishRun, found, layout, onEarn, phase],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      w: [0, -1],
      W: [0, -1],
      ArrowRight: [1, 0],
      d: [1, 0],
      D: [1, 0],
      ArrowDown: [0, 1],
      s: [0, 1],
      S: [0, 1],
      ArrowLeft: [-1, 0],
      a: [-1, 0],
      A: [-1, 0],
    }
    if (event.key === "Escape" && phase === "playing") {
      event.preventDefault()
      setPhase("paused")
      setMessage("The trial is paused. The embers wait.")
      return
    }
    if (event.key === "Escape" && phase === "paused") {
      event.preventDefault()
      setPhase("playing")
      setMessage("The trial resumes.")
      return
    }
    const direction = directions[event.key]
    if (!direction || phase !== "playing") return
    event.preventDefault()
    move(direction[0], direction[1])
  }

  const foundCount = found.length
  const remainingEmbers = layout.embers.length - foundCount
  const formattedTime = `${Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0")}:${(timeLeft % 60).toString().padStart(2, "0")}`

  return (
    <section className="maze-section" id="ember-hunt">
      <div className="maze-copy">
        <p className="eyebrow">EMBER HUNT · THE TRIAL</p>
        <h2>
          THE FIRE
          <br />
          <em>REMEMBERS.</em>
        </h2>
        <p>
          Beyond the dying fire lies a path few have walked. Gather what
          remains, escape the forgotten halls, and let your score speak for you.
          Three names will rise above the rest; their reward remains concealed
          until the trial is complete.
        </p>
        <div className="reward-whisper">
          <span>THE HIDDEN REWARD</span>
          <p>
            The embers remember those who dare. An undisclosed digital reward
            awaits the worthy.
          </p>
          <a href="#ember-hall">DISCOVER THE PROPHECY ↓</a>
        </div>
        <div className="maze-score">
          <span>PERSONAL BEST · LOCAL</span>
          <b>{personalBest}</b>
        </div>
        <p className="maze-scoring">
          Embers +50 · Hidden embers +100 · Reach the gate +100 and 2 per second
          remaining. Ash costs 8 seconds.
        </p>
        <p className="maze-local-note">
          Play for free. Scores are saved on this device only; the global season
          is not yet configured.
        </p>
      </div>

      <div className="maze-shell">
        <div className="maze-hud" aria-label="Game status">
          <span>
            SCORE <b>{score}</b>
          </span>
          <span>
            TIME{" "}
            <b className={timeLeft <= 15 ? "urgent" : ""}>{formattedTime}</b>
          </span>
          <span>
            EMBERS{" "}
            <b>
              {foundCount}/{layout.embers.length}
            </b>
          </span>
        </div>
        <div
          ref={stageRef}
          className={`maze-board maze-board-${phase}`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          aria-label="Ember Hunt board. Use arrow keys or WASD to move. Press Escape to pause."
        >
          <canvas
            ref={boardRef}
            className="maze-canvas"
            aria-label={`Maze board. ${remainingEmbers} embers remain. Find the gate.`}
          />
          {(phase === "ready" || phase === "paused") && (
            <div className="maze-overlay">
              <p className="eyebrow">
                {phase === "paused"
                  ? "THE TRIAL IS PAUSED"
                  : "THE ASHEN PASSAGE"}
              </p>
              <h3>
                {phase === "paused" ? "THE EMBERS WAIT." : "FIND THE WAY OUT."}
              </h3>
              <p>
                {phase === "paused"
                  ? "Your remaining time is held."
                  : "Gather embers, avoid burning ash, and reach the marked gate before time runs out."}
              </p>
              <button
                className="button primary"
                onClick={
                  phase === "paused"
                    ? () => {
                        setPhase("playing")
                        setMessage("The trial resumes.")
                        stageRef.current?.focus()
                      }
                    : startGame
                }
              >
                {phase === "paused" ? "RESUME THE TRIAL" : "ENTER THE HUNT"}
              </button>
            </div>
          )}
          {(phase === "completed" || phase === "failed") && (
            <div className="maze-overlay maze-results" role="status">
              <p className="eyebrow">
                {phase === "completed" ? "TRIAL COMPLETE" : "TRIAL ENDED"}
              </p>
              <h3>{newBest ? "A NEW PERSONAL BEST." : message}</h3>
              <p>
                {newBest
                  ? `You have surpassed your former self (${previousBest} → ${score}).`
                  : `This attempt earned ${score} points. ${
                      phase === "completed"
                        ? "The gate is yours."
                        : "The path remains."
                    }`}
              </p>
              <div className="maze-result-actions">
                <button className="button primary" onClick={startGame}>
                  TRY AGAIN
                </button>
                <a className="button ghost" href="#ember-hall">
                  THE EMBER HALL
                </a>
              </div>
            </div>
          )}
        </div>
        <div className="maze-playbar">
          <p aria-live="polite">{message}</p>
          {phase === "playing" && (
            <button
              className="maze-pause"
              onClick={() => {
                setPhase("paused")
                setMessage("The trial is paused. The embers wait.")
              }}
            >
              PAUSE
            </button>
          )}
        </div>
        <div className="maze-controls" aria-label="Touch movement controls">
          <button
            onClick={() => move(0, -1)}
            aria-label="Move up"
            disabled={phase !== "playing"}
          >
            ↑
          </button>
          <button
            onClick={() => move(-1, 0)}
            aria-label="Move left"
            disabled={phase !== "playing"}
          >
            ←
          </button>
          <button
            onClick={() => move(0, 1)}
            aria-label="Move down"
            disabled={phase !== "playing"}
          >
            ↓
          </button>
          <button
            onClick={() => move(1, 0)}
            aria-label="Move right"
            disabled={phase !== "playing"}
          >
            →
          </button>
        </div>
        <p className="maze-keyboard-hint">
          WASD / ARROWS TO MOVE · ESC TO PAUSE
        </p>
      </div>
    </section>
  )
}
