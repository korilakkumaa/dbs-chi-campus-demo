type SortDir = 'asc' | 'desc'

export function SortHeader<K extends string>({
  label,
  column,
  activeKey,
  dir,
  onSort,
  as = 'th',
}: {
  label: string
  column: K
  activeKey: K
  dir: SortDir
  onSort: (key: K, nextDir: SortDir) => void
  as?: 'th' | 'div'
}) {
  const active = activeKey === column
  const Tag = as
  return (
    <Tag className={as === 'th' ? 'sortable-th' : 'sortable-chip'}>
      <div className="sort-header">
        <span>{label}</span>
        <span className="sort-arrows" aria-label={`${label}排序`}>
          <button
            type="button"
            className={`sort-arrow${active && dir === 'asc' ? ' active' : ''}`}
            aria-pressed={active && dir === 'asc'}
            title="由低至高"
            onClick={() => onSort(column, 'asc')}
          >
            ▲
          </button>
          <button
            type="button"
            className={`sort-arrow${active && dir === 'desc' ? ' active' : ''}`}
            aria-pressed={active && dir === 'desc'}
            title="由高至低"
            onClick={() => onSort(column, 'desc')}
          >
            ▼
          </button>
        </span>
      </div>
    </Tag>
  )
}
