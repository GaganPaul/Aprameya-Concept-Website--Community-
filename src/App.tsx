import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react"
import BonfireFallback from "./components/BonfireFallback"
import EmberCursor from "./components/EmberCursor"
import EmberHall from "./components/game/EmberHall"
import EmberHunt from "./components/game/EmberHunt"
import SanctuaryPage from "./components/sanctuary/SanctuaryPage"
import SiteNavigation from "./components/SiteNavigation"
import "./bonfire.css"
import { PERSONAL_BEST_KEY } from "./game/maze"

const BonfireScene = lazy(() => import("./components/BonfireScene"))
const BonfirePreview = import.meta.env.DEV
  ? lazy(() => import("./components/dev/BonfirePreview"))
  : null

type Page = "world" | "quest" | "journey" | "arsenal" | "about"
const pageNames: Page[] = ["world", "quest", "journey", "arsenal", "about"]
const A = "/assets/uploads/"
const img = (id: string) => `${A}${id}.png`
const art = {
  hero: `${A}dcd7c1cd-5e3d-4b59-ab84-4708b6c1c51c.jpg`,
  city: img("285c3306-11f6-42f3-862f-253a84ce1d48"),
  flame: img("9d56f7f2-64ac-4ea3-a1df-4e7493e64ab4"),
  beast: img("72cfe727-7725-4d2c-86d1-6ea06b2c9bf3"),
  realm: img("0bf2e969-d240-4d38-bb67-13b9e49cf86c"),
}
const slides = [
  [
    img("3785a214-0f17-4b1d-bfe5-c5fdab1856a6"),
    "THE STARBOUND KNIGHT",
    "Look beyond the known",
  ],
  [
    img("0099ab24-eaa4-4a5a-85e9-ee717dc4fbfd"),
    "THE TWIN OMEN",
    "Confront complexity together",
  ],
  [
    img("6bc5cf59-1b9e-4452-b6e4-1fb7b777b7ac"),
    "THE PALE GUARDIAN",
    "Adapt before the world changes",
  ],
  [
    img("d0a6c253-244d-489a-a863-c5512c7eb7e6"),
    "THE ABYSS RIDER",
    "Move through uncertainty",
  ],
  [
    img("34189bea-bcd6-40d0-a985-573fe8ea708a"),
    "THE GOLDEN SHADE",
    "Turn vision into form",
  ],
  [
    img("db6e4a7f-d3bc-464c-9fed-b7ae990bc301"),
    "THE CRUCIBLE BEAST",
    "Build stronger as one",
  ],
]

const pageCopy = {
  quest: {
    index: "I",
    title: "THE QUEST",
    sub: "Choose what you will confront.",
    image: img("76b52c47-55b0-4791-9d81-3358199b1997"),
  },
  journey: {
    index: "II",
    title: "THE JOURNEY",
    sub: "Every flame begins with a summoning.",
    image: img("aeb71af4-d1b4-4657-9af2-cfff9097f83e"),
  },
  arsenal: {
    index: "III",
    title: "THE ARSENAL",
    sub: "Enter prepared. Leave transformed.",
    image: img("77404491-446a-4119-a463-ebcd75ff4ee6"),
  },
}

function Tilt({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`tilt ${className}`}
      onPointerMove={(e) => {
        if (
          !ref.current ||
          e.pointerType !== "mouse" ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return
        const r = ref.current.getBoundingClientRect()
        const isHero = className.includes("hero-tilt")
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        ref.current.style.setProperty(
          "--rx",
          `${-(y - 0.5) * (isHero ? 5 : 9)}deg`,
        )
        ref.current.style.setProperty(
          "--ry",
          `${(x - 0.5) * (isHero ? 7 : 12)}deg`,
        )
        if (isHero) {
          ref.current.style.setProperty("--pointer-x", `${x * 100}%`)
          ref.current.style.setProperty("--pointer-y", `${y * 100}%`)
        }
      }}
      onPointerLeave={() => ref.current?.removeAttribute("style")}
    >
      {children}
    </div>
  )
}

