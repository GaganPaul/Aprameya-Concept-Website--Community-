type BonfireFallbackProps = {
  kindled: boolean
}

export default function BonfireFallback({ kindled }: BonfireFallbackProps) {
  return (
    <div
      className={`bonfire-fallback ${kindled ? "kindled" : ""}`}
      aria-hidden="true"
    >
      <div className="stone-ring">
        {Array.from({ length: 8 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
      <div className="log l1" />
      <div className="log l2" />
      <div className="fire-light" />
      <div className="fire">
        {Array.from({ length: 7 }, (_, index) => (
          <b key={index} />
        ))}
      </div>
      <div className="sword">
        <svg viewBox="0 0 64 280" role="presentation">
          <defs>
            <linearGradient id="bonfire-blade" x1="0" x2="1">
              <stop offset="0" stopColor="#333b45" />
              <stop offset=".48" stopColor="#aeb8bd" />
              <stop offset="1" stopColor="#252d35" />
            </linearGradient>
          </defs>
          <circle
            cx="32"
            cy="16"
            r="8"
            fill="none"
            stroke="#9a8a6c"
            strokeWidth="5"
          />
          <path d="M32 25v38" stroke="#675843" strokeWidth="7" />
          <path d="M10 62h44l-4 9H14z" fill="#69563c" />
          <path
            d="M28 70h8l12 176H16z"
            fill="url(#bonfire-blade)"
            stroke="#b0a486"
            strokeWidth="2"
          />
          <path
            d="M32 76v153"
            stroke="#d0c8b3"
            strokeOpacity=".48"
            strokeWidth="2"
          />
          <path d="M10 244h44l-7 10H17z" fill="#524635" />
          <path d="M32 254v16" stroke="#786447" strokeWidth="7" />
        </svg>
      </div>
      <div className="fire-sparks">
        {Array.from({ length: 8 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  )
}
