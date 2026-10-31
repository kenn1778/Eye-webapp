import type { Dispatch, RefObject, SetStateAction } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../ThemeToggle";

export type NavDropdownItems = Record<string, { label: string; action: () => void }[]>;

type PublicHeaderProps = {
  headerRef: RefObject<HTMLElement | null>;
  isShrunk: boolean;
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  openDropdown: string | null;
  setOpenDropdown: Dispatch<SetStateAction<string | null>>;
  searchOpen: boolean;
  setSearchOpen: Dispatch<SetStateAction<boolean>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  navDropdownItems: NavDropdownItems;
  dropdownLabels: Record<string, string>;
  scrollToLatest: () => void;
  scrollToNewsletter: () => void;
  scrollToContact: () => void;
  submitSearch: (value: string) => void;
};

export function PublicHeader({
  headerRef,
  isShrunk,
  menuOpen,
  setMenuOpen,
  openDropdown,
  setOpenDropdown,
  searchOpen,
  setSearchOpen,
  query,
  setQuery,
  navDropdownItems,
  dropdownLabels,
  scrollToLatest,
  scrollToNewsletter,
  scrollToContact,
  submitSearch,
}: PublicHeaderProps) {
  return (
    <header
      ref={headerRef}
      className={isShrunk ? "bf-header is-shrunk" : "bf-header"}
    >
      <div className="bf-header-inner">
        <Link to="/" className="bf-brand" aria-label="Exploor home">
          <img
            className="bf-brand-logo"
            src="/exploor-logo.gif"
            alt=""
            width={40}
            height={40}
            decoding="async"
          />
          <span className="bf-brand-text">
            <span className="bf-brand-name">Expl00r</span>
            <span className="bf-brand-tagline">Share ideas, Inspire Minds</span>
          </span>
        </Link>

        <nav className="bf-nav" aria-label="Main navigation">
          <button
            className="bf-nav-link"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Home
          </button>
          <button
            className="bf-nav-link"
            type="button"
            onClick={scrollToLatest}
          >
            Blog
          </button>
          {Object.keys(navDropdownItems).map((key) => (
            <div
              key={key}
              className={
                openDropdown === key ? "bf-nav-item is-open" : "bf-nav-item"
              }
              onMouseEnter={() => setOpenDropdown(key)}
              onMouseLeave={() =>
                setOpenDropdown((current) => (current === key ? null : current))
              }
            >
              <button
                className="bf-nav-link bf-nav-caret"
                type="button"
                aria-expanded={openDropdown === key}
                onClick={() =>
                  setOpenDropdown(openDropdown === key ? null : key)
                }
              >
                {dropdownLabels[key]}
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="m3 4.5 3 3 3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="bf-dropdown" role="menu">
                {navDropdownItems[key].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={item.action}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="bf-nav-link"
            type="button"
            onClick={scrollToContact}
          >
            Contact
          </button>
        </nav>

        <div className="bf-header-actions">
          <ThemeToggle variant="header" />
          <button
            className="bf-icon-btn"
            type="button"
            aria-label={searchOpen ? "Close search" : "Search articles"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle
                cx="8.8"
                cy="8.8"
                r="5.8"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="m13.2 13.2 4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            className="bf-subscribe-btn"
            type="button"
            onClick={scrollToNewsletter}
          >
            Subscribe
          </button>
          <button
            className="bf-burger"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="bf-mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <form
          className="bf-searchbar"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchOpen(false);
            submitSearch(query);
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search articles..."
            aria-label="Search articles"
          />
          <button type="submit">Search</button>
        </form>
      )}

      <div
        id="bf-mobile-menu"
        className={menuOpen ? "bf-mobile-menu is-open" : "bf-mobile-menu"}
      >
        <button
          className="bf-mobile-link"
          type="button"
          onClick={() => {
            setMenuOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Home
        </button>
        <button
          className="bf-mobile-link"
          type="button"
          onClick={() => {
            setMenuOpen(false);
            scrollToLatest();
          }}
        >
          Blog
        </button>
        {Object.keys(navDropdownItems).map((key) => (
          <div key={key} className="bf-mobile-group">
            <button
              className="bf-mobile-link bf-mobile-caret"
              type="button"
              aria-expanded={openDropdown === key}
              onClick={() => setOpenDropdown(openDropdown === key ? null : key)}
            >
              {dropdownLabels[key]}
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <path
                  d="m3 4.5 3 3 3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div
              className={
                openDropdown === key ? "bf-mobile-sub is-open" : "bf-mobile-sub"
              }
            >
              {navDropdownItems[key].map((item) => (
                <button key={item.label} type="button" onClick={item.action}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button
          className="bf-mobile-link"
          type="button"
          onClick={() => {
            setMenuOpen(false);
            scrollToContact();
          }}
        >
          Contact
        </button>
        <div className="bf-mobile-actions">
          <button
            className="bf-subscribe-btn"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              scrollToNewsletter();
            }}
          >
            Subscribe
          </button>
          <ThemeToggle variant="menu" />
        </div>
      </div>
    </header>
  );
}
