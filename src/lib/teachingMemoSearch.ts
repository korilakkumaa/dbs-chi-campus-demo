/** Document search helpers for 學與教備忘 (ported from the source HTML). */

import {
  closeTopLevelExcept,
  expandDescendantDetails,
  openDetailsAncestors,
  scrollElementIntoView,
} from './teachingMemoAccordion'

export type TeachingMemoHit = {
  sectionId: string
  sectionLabel: string
  prefix: string
  match: string
  suffix: string
  ordInSec: number
  index: number
  length: number
}

export const TEACHING_MEMO_PAGE_SIZE = 20

export function normalizeQuery(s: string) {
  return (s || '').toLowerCase()
}

export function tokenizeQuery(q: string) {
  return normalizeQuery(q).trim().split(/\s+/).filter(Boolean)
}

export function textMatchesAll(text: string, tokens: string[]) {
  const nt = normalizeQuery(text)
  return tokens.every((t) => nt.includes(t))
}

export function sectionLabel(item: Element) {
  const badge = item.querySelector('.acc-num')
  const title = item.querySelector('.acc-title')
  const badgeT = badge?.textContent?.trim() ?? ''
  const titleT =
    title?.textContent?.trim() || item.getAttribute('data-title') || ''
  if (badgeT && titleT) return `${badgeT} ${titleT}`
  return titleT || badgeT || item.id || ''
}

export function collectHits(root: ParentNode, query: string): TeachingMemoHit[] {
  const hits: TeachingMemoHit[] = []
  const q = query
  if (!q) return hits
  const qLower = q.toLowerCase()
  const items = Array.from(root.querySelectorAll('.acc-item'))
  for (const item of items) {
    const secLabel = sectionLabel(item)
    const secId = item.id || ''
    const panel = item.querySelector('.acc-panel-inner') || item
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
    let node: Node | null
    let ordInSec = 0
    while ((node = walker.nextNode())) {
      const text = node.nodeValue
      if (!text) continue
      const lower = text.toLowerCase()
      let from = 0
      while (true) {
        const idx = lower.indexOf(qLower, from)
        if (idx === -1) break
        const start = Math.max(0, idx - 28)
        const end = Math.min(text.length, idx + q.length + 28)
        let prefix = text.slice(start, idx)
        const match = text.slice(idx, idx + q.length)
        let suffix = text.slice(idx + q.length, end)
        if (start > 0) prefix = `…${prefix}`
        if (end < text.length) suffix = `${suffix}…`
        hits.push({
          sectionId: secId,
          sectionLabel: secLabel,
          prefix,
          match,
          suffix,
          ordInSec,
          index: idx,
          length: q.length,
        })
        ordInSec++
        from = idx + Math.max(1, q.length)
      }
    }
  }
  return hits
}

export function clearMarks(root: ParentNode, selector = 'mark') {
  root.querySelectorAll(selector).forEach((m) => {
    const parent = m.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(m.textContent || ''), m)
    parent.normalize()
  })
}

export function expandMatchedNests(root: Element, tokens: string[]) {
  if (!tokens.length) return
  root
    .querySelectorAll('.sub-item, [class*="sub"][class*="-item"]')
    .forEach((el) => {
      if (!textMatchesAll(el.textContent || '', tokens)) return
      if (el instanceof HTMLDetailsElement) {
        el.open = true
        el.classList.add('open')
      }
    })
}

export function jumpToHit(
  root: ParentNode,
  hit: TeachingMemoHit,
  query: string,
) {
  clearMarks(root, 'mark.cms-hl-jump')
  const item = hit.sectionId
    ? root.querySelector(`#${CSS.escape(hit.sectionId)}`)
    : null
  if (!(item instanceof HTMLElement)) return

  closeTopLevelExcept(root, item)
  openDetailsAncestors(item)
  expandDescendantDetails(item)
  if (query) expandMatchedNests(item, [query])

  if (!query) {
    scrollElementIntoView(item)
    return
  }

  window.setTimeout(() => {
    const panel = item.querySelector('.acc-panel-inner') || item
    const qLower = query.toLowerCase()
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
    let node: Node | null
    let ord = 0
    let target: Text | null = null
    let targetIdx = -1
    while ((node = walker.nextNode())) {
      const text = node.nodeValue
      if (!text) continue
      const lower = text.toLowerCase()
      let from = 0
      while (true) {
        const idx = lower.indexOf(qLower, from)
        if (idx === -1) break
        if (ord === hit.ordInSec) {
          target = node as Text
          targetIdx = idx
          break
        }
        ord++
        from = idx + Math.max(1, query.length)
      }
      if (target) break
    }
    if (!target || targetIdx < 0 || !target.parentNode) {
      scrollElementIntoView(item)
      return
    }
    const text = target.nodeValue || ''
    const before = text.slice(0, targetIdx)
    const mid = text.slice(targetIdx, targetIdx + query.length)
    const after = text.slice(targetIdx + query.length)
    const frag = document.createDocumentFragment()
    if (before) frag.appendChild(document.createTextNode(before))
    const mark = document.createElement('mark')
    mark.className = 'cms-hl-jump'
    mark.textContent = mid
    frag.appendChild(mark)
    if (after) frag.appendChild(document.createTextNode(after))
    target.parentNode.replaceChild(frag, target)
    scrollElementIntoView(mark)
  }, 120)
}

export function filterSuggestions(
  query: string,
  catalog: string[],
  limit = 12,
): string[] {
  const tokens = tokenizeQuery(query)
  if (!tokens.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of catalog) {
    if (!s || seen.has(s)) continue
    if (!textMatchesAll(s, tokens)) continue
    seen.add(s)
    out.push(s)
    if (out.length >= limit) break
  }
  return out
}

export function highlightLabelParts(label: string, tokens: string[]) {
  if (!tokens.length) return [{ key: '0', mark: false as const, text: label }]
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = label.split(re).filter((p) => p.length > 0)
  return parts.map((part, i) => {
    const isMark = tokens.some(
      (t) => part.toLowerCase() === t.toLowerCase(),
    )
    return { key: `${i}-${part}`, mark: isMark, text: part }
  })
}
