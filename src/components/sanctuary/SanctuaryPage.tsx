import { useEffect, useRef, useState } from "react"
import EmberCursor from "../EmberCursor"
import SiteNavigation from "../SiteNavigation"
import {
  askFirekeeperGuide,
  type GuideMessage,
} from "../../services/firekeeperGuide"
import "./sanctuary.css"

type CharacterState = "idle" | "greeting" | "listening" | "thinking" | "responding" | "farewell"

const characterStates: Array<{
  id: CharacterState
  label: string
  description: string
}> = [
  { id: "idle", label: "IDLE", description: "Calm and composed" },
  { id: "greeting", label: "GREETING", description: "Welcoming and serene" },
  {
    id: "listening",
    label: "LISTENING",
    description: "Attentive and thoughtful",
  },
  {
    id: "thinking",
    label: "THINKING",
    description: "Reflective and contemplative",
  },
  {
    id: "responding",
    label: "RESPONDING",
    description: "Answering with care",
  },
  { id: "farewell", label: "FAREWELL", description: "Until we meet again" },
]

const suggestedQuestions = [
  "What is Aprameya?",
  "Tell me about the Legends.",
  "How does Ember Hunt work?",
  "What can I discover here?",
]

const greeting: GuideMessage = {
  role: "assistant",
  content: "Welcome to the Sanctuary. What would you like to discover?",
}
const characterAsset = (state: CharacterState) =>
  `/assets/sanctuary/firekeeper/firekeeper-${state}`

