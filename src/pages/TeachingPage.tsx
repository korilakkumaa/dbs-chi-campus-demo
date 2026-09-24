import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { AsyncStatus } from '../components/AsyncStatus'
import { GlassPanel } from '../components/GlassPanel'
import {
  TEACHING_MEMO_SECTIONS,
  TEACHING_MEMO_SUBTITLE,
  TEACHING_MEMO_SUGGESTIONS,
  TEACHING_MEMO_TITLE,
} from '../data/teachingMemoMeta'
import {
  cancelScrollCorrections,
  chapterIdAtScrollOffset,
  isProgrammaticScroll,
  navigateToSection,
  setTocActiveClass,
  TEACHING_MEMO_SCROLL_OFFSET_PX,
} from '../lib/teachingMemoAccordion'
import {
  clearMarks,
  collectHits,
  filterSuggestions,
  highlightLabelParts,
  jumpToHit,
  TEACHING_MEMO_PAGE_SIZE,
  tokenizeQuery,
  type TeachingMemoHit,
} from '../lib/teachingMemoSearch'

const SCROLL_SPY_OFFSET = TEACHING_MEMO_SCROLL_OFFSET_PX
const SCROLL_SPY_RESUME_MS = 800

function bodyUrl() {
  const base = import.meta.env.BASE_URL || './'
  return `${base}teaching-memo/body.html`
}

function rewriteAssetUrls(root: HTMLElement) {
  const base = import.meta.env.BASE_URL || './'
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src')
    if (!src) return
    if (src.startsWith('./teaching-memo/')) {
      img.setAttribute('src', `${base}${src.slice(2)}`)
    } else if (src.startsWith('teaching-memo/')) {
      img.setAttribute('src', `${base}${src}`)
    }
  })
}

/**
 * Mount handbook HTML once via `innerHTML`. Using React `dangerouslySetInnerHTML`
 * on every parent re-render risked resetting `<details open>` (chapters appear
 * to slam shut while scrolling appendices).
 */
function mountTeachingBody(host: HTMLElement, html: string) {
  if (host.dataset.memoMounted === '1' && host.innerHTML.length > 0) return
  host.innerHTML = html
  host.dataset.memoMounted = '1'
  rewriteAssetUrls(host)
}