function BossCarousel() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive((v) => (v + 1) % slides.length), 5500)
    return () => clearInterval(t)
  }, [])
  return (
    <section
      className="boss-section"
      aria-label="Interactive character gallery"
    >
      <div className="boss-heading">
        <p className="eyebrow">THE LEGENDS OF APRAMAYA</p>
        <h2>
          Every builder
          <br />
          faces a <em>guardian.</em>
        </h2>
        <p>
          Drag your attention across each character. These trials represent the
          uncertainty, complexity, and collaboration behind every ambitious
          build.
        </p>
      </div>
      <div className="carousel-stage">
        {slides.map(([image, title, copy], i) => {
          const d = (i - active + slides.length) % slides.length
          const pos =
            d === 0
              ? 0
              : d <= slides.length / 2
                ? Math.min(d, 2)
                : Math.max(d - slides.length, -2)
          return (
            <button
              key={title}
              className={`boss-card ${i === active ? "active" : ""}`}
              style={
                {
                  "--pos": pos,
                  "--depth": Math.abs(pos),
                } as React.CSSProperties
              }
              onClick={() => setActive(i)}
              aria-label={`View ${title}`}
            >
              <Tilt>
                <img src={image} alt="" />
                <div className="boss-glint" />
              </Tilt>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </button>
          )
        })}
      </div>
      <div className="carousel-controls">
        <button
          onClick={() =>
            setActive((active - 1 + slides.length) % slides.length)
          }
          aria-label="Previous character"
        >
          ←
        </button>
        <span>
          {String(active + 1).padStart(2, "0")} /{" "}
          {String(slides.length).padStart(2, "0")}
        </span>
        <button
          onClick={() => setActive((active + 1) % slides.length)}
          aria-label="Next character"
        >
          →
        </button>
      </div>
    </section>
  )
}

