export type ToolShortcut = {
  id: string
  label: string
  blurb?: string
  href: string
}

/** 全站常用連結；校內網址可之後替換為正式入口。 */
export const TOOL_SHORTCUTS: ToolShortcut[] = [
  {
    id: 'makwan',
    label: '墨韻',
    blurb: 'AI 批改網站',
    href: 'https://makwan-edcity.sayo.ai/',
  },
  {
    id: 'notebooklm',
    label: 'NotebookLM',
    href: 'https://notebooklm.google.com/',
  },
  {
    id: 'extensive-reading',
    label: '校內廣泛閱讀計劃',
    href: 'https://www.dbs.edu.hk/',
  },
  {
    id: 'edbook',
    label: '教圖系統',
    href: 'https://www.hkedcity.net/',
  },
]
