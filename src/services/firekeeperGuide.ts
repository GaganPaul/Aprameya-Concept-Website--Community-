export type GuideMessage = {
  role: "user" | "assistant"
  content: string
  topic?: GuideTopic
}

export type GuideTopic = "aprameya" | "legends" | "ember-hunt" | "sanctuary" | "event-details"

type GuideReply = {
  content: string
  topic?: GuideTopic
}

const answers: Record<GuideTopic, string> = {
  aprameya:
    "Aprameya is a 48-hour hackathon hosted by Sparks Club and the NMIT MCA Department. The site invites you to explore its legends, rest at the bonfire, and try Ember Hunt. Some official event details are still awaiting confirmation.",
  legends:
    "The Legends gallery presents six character trials, each paired with a builder's principle: looking beyond the known, confronting complexity together, adapting to change, moving through uncertainty, turning vision into form, and building stronger as one.",
  "ember-hunt":
    "Ember Hunt is a short maze challenge. Collect five embers and find the exit before the 90-second timer runs out; hazards cost eight seconds. Keyboard and touch controls are supported. Scores and personal bests stay on this device, and there is no verified global leaderboard service connected.",
  sanctuary:
    "The Sanctuary is an experimental guide to Aprameya. This version uses a small local knowledge guide—there is no AI service or conversation backend connected. I can share confirmed information from the site and will say when a detail is not available.",
  "event-details":
    "The site identifies Aprameya as a 48-hour hackathon hosted by Sparks Club at the NMIT MCA Department. Registration dates, official rules, challenge tracks, and judging details have not been confirmed here yet.",
}

const intentTerms: Array<[GuideTopic, RegExp]> = [
  ["ember-hunt", /\b(ember hunt|maze|game|play|embers|hazard|score)\b/],
  ["legends", /\b(legend|legends|character|guardian|carousel|trial)\b/],
  ["sanctuary", /\b(sanctuary|firekeeper|guide|assistant|ai|chat)\b/],
  [
    "event-details",
    /\b(date|when|register|registration|rules|eligibility|judging|prize|reward|deadline|track)\b/,
  ],
  ["aprameya", /\b(aprameya|hackathon|event|host|sparks|nmit|department)\b/],
]

export async function askFirekeeperGuide(
  question: string,
  history: GuideMessage[],
): Promise<GuideReply> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 260))

  const normalized = question.trim().toLocaleLowerCase()
  if (!normalized) {
    throw new Error("A question is required before asking the local guide.")
  }

  if (
    /^(hi|hello|hey|greetings|good morning|good evening)[.! ]*$/.test(
      normalized,
    )
  ) {
    return {
      content:
        "Welcome, traveller. What would you like to discover about Aprameya?",
    }
  }

  const topic = intentTerms.find(([, pattern]) => pattern.test(normalized))?.[0]
  if (topic) return { content: answers[topic], topic }

  const lastTopic = [...history]
    .reverse()
    .find((message) => message.role === "assistant" && message.topic)?.topic

  if (
    lastTopic &&
    /\b(more|why|how|explain|details|tell me more|elaborate)\b/.test(normalized)
  ) {
    return { content: answers[lastTopic], topic: lastTopic }
  }

  return {
    content:
      "I don't have confirmed information for that question in this local guide. Event dates, registration, official rules, and judging details may still be forthcoming. Try asking about Aprameya, the Legends, Ember Hunt, or this Sanctuary.",
  }
}