function Bonfire() {
  const [phase, setPhase] = useState<"dormant" | "igniting" | "lit">("dormant")
  const [reducedMotion, setReducedMotion] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [ignitionStartedAt, setIgnitionStartedAt] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const ignitionTimers = useRef<number[]>([])
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(preference.matches)
    update()
    preference.addEventListener("change", update)
    return () => preference.removeEventListener("change", update)
  }, [])
  useEffect(
    () => () =>
      ignitionTimers.current.forEach((timer) => window.clearTimeout(timer)),
    [],
  )
  const handleModelReady = useCallback((anchorFound: boolean) => {
    if (!anchorFound)
      console.warn(
        "Bonfire FireAnchor was not found; using the configured fallback point.",
      )
  }, [])
  const handleIgnite = () => {
    if (phase === "igniting") return
    ignitionTimers.current.forEach((timer) => window.clearTimeout(timer))
    ignitionTimers.current = []
    if (phase === "lit") {
      setPhase("dormant")
      setBannerVisible(false)
      return
    }
    const startedAt = performance.now()
    setIgnitionStartedAt(startedAt)
    setPhase("igniting")
    setBannerVisible(false)
    ignitionTimers.current = [
      window.setTimeout(
        () => setBannerVisible(true),
        reducedMotion ? 40 : 6100,
      ),
      window.setTimeout(() => setPhase("lit"), reducedMotion ? 600 : 6000),
      window.setTimeout(
        () => setBannerVisible(false),
        reducedMotion ? 1600 : 8400,
      ),
    ]
  }
  const kindled = phase !== "dormant"
  return (
    <section
      ref={sectionRef}
      className={`bonfire-section ${kindled ? "kindled" : ""}`}
    >
      <div className="bonfire-scene" aria-hidden="true">
        <Suspense fallback={<BonfireFallback kindled={kindled} />}>
          <BonfireScene
            phase={phase}
            ignitionStartedAt={ignitionStartedAt}
            reducedMotion={reducedMotion}
            sectionRef={sectionRef}
            onModelReady={handleModelReady}
          />
        </Suspense>
      </div>
      <div className="bonfire-copy">
        <p className="eyebrow">REST AT THE FLAME</p>
        <h2 aria-live="polite">
          {phase === "igniting" ? (
            <>
              THE FLAME <em>CATCHES.</em>
            </>
          ) : kindled ? (
            <>
              BONFIRE <em>KINDLED.</em>
            </>
          ) : (
            <>
              A FLAME
              <br />
              <em>UNLIT.</em>
            </>
          )}
        </h2>
        <p>
          Kindle the bonfire before continuing. The interface reacts with
          warmth, light, and motion—without blocking your path.
        </p>
        <button
          className="button primary"
          aria-pressed={kindled}
          aria-busy={phase === "igniting"}
          onClick={handleIgnite}
        >
          {phase === "igniting"
            ? "FLAME CATCHING..."
            : kindled
              ? "LET THE FLAME REST"
              : "KINDLE THE BONFIRE"}
        </button>
      </div>
      {bannerVisible && (
        <div
          className={`bonfire-lit-banner ${reducedMotion ? "reduced" : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>BONFIRE LIT</span>
        </div>
      )}
    </section>
  )
}

export default function App() {
  if (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).has("bonfire-preview") &&
    BonfirePreview
  ) {
    return (
      <Suspense fallback={null}>
        <BonfirePreview />
      </Suspense>
    )
  }
  if (location.pathname.replace(/\/$/, "") === "/sanctuary") {
    return <SanctuaryPage />
  }
  return <Site />
}

function Site() {
  const [page, setPage] = useState<Page>(() => {
    const hash = location.hash.slice(1) as Page
    return pageNames.includes(hash) ? hash : "world"
  })
  const [embers, setEmbers] = useState(() =>
    Number(localStorage.getItem("apramaya-embers") || 0),
  )
  const [personalBest, setPersonalBest] = useState(
    () => Number(localStorage.getItem(PERSONAL_BEST_KEY)) || 0,
  )
  useEffect(() => {
    const f = () => {
      const hash = location.hash.slice(1) as Page
      if (pageNames.includes(hash)) setPage(hash)
    }
    addEventListener("hashchange", f)
    return () => removeEventListener("hashchange", f)
  }, [])
  useEffect(() => {
    scrollTo({ top: 0, behavior: "smooth" })
  }, [page])
  const earn = (n: number) =>
    setEmbers((v) => {
      localStorage.setItem("apramaya-embers", String(v + n))
      return v + n
    })
  return (
    <main className={`app page-${page}`}>
      <EmberCursor />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteNavigation activeSection={page} embers={embers} />
      {page === "world" ? (
        <Home
          onEarn={earn}
          personalBest={personalBest}
          onPersonalBest={setPersonalBest}
        />
      ) : page === "about" ? (
        <About />
      ) : (
        <Chapter page={page} />
      )}
      <footer>
        <a className="sigil" href="#world">
          <span>Λ</span> APRAMEYA
        </a>
        <p>Hosted by Sparks Club · NMIT MCA Department</p>
        <p>48 hours. One shared fire.</p>
      </footer>
    </main>
  )
}

function Home({
  onEarn,
  personalBest,
  onPersonalBest,
}: {
  onEarn: (n: number) => void
  personalBest: number
  onPersonalBest: (score: number) => void
}) {
  const prophecyRef = useRef<HTMLDetailsElement>(null)

  return (
    <div id="main">
      <section className="new-hero">
        <div className="hero-depth back" />
        <div className="hero-depth mist" />
        <Tilt className="hero-tilt">
          <img
            className="hero-character"
            src={art.hero}
            alt="An armored warrior in a storm-shrouded realm"
          />
        </Tilt>
        <div className="new-hero-copy">
          <p className="eyebrow">SPARKS CLUB PRESENTS · A 48-HOUR HACKATHON</p>
          <h1>APRAMEYA</h1>
          <p className="hero-line">
            KINDLE THE FLAME.
            <br />
            <em>BUILD BEYOND.</em>
          </p>
          <p className="intro">
            Gather your allies. Confront meaningful challenges. Forge ambitious
            ideas into working solutions.
          </p>
          <div className="actions">
            <a className="button primary" href="#quest">
              BEGIN THE QUEST →
            </a>
            <a className="button ghost" href="#about">
              MEET THE HOSTS
            </a>
          </div>
        </div>
        <div className="scroll">
          <span /> SCROLL TO EXPLORE
        </div>
      </section>
      <section className="realm-intro">
        <div>
          <p className="eyebrow">THE WORLD OF APRAMAYA</p>
          <h2>
            A challenge with
            <br />
            <em>many guardians.</em>
          </h2>
        </div>
        <p>
          Explore an event world built around craft, collaboration, and
          discovery. Every game-like interaction is optional; essential
          information remains clear and close at hand.
        </p>
      </section>
      <section className="reward-prophecy" id="reward-prophecy">
        <div>
          <p className="eyebrow">A PROMISE BENEATH THE ASH</p>
          <h2>
            THE EMBERS <em>REMEMBER.</em>
          </h2>
          <p>
            An undisclosed reward awaits the worthy. Enter the maze, reclaim the
            embers, and prove your place among those who will be remembered.
          </p>
        </div>
        <div className="reward-prophecy-actions">
          <a className="button primary" href="#ember-hunt">
            ENTER THE HUNT
          </a>
          <a
            className="prophecy-link"
            href="#ember-prophecy-details"
            onClick={() => {
              if (prophecyRef.current) prophecyRef.current.open = true
            }}
          >
            DISCOVER THE PROPHECY ↓
          </a>
        </div>
        <details id="ember-prophecy-details" ref={prophecyRef}>
          <summary>WHAT AWAITS THE THREE HIGHEST SEEKERS?</summary>
          <p>
            Three eligible players with the highest verified seasonal scores
            will receive exclusive Aprameya digital badges. The reward is
            revealed when a real season concludes; no season or deadline has
            been configured yet.
          </p>
        </details>
      </section>
      <BossCarousel />
      <Bonfire />
      <EmberHunt
        onEarn={onEarn}
        personalBest={personalBest}
        onPersonalBest={onPersonalBest}
      />
      <EmberHall personalBest={personalBest} />
      <section className="chapter-grid">
        {[
          [
            "quest",
            art.realm,
            "THE QUEST",
            "Discover the trials and challenge tracks.",
          ],
          [
            "journey",
            art.city,
            "THE JOURNEY",
            "Follow the path from registration to judging.",
          ],
          [
            "arsenal",
            art.beast,
            "THE ARSENAL",
            "Gather rules, guidance and resources.",
          ],
        ].map(([page, image, title, copy], i) => (
          <a href={`#${page}`} key={page}>
            <Tilt className="chapter-tile">
              <img src={image} alt="" />
              <div />
              <span>CHAPTER 0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </Tilt>
          </a>
        ))}
      </section>
    </div>
  )
}

