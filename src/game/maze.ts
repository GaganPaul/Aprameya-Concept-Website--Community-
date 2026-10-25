export const MAZE_SIZE = 15
export const MAZE_SEED = 0xa9a24
export const PERSONAL_BEST_KEY = "apramaya-ember-hunt-best-v1"

export type Cell = { x: number; y: number }

export type MazeLayout = {
  walls: boolean[][]
  start: Cell
  exit: Cell
  embers: Array<Cell & { id: string; hidden: boolean }>
  hazards: Cell[]
}

function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 0x100000000
  }
}

function key({ x, y }: Cell) {
  return `${x},${y}`
}

export function createMaze(seed = MAZE_SEED): MazeLayout {
  const walls = Array.from({ length: MAZE_SIZE }, () =>
    Array<boolean>(MAZE_SIZE).fill(true),
  )
  const random = seededRandom(seed)
  const stack: Cell[] = [{ x: 1, y: 1 }]
  walls[1][1] = false

  while (stack.length) {
    const current = stack[stack.length - 1]
    const options = [
      { x: current.x, y: current.y - 2 },
      { x: current.x + 2, y: current.y },
      { x: current.x, y: current.y + 2 },
      { x: current.x - 2, y: current.y },
    ].filter(
      ({ x, y }) =>
        x > 0 && y > 0 && x < MAZE_SIZE - 1 && y < MAZE_SIZE - 1 && walls[y][x],
    )

    if (!options.length) {
      stack.pop()
      continue
    }

    const next = options[Math.floor(random() * options.length)]
    walls[(current.y + next.y) / 2][(current.x + next.x) / 2] = false
    walls[next.y][next.x] = false
    stack.push(next)
  }

  const start = { x: 1, y: 1 }
  const distances = new Map<string, number>([[key(start), 0]])
  const queue = [start]
  const openCells: Cell[] = []
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    openCells.push(current)
    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y }
      const nextKey = key(next)
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= MAZE_SIZE ||
        next.y >= MAZE_SIZE ||
        walls[next.y][next.x] ||
        distances.has(nextKey)
      )
        continue
      distances.set(nextKey, distances.get(key(current))! + 1)
      queue.push(next)
    }
  }

  const farthestFirst = [...openCells].sort(
    (a, b) => distances.get(key(b))! - distances.get(key(a))!,
  )
  const exit = farthestFirst[0]
  const eligible = openCells
    .filter(
      (cell) =>
        key(cell) !== key(start) &&
        key(cell) !== key(exit) &&
        distances.get(key(cell))! > 5,
    )
    .sort((a, b) => distances.get(key(a))! - distances.get(key(b))!)
  const pickAt = (fraction: number) =>
    eligible[
      Math.min(eligible.length - 1, Math.floor(eligible.length * fraction))
    ]
  const collectibleCells = [
    pickAt(0.18),
    pickAt(0.34),
    pickAt(0.5),
    pickAt(0.66),
    pickAt(0.82),
  ]
  const used = new Set(collectibleCells.map(key))
  const hazards = [pickAt(0.27), pickAt(0.73)].filter((cell) => {
    const cellKey = key(cell)
    if (used.has(cellKey)) return false
    used.add(cellKey)
    return true
  })

  return {
    walls,
    start,
    exit,
    embers: collectibleCells.map((cell, index) => ({
      ...cell,
      id: `ember-${index + 1}`,
      hidden: index === 1 || index === 3,
    })),
    hazards,
  }
}
