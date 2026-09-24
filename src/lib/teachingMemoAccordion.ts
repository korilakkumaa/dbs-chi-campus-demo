/**
 * Accordion / TOC navigation for 學與教備忘.
 *
 * Design notes (why the first version broke reading):
 * 1. Exclusive `toggle` listeners closed sibling chapters on every nested
 *    open/close (toggle bubbles). That fought TOC/search and felt like
 *    “chapters collapse while scrolling”.
 * 2. Search clear set every `details.open = false`, wiping reading state.
 * 3. TOC often opened a chapter whose body lives only in nested `<details>`,
 *    so the panel looked empty until the user expanded subs by hand.
 * 4. `openDetailsChain` added `.open` to non-details ancestors — noisy and
 *    unrelated to native `<details>` behavior.
 *
 * Rules for this module:
 * - Only navigation helpers open/close top-level chapters (never scroll-spy).
 * - Scroll-spy may update the active TOC id only.
 * - Opening a section expands nested details so text is actually visible.
 */

export type OpenSectionOptions = {
  /** Close other top-level `.acc-item` chapters (TOC / search jump). */
  exclusive?: boolean
  /** Open every nested `<details>` under the target section. Default true. */
  expandDescendants?: boolean
}

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

  const chapter =
    el.matches('details.acc-item')
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

/** Nearest scrollable ancestor, or the scrolling element / window. */
export function getScrollParent(el: Element | null): Element | Window {
  let cur: Element | null = el
  while (cur && cur !== document.body) {
    const style = window.getComputedStyle(cur)
    const oy = style.overflowY
    if (
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      cur.scrollHeight > cur.clientHeight
    ) {
      return cur
    }
    cur = cur.parentElement
  }
  return (document.scrollingElement as Element | null) ?? window
}

export function scrollElementIntoView(
  el: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
) {
  // Two frames: wait for `<details>` open layout before scrolling.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior, block: 'start' })
    })
  })
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
  items.forEach((el) => {
    if (el.getBoundingClientRect().top < offsetPx) current = el.id
  })
  return current
}