export default function SanctuaryPage() {
  const [messages, setMessages] = useState<GuideMessage[]>([greeting])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [retryQuestion, setRetryQuestion] = useState("")
  const [characterState, setCharacterState] =
    useState<CharacterState>("greeting")
  const [failedPortraits, setFailedPortraits] = useState(
    () => new Set<CharacterState>(),
  )
  const [encounterEnded, setEncounterEnded] = useState(false)
  const [embers] = useState(() => {
    const storedEmbers = Number(localStorage.getItem("apramaya-embers") || 0)
    return Number.isFinite(storedEmbers) && storedEmbers > 0 ? storedEmbers : 0
  })
  const sceneRef = useRef<HTMLDivElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const stateTimerRef = useRef<number | undefined>(undefined)

  const enterCharacterState = (
    nextState: CharacterState,
    returnAfter?: number,
  ) => {
    window.clearTimeout(stateTimerRef.current)
    setCharacterState(nextState)
    if (returnAfter) {
      stateTimerRef.current = window.setTimeout(() => {
        setCharacterState("idle")
        stateTimerRef.current = undefined
      }, returnAfter)
    }
  }

  useEffect(() => {
    const previousTitle = document.title
    document.title = "The Sanctuary | Aprameya"
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    const greetingTimer = window.setTimeout(() => {
      setCharacterState((state) => (state === "greeting" ? "idle" : state))
    }, 3600)
    return () => window.clearTimeout(greetingTimer)
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(stateTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!finePointer.matches || reducedMotion.matches) return

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = scene.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / bounds.width - 0.5
      const y = (event.clientY - bounds.top) / bounds.height - 0.5
      scene.style.setProperty("--backdrop-x", `${-x * 5}px`)
      scene.style.setProperty("--backdrop-y", `${-y * 4}px`)
      scene.style.setProperty("--character-x", `${x * 9}px`)
      scene.style.setProperty("--character-y", `${y * 5}px`)
      scene.style.setProperty("--light-x", `${(x + 0.5) * 100}%`)
      scene.style.setProperty("--light-y", `${(y + 0.5) * 100}%`)
    }

    const resetPointer = () => {
      scene.style.removeProperty("--backdrop-x")
      scene.style.removeProperty("--backdrop-y")
      scene.style.removeProperty("--character-x")
      scene.style.removeProperty("--character-y")
      scene.style.removeProperty("--light-x")
      scene.style.removeProperty("--light-y")
    }

    scene.addEventListener("pointermove", handlePointerMove, { passive: true })
    scene.addEventListener("pointerleave", resetPointer, { passive: true })
    return () => {
      scene.removeEventListener("pointermove", handlePointerMove)
      scene.removeEventListener("pointerleave", resetPointer)
      resetPointer()
    }
  }, [])

  useEffect(() => {
    const conversation = conversationRef.current
    if (conversation) conversation.scrollTop = conversation.scrollHeight
  }, [messages, isLoading, error])

  const markPortraitUnavailable = (state: CharacterState) => {
    setFailedPortraits((current) => new Set(current).add(state))
  }

  const submitQuestion = async (question: string) => {
    const content = question.trim()
    if (!content || isLoading || encounterEnded) return

    const history = messages
    setMessages((current) => [...current, { role: "user", content }])
    setDraft("")
    setIsLoading(true)
    setError("")
    setRetryQuestion("")
    enterCharacterState("thinking")

    try {
      const reply = await askFirekeeperGuide(content, history)
      setMessages((current) => [...current, { role: "assistant", ...reply }])
      enterCharacterState("responding", 2800)
    } catch (cause) {
      console.error("The local Firekeeper guide could not answer.", cause)
      setError(
        "The local guide could not prepare a response. Your question is saved; you can try again.",
      )
      setRetryQuestion(content)
      enterCharacterState("idle")
    } finally {
      setIsLoading(false)
    }
  }

  const retryLastQuestion = async () => {
    if (!retryQuestion || isLoading) return

    setIsLoading(true)
    setError("")
    enterCharacterState("thinking")
    try {
      const reply = await askFirekeeperGuide(retryQuestion, messages)
      setMessages((current) => [...current, { role: "assistant", ...reply }])
      setRetryQuestion("")
      enterCharacterState("responding", 2800)
    } catch (cause) {
      console.error("The local Firekeeper guide could not answer.", cause)
      setError(
        "The local guide could not prepare a response. Your question is saved; you can try again.",
      )
      enterCharacterState("idle")
    } finally {
      setIsLoading(false)
    }
  }

  const endEncounter = () => {
    if (isLoading || encounterEnded) return
    setEncounterEnded(true)
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: "May the embers guide your next path. Until we meet again.",
      },
    ])
    enterCharacterState("farewell")
  }

  const returnToConversation = () => {
    setEncounterEnded(false)
    setError("")
    setRetryQuestion("")
    setDraft("")
    setMessages([greeting])
    enterCharacterState("greeting", 3600)
  }

  const stateDescription =
    characterStates.find((state) => state.id === characterState)?.description ??
    characterStates[0].description
  const visibleCharacterState = failedPortraits.has(characterState)
    ? "idle"
    : characterState

  return (
    <main className="app sanctuary-app">
      <EmberCursor />
      <a className="skip-link" href="#sanctuary-main">
        Skip to Sanctuary
      </a>
      <SiteNavigation
        activeSection="sanctuary"
        embers={embers}
        sanctuaryRoute
      />
      <div id="sanctuary-main" className="sanctuary-main">
        <section
          className="sanctuary-experience"
          aria-labelledby="sanctuary-title"
          data-character-state={characterState}
        >
          <div
            ref={sceneRef}
            className="sanctuary-scene"
            aria-label={`The Firekeeper is ${stateDescription.toLocaleLowerCase()}`}
          >
            <div className="sanctuary-scene-backdrop" />
            <div className="sanctuary-ambient-light" />
            <div className="sanctuary-character-stage" aria-hidden="true">
              {characterStates.map(({ id }) => (
                <picture
                  key={id}
                  className={`sanctuary-character-pose ${
                    visibleCharacterState === id ? "active" : ""
                  }`}
                >
                  <source
                    srcSet={`${characterAsset(id)}.webp?v=3`}
                    type="image/webp"
                  />
                  <img
                    src={`${characterAsset(id)}.png?v=3`}
                    alt=""
                    draggable={false}
                    fetchPriority={id === "idle" ? "high" : "auto"}
                    onError={() => markPortraitUnavailable(id)}
                  />
                </picture>
              ))}
              {failedPortraits.has("idle") && (
                <div
                  className="sanctuary-portrait-fallback"
                  role="img"
                  aria-label="A quiet ember-lit sanctuary"
                >
                  <span>THE FIREKEEPER</span>
                  <p>Her portrait is resting beyond the veil.</p>
                </div>
              )}
            </div>
            <div className="sanctuary-scene-shade" />
            <div className="sanctuary-embers" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>

          <div className="sanctuary-content-column">
            <div className="sanctuary-scene-caption">
              <span className="sanctuary-caption-mark" aria-hidden="true">
                ✦
              </span>
              <p className="eyebrow">A QUIET PLACE BETWEEN TRIALS</p>
              <h1 id="sanctuary-title">
                The <em>Sanctuary</em>
              </h1>
              <p>
                Listen closely.
                <br />
                The flame remembers.
              </p>
            </div>

            <section
              className="firekeeper-panel"
              aria-label="Talk with the Firekeeper"
            >
            <header className="firekeeper-header">
              <div className="firekeeper-sigil" aria-hidden="true">
                Λ
              </div>
              <div>
                <p className="eyebrow">YOUR GUIDE</p>
                <h2>The Firekeeper</h2>
                <p className="firekeeper-subtitle">{stateDescription}</p>
              </div>
              {encounterEnded ? (
                <span className="guide-mode">FAREWELL</span>
              ) : (
                <button
                  className="firekeeper-end"
                  type="button"
                  onClick={endEncounter}
                  disabled={isLoading}
                >
                  END ENCOUNTER
                </button>
              )}
            </header>

            <div
              ref={conversationRef}
              className="firekeeper-conversation"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Conversation with the Firekeeper"
            >
              {messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`firekeeper-message ${message.role}`}
                >
                  {message.role === "assistant" && (
                    <span className="message-sigil" aria-hidden="true">
                      Λ
                    </span>
                  )}
                  <p>{message.content}</p>
                </article>
              ))}

              {messages.length === 1 && (
                <div
                  className="firekeeper-suggestions"
                  aria-label="Suggested questions"
                >
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void submitQuestion(question)}
                    >
                      {question}
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              )}

              {encounterEnded && (
                <div className="firekeeper-farewell">
                  <span className="eyebrow">THE ENCOUNTER ENDS</span>
                  <p>The path remains open whenever you wish to return.</p>
                  <button type="button" onClick={returnToConversation}>
                    RETURN TO THE FLAME
                  </button>
                </div>
              )}

              {isLoading && (
                <p className="firekeeper-thinking" role="status">
                  <span aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  Consulting the local guide…
                </p>
              )}

              {error && (
                <div className="firekeeper-error" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => void retryLastQuestion()}
                    disabled={isLoading}
                  >
                    TRY AGAIN
                  </button>
                </div>
              )}
            </div>

            <form
              className="firekeeper-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submitQuestion(draft)
              }}
            >
              <label className="visually-hidden" htmlFor="firekeeper-question">
                Ask the Firekeeper a question
              </label>
              <textarea
                id="firekeeper-question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask what you seek…"
                maxLength={500}
                rows={1}
                disabled={isLoading || encounterEnded}
                onFocus={() => {
                  if (!isLoading && !encounterEnded)
                    enterCharacterState("listening")
                }}
                onBlur={() => {
                  if (characterState === "listening")
                    enterCharacterState("idle")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void submitQuestion(draft)
                  }
                }}
              />
              <button
                className="firekeeper-send"
                type="submit"
                aria-label="Send question"
                disabled={isLoading || !draft.trim()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 12 20 4l-5 16-3.2-6.8L4 12Z" />
                  <path d="m11.8 13.2 4-4" />
                </svg>
              </button>
            </form>
            <p className="firekeeper-disclaimer">
              Local guide · No AI service is connected. Answers use confirmed
              information from this website.
            </p>
          </section>
        </div>
      </section>
        <footer className="sanctuary-footer">
          <a href="/#world">← RETURN TO THE WORLD</a>
          <span>APRAMAYA · SPARKS CLUB · NMIT MCA</span>
        </footer>
      </div>
    </main>
  )
}
