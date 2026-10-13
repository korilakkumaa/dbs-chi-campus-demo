/**
 * 中文科入分檔 → Portal「欠交橫表」
 *
 * 貼上方式：
 * 1. 開啟入分檔 Google Sheet
 * 2. 擴充功能 → Apps Script，刪除預設程式，整份貼上，儲存
 * 3. 重新整理試算表。選單「欠交通知」→「產生欠交橫表」
 * 4. 檔案 → 共用 → 發佈到網路：
 *    連結 → 工作表選「欠交橫表」→ CSV
 * 5. 把該 CSV 網址設成 portal 的 HOMEWORK_ABS_SHEET_CSV_URL
 *
 * 來源：各組分頁（例如 12D-TWL）。第 1 列是習作名稱，第 2 列是滿分，
 * 第 3 列起是學生。分數格整格為 abs / late / 欠 / 欠交 / 缺席 / 遲交
 * 才會抽出。
 *
 * 略過：總分、PG、等第、Remarks、學習態度、分項評分（內容／行文／組織等），
 * 以及試卷欄（統測、模卷、卷一、卷二、DSE）。要連試卷缺席也抽出，
 * 把 INCLUDE_EXAMS 改成 true。
 *
 * 輸出欄位對應 portal 同步：
 * 學生班別, 學生組別, 任教老師INITIAL, 習作名稱, ABS, 學生編號, 學號, 姓名
 * ABS 欄只會是 abs 或 late。
 */

var INCLUDE_EXAMS = false
var OUTPUT_SHEET_NAME = '欠交橫表'
var OUTPUT_HEADERS = [
  '學生班別',
  '學生組別',
  '任教老師INITIAL',
  '習作名稱',
  'ABS',
  '學生編號',
  '學號',
  '姓名',
]

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('欠交通知')
    .addItem('產生欠交橫表', 'buildHomeworkAbsSheet')
    .addToUi()
}

function buildHomeworkAbsSheet() {
  var ss = SpreadsheetApp.getActive()
  var collected = collectHomeworkAbsRows_(ss)
  var sheet = ss.getSheetByName(OUTPUT_SHEET_NAME)
  if (!sheet) sheet = ss.insertSheet(OUTPUT_SHEET_NAME)

  var filter = sheet.getFilter()
  if (filter) filter.remove()
  sheet.clear()

  var values = [OUTPUT_HEADERS].concat(collected.rows)
  sheet.getRange(1, 1, values.length, OUTPUT_HEADERS.length).setValues(values)
  sheet.getRange(1, 1, 1, OUTPUT_HEADERS.length).setFontWeight('bold')
  sheet.setFrozenRows(1)
  if (collected.rows.length > 0) {
    sheet.getRange(2, 6, collected.rows.length, 1).setNumberFormat('@')
    sheet.getRange(1, 1, collected.rows.length + 1, OUTPUT_HEADERS.length).createFilter()
  }
  sheet.autoResizeColumns(1, OUTPUT_HEADERS.length)
  ss.setActiveSheet(sheet)

  SpreadsheetApp.getUi().alert(
    '已寫入「' +
      OUTPUT_SHEET_NAME +
      '」' +
      collected.rows.length +
      ' 列（缺席 ' +
      collected.absCount +
      '、遲交 ' +
      collected.lateCount +
      '）。\n\n' +
      '請把此工作表發佈為 CSV，再交給 Portal 同步。' +
      (INCLUDE_EXAMS ? '' : '\n試卷欄（統測、模卷、DSE）沒有抽出。'),
  )
}

function collectHomeworkAbsRows_(ss) {
  var rows = []
  var seen = {}
  var absCount = 0
  var lateCount = 0
  var sheets = ss.getSheets()

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i]
    if (!isGroupScoreSheet_(sheet)) continue

    var display = sheet.getDataRange().getDisplayValues()
    if (display.length < 3) continue

    var headers = display[0]
    var teacher = teacherInitial_(sheet)
    var sheetGroup = cleanText_(display[0][0])
    var lastCol = headers.length

    for (var r = 2; r < display.length; r++) {
      var line = display[r]
      var studentNo = cleanStudentNo_(line[4])
      var studentName = cleanText_(line[3])
      if (!studentNo && !studentName) continue

      var classLabel = normalizeClassLabel_(line[0])
      var classNumber = cleanClassNumber_(line[1])
      var groupLabel = cleanText_(line[2])
      if (!groupLabel) groupLabel = sheetGroup

      for (var c = 7; c < lastCol; c++) {
        var marker = followUpMarker_(line[c])
        if (!marker) continue

        var assignment = assignmentName_(headers[c])
        if (!assignment || skipAssignment_(assignment)) continue

        var key = [studentNo || classLabel + '#' + classNumber, groupLabel, assignment, marker].join('|')
        if (seen[key]) continue
        seen[key] = true

        if (marker === 'late') lateCount++
        else absCount++

        rows.push([
          classLabel,
          groupLabel,
          teacher,
          assignment,
          marker,
          studentNo,
          classNumber,
          studentName,
        ])
      }
    }
  }

  rows.sort(function (a, b) {
    var g = String(a[1]).localeCompare(String(b[1]), 'zh-Hant')
    if (g !== 0) return g
    var n = Number(a[6] || 0) - Number(b[6] || 0)
    if (n !== 0) return n
    return String(a[3]).localeCompare(String(b[3]), 'zh-Hant')
  })

  return { rows: rows, absCount: absCount, lateCount: lateCount }
}

