import { useId, useState } from 'react'
import { GlassPanel } from '../GlassPanel'
import { downloadTextFile } from '../../lib/yearCsv/csv'
import {
  emptyTemplateForKind,
  YEAR_CSV_KIND_LABEL,
  type CsvIssue,
  type YearCsvKind,
} from '../../lib/yearCsv/schemas'

type Props = {
  kind: YearCsvKind
  startYear: number
  /** Current export CSV (optional). */
  exportCsv?: string | null
  exportFilename?: string
  disabled?: boolean
  replaceModeDefault?: boolean
  onParseAndImport: (input: {
    text: string
    replaceMode: boolean
  }) => Promise<{
    ok: boolean
    issues?: CsvIssue[]
    previewRows?: string[][]
    message?: string
    upserted?: number
  }>
}

export function CsvYearImportPanel({
  kind,
  startYear,
  exportCsv,
  exportFilename,
  disabled,
  replaceModeDefault = false,
  onParseAndImport,
}: Props) {
  const inputId = useId()
  const [replaceMode, setReplaceMode] = useState(replaceModeDefault)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<CsvIssue[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const label = YEAR_CSV_KIND_LABEL[kind]

  const downloadTemplate = () => {
    downloadTextFile(
      `${kind}-${startYear}-template.csv`,
      emptyTemplateForKind(kind),
    )
  }

  const downloadExport = () => {
    if (!exportCsv) return
    downloadTextFile(
      exportFilename ?? `${kind}-${startYear}.csv`,
      exportCsv,
    )
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    setMessage(null)
    setIssues([])
    setPreviewRows([])
    const text = await file.text()
    setPendingText(text)
    setBusy(true)
    try {
      const result = await onParseAndImport({ text, replaceMode })
      setIssues(result.issues ?? [])
      setPreviewRows(result.previewRows ?? [])
      if (result.ok) {
        setMessage(result.message ?? `已匯入 ${result.upserted ?? 0} 筆`)
        setPendingText(null)
      } else if (result.message) {
        setMessage(result.message)
      } else if ((result.issues?.length ?? 0) > 0) {
        setMessage('CSV 有錯誤，請修正後再上傳')
      } else {
        setMessage('預覽就緒，請確認後再次上傳以寫入（或檢查錯誤訊息）')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <GlassPanel className="csv-year-import-panel">
      <div className="csv-year-import-head">
        <h3>{label} CSV</h3>
        <p className="deadline-admin-lead">
          下載範本或匯出目前資料，離線填寫後上傳。寫入前會先驗證欄位。
        </p>
      </div>
      <div className="csv-year-import-actions">
        <button type="button" className="btn ghost" onClick={downloadTemplate} disabled={disabled}>
          下載範本
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={downloadExport}
          disabled={disabled || !exportCsv}
        >
          匯出目前資料
        </button>
        <label className="btn primary csv-upload-label" htmlFor={inputId}>
          {busy ? '處理中…' : '上傳 CSV'}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          hidden
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            e.target.value = ''
            void onFile(file)
          }}
        />
        {(kind === 'school_calendar' || kind === 'teacher_whitelist') && (
          <label className="csv-replace-toggle">
            <input
              type="checkbox"
              checked={replaceMode}
              onChange={(e) => setReplaceMode(e.target.checked)}
              disabled={disabled}
            />
            覆蓋寫入（取代該學年現有匯入列）
          </label>
        )}
      </div>
      {pendingText && previewRows.length > 0 && issues.length === 0 && (
        <p className="csv-year-import-hint">
          已解析 {previewRows.length} 列。若尚未寫入成功，請修正後重新上傳。
        </p>
      )}
      {message && <p className="csv-year-import-msg">{message}</p>}
      {issues.length > 0 && (
        <ul className="csv-year-import-issues">
          {issues.slice(0, 12).map((issue) => (
            <li key={`${issue.row}-${issue.message}`}>
              第 {issue.row} 列：{issue.message}
            </li>
          ))}
        </ul>
      )}
      {previewRows.length > 0 && (
        <div className="table-wrap csv-preview-wrap">
          <table>
            <tbody>
              {previewRows.slice(0, 8).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {previewRows.length > 8 && (
            <p className="deadline-admin-lead">…另有 {previewRows.length - 8} 列</p>
          )}
        </div>
      )}
    </GlassPanel>
  )
}
