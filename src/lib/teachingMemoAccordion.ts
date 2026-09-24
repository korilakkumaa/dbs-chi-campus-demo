/**
 * Accordion / TOC navigation for 學與教備忘.
 *
 * Reading UX invariants (do not break these):
 * 1. Scroll-spy must NEVER open/close `<details>` — highlight only.
 * 2. Document body HTML is mounted imperatively once; React re-renders must
 *    not rewrite it (that resets every `open` flag and “合上” chapters).
 * 3. Programmatic scroll corrections must cancel on real user scroll intent
 *    (wheel / touch / keys), or delayed `scrollTo` yanks the reader back.
 * 4. Closing other chapters is TOC/search navigation only (`exclusive`), never
 *    while the user is passively scrolling an open appendix.
 */

export type OpenSectionOptions = {
  /** Close other top-level `.acc-item` chapters (TOC / search jump). */
  exclusive?: boolean
  /** Open every nested `<details>` under the target section. Default true. */
  expandDescendants?: boolean
}

/** Space below sticky shell chrome when aligning a section to the top. */
export const TEACHING_MEMO_SCROLL_OFFSET_PX = 96

function isDetails(el: Element | null): el is HTMLDetailsElement {
  return el instanceof HTMLDetailsElement
}

/** Open this details and every ancestor details (not non-details nodes). */
export function openDetailsAncestors(el: Element | null) {
  let cur: Element | null = el
  while (cur) {
    if (isDetails(cur)) {
      cur.open = true
      cur.classList.add('open')
    }
    cur = cur.parentElement
  }
}

export function expandDescendantDetails(root: Element) {
  root.querySelectorAll('details').forEach((d) => {
    d.open = true
    d.classList.add('open')
  })
}

export function closeTopLevelExcept(root: ParentNode, keep: Element | null) {
  root.querySelectorAll('details.acc-item').forEach((d) => {
    if (d === keep) return
    if (!isDetails(d)) return
    d.open = false
    d.classList.remove('open')
  })
}

/**
 * Open a section or subsection by id so its text is visible, then return the
 * element to scroll to (subsection if requested, else chapter).
 */
export function openSectionById(
  root: ParentNode,
  id: string,
  opts: OpenSectionOptions = {},
): HTMLElement | null {
  const { exclusive = true, expandDescendants = true } = opts
  const el = root.querySelector(`#${CSS.escape(id)}`)
  if (!(el instanceof HTMLElement)) return null

  const chapter = el.matches('details.acc-item')
    ? el
    : el.closest('details.acc-item')

  if (exclusive) closeTopLevelExcept(root, chapter)

  openDetailsAncestors(el)

  if (expandDescendants) {
    const expandRoot = chapter ?? el
    expandDescendantDetails(expandRoot)
  } else if (isDetails(el)) {
    el.open = true
    el.classList.add('open')
  }

  return el
}

function documentScroller(): Element {
  return (document.scrollingElement as Element | null) ?? document.documentElement
}

/** Bump to cancel pending programmatic scroll corrections. */
let scrollCorrectionToken = 0
let programmaticScrollDepth = 0

function withProgrammaticScroll(fn: () => void) {
  programmaticScrollDepth += 1
  try {
    fn()
  } finally {
    window.requestAnimationFrame(() => {
      programmaticScrollDepth = Math.max(0, programmaticScrollDepth - 1)
    })
  }
}

/** Call when the user scrolls manually so delayed jump-backs stop. */
export function cancelScrollCorrections() {
  scrollCorrectionToken += 1
}

/** True while our code is calling scrollTo (scrollbar drag should cancel). */
export function isProgrammaticScroll() {
  return programmaticScrollDepth > 0
}

/** Scroll the page so `el` sits below the sticky chrome (recalculates each call). */
export function scrollSectionIntoView(
  el: HTMLElement,
  offsetPx: number = TEACHING_MEMO_SCROLL_OFFSET_PX,
) {
  const scroller = documentScroller()
  const scrollTop =
    scroller === document.documentElement || scroller === document.body
      ? window.scrollY
      : (scroller as HTMLElement).scrollTop
  const y = el.getBoundingClientRect().top + scrollTop - offsetPx
  const top = Math.max(0, y)
  withProgrammaticScroll(() => {
    if (scroller === document.documentElement || scroller === document.body) {
      window.scrollTo({ top, behavior: 'auto' })
    } else {
      ;(scroller as HTMLElement).scrollTo({ top, behavior: 'auto' })
    }
  })
}

/**
 * After opening `<details>`, layout settles across frames. Scroll now, then
 * correct a few times — but stop as soon as the user scrolls themselves.
 */
export function scrollElementIntoView(el: HTMLElement) {
  const token = ++scrollCorrectionToken
  const correct = () => {
    if (token !== scrollCorrectionToken) return
    scrollSectionIntoView(el)
  }

  void el.offsetHeight
  correct()

  window.requestAnimationFrame(() => {
    correct()
    window.requestAnimationFrame(correct)
  })
  window.setTimeout(correct, 50)
  window.setTimeout(correct, 150)
}

/**
 * Open by id and scroll in one step (preferred TOC / in-page jump entry).
 */
export function navigateToSection(
  root: ParentNode,
  id: string,
  opts: OpenSectionOptions = {},
): HTMLElement | null {
  const el = openSectionById(root, id, opts)
  if (!el) return null
  scrollElementIntoView(el)
  return el
}

/**
 * Which top-level chapter is the reading anchor (last whose top passed the
 * offset). Does not open/close anything.
 */
export function chapterIdAtScrollOffset(
  root: ParentNode,
  offsetPx: number,
): string | null {
  const items = root.querySelectorAll('details.acc-item[id]')
  let current: string | null = null
  items.forEach((node) => {
    if (node.getBoundingClientRect().top < offsetPx) current = node.id
  })
  return current
}

/** Imperative TOC highlight — avoids React re-renders while scrolling. */
export function setTocActiveClass(tocRoot: ParentNode | null, id: string | null) {
  if (!tocRoot) return
  tocRoot.querySelectorAll<HTMLElement>('[data-toc-target]').forEach((btn) => {
    const on = id != null && btn.dataset.tocTarget === id
    btn.classList.toggle('active', on)
  })
}