export function TeachingPage() {
  const contentRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchBlockRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const suppressSpyUntil = useRef(0)
  const activeTocId = useRef<string | null>(null)

  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  const [contentReady, setContentReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [suggOpen, setSuggOpen] = useState(false)
  const [suggActive, setSuggActive] = useState(-1)
  const [hits, setHits] = useState<TeachingMemoHit[]>([])
  const [page, setPage] = useState(0)
  const [resultNote, setResultNote] = useState('')

  const tokens = tokenizeQuery(query)
  const suggestions = filterSuggestions(query, TEACHING_MEMO_SUGGESTIONS)
  const showSugg = suggOpen && Boolean(query.trim())
  const totalPages = Math.max(1, Math.ceil(hits.length / TEACHING_MEMO_PAGE_SIZE))
  const pageHits = hits.slice(
    page * TEACHING_MEMO_PAGE_SIZE,
    page * TEACHING_MEMO_PAGE_SIZE + TEACHING_MEMO_PAGE_SIZE,
  )

  useEffect(() => {
    let cancelled = false
    fetch(bodyUrl())
      .then(async (res) => {
        if (!res.ok) throw new Error(`載入失敗（${res.status}）`)
        return res.text()
      })
      .then((html) => {
        if (!cancelled) {
          setBodyHtml(html)
          setLoadError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '無法載入備忘內容')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Imperative mount — host node stays stable across search / TOC UI updates.
  useEffect(() => {
    const host = contentRef.current
    if (!host || !bodyHtml) return
    mountTeachingBody(host, bodyHtml)
    setContentReady(true)
  }, [bodyHtml])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!searchBlockRef.current?.contains(e.target as Node)) {
        setSuggOpen(false)
        setSuggActive(-1)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // User scroll intent cancels programmatic jump-backs (critical for long appendices).
  useEffect(() => {
    const onUserScrollIntent = () => {
      cancelScrollCorrections()
    }
    window.addEventListener('wheel', onUserScrollIntent, { passive: true })
    window.addEventListener('touchmove', onUserScrollIntent, { passive: true })
    window.addEventListener('keydown', onUserScrollIntent, { passive: true })
    return () => {
      window.removeEventListener('wheel', onUserScrollIntent)
      window.removeEventListener('touchmove', onUserScrollIntent)
      window.removeEventListener('keydown', onUserScrollIntent)
    }
  }, [])

  // Scroll-spy: TOC class only — never setState, never touch details.open.
  useEffect(() => {
    if (!contentReady) return
    const onScroll = () => {
      if (!isProgrammaticScroll()) cancelScrollCorrections()
      if (performance.now() < suppressSpyUntil.current) return
      const root = contentRef.current
      if (!root) return
      const id = chapterIdAtScrollOffset(root, SCROLL_SPY_OFFSET)
      if (!id || id === activeTocId.current) return
      activeTocId.current = id
      setTocActiveClass(tocRef.current, id)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [contentReady])

  // Search indexes hits; never collapse reading state when clearing the query.
  useEffect(() => {
    if (!contentReady) return
    const root = contentRef.current
    if (!root) return

    const t = window.setTimeout(() => {
      clearMarks(root)
      clearMarks(root, 'mark.cms-hl-jump')
      const trimmed = query.trim()
      if (!trimmed) {
        setHits([])
        setPage(0)
        setResultNote('')
        return
      }
      const next = collectHits(root, trimmed)
      setHits(next)
      setPage(0)
      const matched = new Set(next.map((h) => h.sectionId).filter(Boolean))
      if (next.length) {
        setResultNote(
          `全站共找到 ${next.length} 處「${trimmed}」（${matched.size} 個章節）· 點選下方結果以跳轉`,
        )
      } else {
        setResultNote('')
      }
    }, 150)
    return () => window.clearTimeout(t)
  }, [query, contentReady])

  const markToc = (id: string) => {
    activeTocId.current = id
    setTocActiveClass(tocRef.current, id)
  }

  const goToTarget = (id: string) => {
    const root = contentRef.current
    if (!root) return
    suppressSpyUntil.current = performance.now() + SCROLL_SPY_RESUME_MS
    const el = navigateToSection(root, id, {
      exclusive: true,
      expandDescendants: true,
    })
    if (!el) return
    markToc(id)
  }

  const selectSuggestion = (value: string) => {
    setQuery(value)
    setSuggOpen(false)
    setSuggActive(-1)
  }

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const open = showSugg && suggestions.length > 0
    if (e.key === 'ArrowDown') {
      if (open) {
        e.preventDefault()
        setSuggActive((i) => (i < suggestions.length - 1 ? i + 1 : 0))
      }
      return
    }
    if (e.key === 'ArrowUp') {
      if (open) {
        e.preventDefault()
        setSuggActive((i) => (i > 0 ? i - 1 : suggestions.length - 1))
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && suggActive >= 0 && suggestions[suggActive]) {
        selectSuggestion(suggestions[suggActive])
      } else {
        setSuggOpen(false)
      }
      return
    }
    if (e.key === 'Escape') {
      if (showSugg) {
        e.preventDefault()
        setSuggOpen(false)
        setSuggActive(-1)
        return
      }
      if (query) {
        e.preventDefault()
        setQuery('')
      }
    }
  }

  const onHitClick = (hit: TeachingMemoHit) => {
    const root = contentRef.current
    if (!root) return
    suppressSpyUntil.current = performance.now() + SCROLL_SPY_RESUME_MS
    jumpToHit(root, hit, query.trim())
    if (hit.sectionId) markToc(hit.sectionId)
  }

  return (
    <div className="page teaching-page">
      <header className="page-header reveal-up">
        <div className="page-header-title">
          <h1>
            學與教
            <span className="page-upcoming-badge">備忘</span>
          </h1>
        </div>
        <p>
          {TEACHING_MEMO_TITLE}
          <span className="teaching-memo-copy"> · {TEACHING_MEMO_SUBTITLE}</span>
        </p>
      </header>

      <GlassPanel className="teaching-memo-dock reveal-up delay-1">
        <div
          ref={searchBlockRef}
          className={`search-block teaching-memo-search${query ? ' has-query' : ''}`}
        >
          <label className="sr-only" htmlFor="teaching-memo-search">
            搜尋學與教備忘
          </label>
          <div className="search-field">
            <svg
              className="search-glyph"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              aria-hidden
            >
              <circle
                cx="10.5"
                cy="10.5"
                r="6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M15.5 15.5 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={searchRef}
              id="teaching-memo-search"
              type="search"
              role="combobox"
              aria-expanded={showSugg}
              aria-controls="teaching-memo-suggestions"
              aria-autocomplete="list"
              placeholder="搜尋章節、主題或關鍵字…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSuggOpen(true)
                setSuggActive(-1)
              }}
              onFocus={() => {
                if (query.trim()) setSuggOpen(true)
              }}
              onKeyDown={onSearchKeyDown}
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                aria-label="清除搜尋"
                onClick={() => {
                  setQuery('')
                  setSuggOpen(false)
                  setSuggActive(-1)
                  searchRef.current?.focus()
                }}
              >
                ×
              </button>
            ) : null}
          </div>
          {showSugg ? (
            <div
              id="teaching-memo-suggestions"
              className="search-results"
              role="listbox"
              aria-label="搜尋建議"
            >
              {suggestions.length === 0 ? (
                <p className="search-empty">沒有建議，按 Enter 搜尋全文</p>
              ) : (
                suggestions.map((s, index) => (
                  <button
                    key={s}
                    type="button"
                    className={`search-result${index === suggActive ? ' active' : ''}`}
                    role="option"
                    aria-selected={index === suggActive}
                    onMouseEnter={() => setSuggActive(index)}
                    onClick={() => selectSuggestion(s)}
                  >
                    <span className="search-result-name">
                      {highlightLabelParts(s, tokens).map((part) =>
                        part.mark ? (
                          <mark key={part.key}>{part.text}</mark>
                        ) : (
                          <span key={part.key}>{part.text}</span>
                        ),
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        {resultNote ? <p className="teaching-memo-result-note">{resultNote}</p> : null}
      </GlassPanel>

      {hits.length > 0 ? (
        <GlassPanel className="teaching-memo-hits reveal-up delay-1">
          <div className="teaching-memo-hits-head" ref={resultsRef}>
            <p>
              搜尋「<strong>{query.trim()}</strong>」共{' '}
              <strong>{hits.length}</strong> 處
            </p>
            <div className="teaching-memo-pager">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => {
                  setPage((p) => Math.max(0, p - 1))
                  resultsRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                  })
                }}
              >
                上一頁
              </button>
              <span>
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => {
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                  resultsRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                  })
                }}
              >
                下一頁
              </button>
            </div>
          </div>
          <div className="teaching-memo-hit-list">
            {pageHits.map((h, i) => {
              const abs = page * TEACHING_MEMO_PAGE_SIZE + i
              return (
                <button
                  key={`${h.sectionId}-${h.ordInSec}-${abs}`}
                  type="button"
                  className="teaching-memo-hit"
                  onClick={() => onHitClick(h)}
                >
                  <span className="teaching-memo-hit-sec">
                    <span className="teaching-memo-hit-badge">{abs + 1}</span>
                    {h.sectionLabel}
                  </span>
                  <span className="teaching-memo-hit-snip">
                    {h.prefix}
                    <mark>{h.match}</mark>
                    {h.suffix}
                  </span>
                </button>
              )
            })}
          </div>
        </GlassPanel>
      ) : null}

      {query.trim() && hits.length === 0 && contentReady ? (
        <p className="teaching-memo-empty reveal-up">沒有符合的內容。</p>
      ) : null}

      <div className="teaching-memo-layout reveal-up delay-2">
        <nav className="teaching-memo-toc" aria-label="目錄" ref={tocRef}>
          <h2>目錄</h2>
          <ul>
            {TEACHING_MEMO_SECTIONS.map((sec) => (
              <li key={sec.id}>
                <button
                  type="button"
                  data-toc-target={sec.id}
                  className="teaching-memo-toc-link"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToTarget(sec.id)}
                >
                  {sec.tocLabel}
                </button>
                {sec.subs.length > 0 ? (
                  <ul className="teaching-memo-toc-sub">
                    {sec.subs.map((sub) => (
                      <li key={sub.id}>
                        <button
                          type="button"
                          data-toc-target={sub.id}
                          className="teaching-memo-toc-link teaching-memo-toc-sub-link"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => goToTarget(sub.id)}
                        >
                          {sub.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <GlassPanel className="teaching-memo-sheet">
          {loadError ? (
            <AsyncStatus variant="error" panel={false} message={loadError} />
          ) : null}
          {!contentReady && !loadError ? (
            <AsyncStatus variant="loading" panel={false} message="載入備忘中…" />
          ) : null}
          {/* Stable host: never swap this node for loading UI (would wipe open state). */}
          <div
            ref={contentRef}
            className="teaching-memo-body"
            hidden={!contentReady}
          />
        </GlassPanel>
      </div>
    </div>
  )
}