/** 組別分頁名稱如 12D-TWL、8EC-LWW，且第 2 列是學生身份欄。 */
function isGroupScoreSheet_(sheet) {
  var name = String(sheet.getName() || '').trim()
  if (name === OUTPUT_SHEET_NAME) return false
  if (!/^G?\d+[A-Za-z]+-[A-Za-z]{2,}$/.test(name)) return false
  if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 5) return false

  var meta = sheet.getRange(2, 1, 1, 5).getDisplayValues()[0]
  var keys = meta.map(function (cell) {
    return cleanText_(cell).toLowerCase()
  })
  return (
    keys[0] === 'class' &&
    keys[1].indexOf('class no') === 0 &&
    keys[2] === 'group' &&
    keys[4].indexOf('student') === 0
  )
}

function teacherInitial_(sheet) {
  var fromName = String(sheet.getName() || '').match(/-([A-Za-z]{2,})$/)
  if (fromName) return fromName[1].toUpperCase()

  var email = cleanText_(sheet.getRange(1, 3).getDisplayValue())
  var fromEmail = email.match(/dbs([A-Za-z]{2,})@/i)
  if (fromEmail) return fromEmail[1].toUpperCase()
  return ''
}

function followUpMarker_(raw) {
  var s = cleanText_(raw).toLowerCase().replace(/\s+/g, '')
  if (s === 'abs' || s === '欠' || s === '欠交' || s === '缺席') return 'abs'
  if (s === 'late' || s === '遲' || s === '遲交') return 'late'
  return ''
}

function assignmentName_(raw) {
  return cleanText_(String(raw || '').replace(/[\n\r]+/g, ' '))
}

function skipAssignment_(name) {
  var compact = name.replace(/\s+/g, '')
  if (!compact) return true
  if (/remarks|備註|等第|attitude|adminnote|totalscore|readingscore|writingscore|classassignment/i.test(compact)) {
    return true
  }
  if (compact.indexOf('學習態度') !== -1) return true
  if (compact.indexOf('總分') !== -1) return true
  if (/pg$/i.test(compact)) return true
  if (/^(內容訊息|內容發展|行文|組織|扣分|內容|表達|結構|字標|加分)$/.test(compact)) return true
  if (/^實[（(].*[）)].*(內容|行文|組織|扣分)/.test(compact)) return true
  if (/^(統測甲部%|統測乙部%|實用\+作文%|實用＋作文%|ca分%|卷一%|卷二%|exam%|ca\+exam%|ca&exam%)/i.test(compact)) {
    return true
  }
  if (!INCLUDE_EXAMS && isExamAssignment_(compact)) return true
  return false
}

function isExamAssignment_(compact) {
  return /統測|模卷|dse|試卷|考試|卷一|卷二/i.test(compact)
}

function normalizeClassLabel_(raw) {
  var s = cleanText_(raw)
  var ec = s.match(/^G?\s*(\d+)\s*EC$/i)
  if (ec) return 'G' + ec[1] + ' EC'
  var form = s.match(/^G?(\d+)([A-Za-z])$/)
  if (form) return form[1] + form[2].toUpperCase()
  return s
}

function cleanStudentNo_(raw) {
  var s = cleanText_(raw).replace(/\.0$/, '')
  if (!s) return ''
  if (/e\+/i.test(s)) {
    var n = Number(s)
    if (isFinite(n)) return String(Math.round(n))
  }
  return s.replace(/[^\d]/g, '') || s
}

function cleanClassNumber_(raw) {
  var s = cleanText_(raw)
  if (!s) return ''
  var n = Number(String(s).replace(/[^\d.]/g, ''))
  if (!isFinite(n) || n <= 0) return ''
  return Math.round(n)
}

function cleanText_(raw) {
  return String(raw == null ? '' : raw)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
