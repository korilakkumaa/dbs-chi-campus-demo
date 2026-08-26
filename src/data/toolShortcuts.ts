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
    href: 'https://makwan.dsehero.com',
  },
  {
    id: 'notebooklm',
    label: 'NotebookLM',
    href: 'https://notebooklm.google.com/',
  },
  {
    id: 'extensive-reading',
    label: '校內廣泛閱讀計劃',
    href: 'https://forms.gle/3TiwG8QkyEHTBfcW9',
  },
  {
    id: 'edbook',
    label: '教圖系統',
    href: 'https://member.hkep.com/web/zh/login?i=1',
  },
]