function About() {
  return (
    <div id="main">
      <section className="about-hero">
        <img src={art.realm} alt="" />
        <div>
          <p className="eyebrow">THE COVENANT BEHIND THE FLAME</p>
          <h1>
            SPARKS
            <br />
            <em>CLUB.</em>
          </h1>
          <p>Hosted by the NMIT MCA Department</p>
        </div>
      </section>
      <section className="about-content">
        <div>
          <p className="eyebrow">ABOUT THE HOSTS</p>
          <h2>
            Ideas become
            <br />
            <em>brighter together.</em>
          </h2>
        </div>
        <div>
          <p>
            Sparks Club is the student community hosting Apramaya from the NMIT
            MCA Department. The club creates a space for learners to experiment,
            collaborate, and turn technical curiosity into meaningful work.
          </p>
          <p>
            Apramaya carries that spirit into an intensive 48-hour challenge:
            gather a team, investigate real problems, and build beyond the
            expected.
          </p>
          <dl>
            <div>
              <dt>Host</dt>
              <dd>Sparks Club</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>NMIT MCA</dd>
            </div>
            <div>
              <dt>Event</dt>
              <dd>Aprameya</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="next-path">
        <p className="eyebrow">ENTER THE REALM</p>
        <h2>
          THE FLAME <em>AWAITS.</em>
        </h2>
        <a className="button primary" href="#quest">
          EXPLORE THE QUEST →
        </a>
      </section>
    </div>
  )
}

function Chapter({ page }: { page: Exclude<Page, "world" | "about"> }) {
  const data = pageCopy[page]
  const content = {
    quest: [
      [
        "01",
        "The Unwritten Path",
        "Official challenge tracks are awaiting reveal.",
      ],
      [
        "02",
        "The Makers’ Trial",
        "Build a thoughtful working solution in forty-eight hours.",
      ],
      [
        "03",
        "The Final Offering",
        "Present your craft, reasoning, and impact.",
      ],
    ],
    journey: [
      ["01", "The Summoning", "Registration · Official date forthcoming"],
      ["02", "The Gathering", "Team formation and orientation"],
      ["03", "The First Flame", "The 48-hour build begins"],
      ["04", "The Ascension", "Submission, judging and awards"],
    ],
    arsenal: [
      ["01", "Rules & Eligibility", "Official requirements are coming soon."],
      [
        "02",
        "Submission Guide",
        "Formats and judging criteria will appear here.",
      ],
      ["03", "Mentorship", "Mentor access is awaiting confirmation."],
      ["04", "Frequently Asked", "Answers will be published when confirmed."],
    ],
  }[page]
  return (
    <div id="main">
      <section className="chapter-hero">
        <img src={data.image} alt="" />
        <div className="chapter-title">
          <p className="eyebrow">CHAPTER {data.index}</p>
          <h1>{data.title}</h1>
          <p>{data.sub}</p>
        </div>
        <a href="#world" className="back-link">
          ← RETURN TO THE WORLD
        </a>
      </section>
      <section className="chapter-content">
        <div className="chapter-note">
          <p className="eyebrow">THE PATH AHEAD</p>
          <h2>
            Knowledge is
            <br />
            <em>your first weapon.</em>
          </h2>
          <p>
            Confirmed event information will always be presented plainly beside
            the atmospheric labels.
          </p>
        </div>
        <div className="chapter-list">
          {content.map(([n, title, copy]) => (
            <article key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
              <b>FORTHCOMING</b>
            </article>
          ))}
        </div>
      </section>
      <section className="next-path">
        <p className="eyebrow">CONTINUE EXPLORING</p>
        <h2>
          THE FLAME <em>AWAITS.</em>
        </h2>
        <a
          className="button primary"
          href={
            page === "quest"
              ? "#journey"
              : page === "journey"
                ? "#arsenal"
                : "#world"
          }
        >
          CONTINUE →
        </a>
      </section>
    </div>
  )
}
