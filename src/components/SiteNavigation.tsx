import { useState } from "react"

type NavigationSection = "world" | "quest" | "journey" | "arsenal" | "about" | "sanctuary"
type NavigationItem = {
  id: NavigationSection
  label: string
}

const navigationItems: NavigationItem[] = [
  { id: "world", label: "THE WORLD" },
  { id: "quest", label: "THE QUEST" },
  { id: "journey", label: "THE JOURNEY" },
  { id: "arsenal", label: "THE ARSENAL" },
  { id: "sanctuary", label: "SANCTUARY" },
  { id: "about", label: "ABOUT US" },
]

export default function SiteNavigation({
  activeSection,
  embers,
  sanctuaryRoute = false,
}: {
  activeSection: NavigationSection
  embers: number
  sanctuaryRoute?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="nav solid">
      <a className="sigil" href={sanctuaryRoute ? "/#world" : "#world"}>
        <span>Λ</span> APRAMEYA
      </a>
      <button
        className="menu-button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls="site-navigation-links"
      >
        MENU
      </button>
      <nav
        id="site-navigation-links"
        className={menuOpen ? "links open" : "links"}
        aria-label="Main navigation"
      >
        {navigationItems.map(({ id, label }) => {
          const href =
            id === "sanctuary"
              ? "/sanctuary"
              : sanctuaryRoute
                ? `/#${id}`
                : `#${id}`
          return (
            <a
              key={id}
              className={activeSection === id ? "active" : ""}
              href={href}
              aria-current={activeSection === id ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          )
        })}
      </nav>
      <div className="ember-count">
        <i /> {embers} EMBERS
      </div>
    </header>
  )
}
