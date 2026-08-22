# Supabase 設定（2025/26 成績）

## 1. 環境變數

複製 `.env.example` 為 `.env.local`（已 gitignore）：

```bash
VITE_SUPABASE_URL=https://heriailewjegnisaqiir.supabase.co
VITE_SUPABASE_ANON_KEY=你的_anon_key
# 選填：有 service_role 就可用 API 匯入，不必貼大 SQL
# SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

Dashboard 位置：Project Settings → API

## 2. 建表（必做一次）

1. 開啟 [SQL Editor](https://supabase.com/dashboard/project/heriailewjegnisaqiir/sql)
2. 貼上並執行 [`supabase/migrations/20260822010000_campus_scores.sql`](supabase/migrations/20260822010000_campus_scores.sql)

## 3. 匯入入分檔

**2025/26 上學期**（`Downloads/01. 上學期/`）每級一個 Excel：

| 年級 | 檔案 |
|------|------|
| G7 | `G7中文科上學期入分檔_20250709.xlsx` |
| G8 | `G8中文科上學期入分檔_20250918.xlsx` |
| G9 | `G9中文科上學期入分檔_20250709.xlsx` |
| G10 | `G10中文科上學期入分檔_20250913.xlsx` |
| G11 | `G11中文科上學期入分檔_20250914.xlsx` |
| G12 | `G12中文科上學期入分檔_20250913.xlsx` |

每檔結構相同：`NameList`（學號、行政班 `Class`、中文組別 `Group` 如 `8D-LL`／`8R-YCN`）、`OverallScore`（學期總分與分項）。G7–G9 的 R 班學生行政班仍為 A／L，`Group` 為 `7R-…`／`8R-…`／`9R-…`。

**2025/26 下學期**（`Downloads/02. 下學期/01. 各級入分檔/`）— 檔名日期在 2026 年 1 月，仍屬 **2025/26** 學年，寫入 `academic_year_start = 2025`、`semester = second`：

| 年級 | 檔案 |
|------|------|
| G7 | `G7中文科下學期入分檔_20260108.xlsx` |
| G8 | `G8中文科下學期入分檔_20260108.xlsx` |
| G9 | `G9中文科下學期入分檔_20260108.xlsx` |
| G10 | `G10中文科下學期入分檔_20260108.xlsx` |
| G11 | `G11中文科下學期入分檔_20260108.xlsx` |

（G12 下學期待補。）

**勿混入 2026/27**：2627 教師時間表、2627 白名單與日曆為下一學年；入分檔匯入腳本只接受 `academic_year_start = 2025`，並略過檔名含 `2627` 的 Excel。

**分數頁**：`/class` 學年選擇器會依 `academic_year_start` 重新向 Supabase 載入成績，並套用該學年白名單（2526／2627）顯示任教老師。

本機從上述資料夾產生 seed：

```bash
npm run import:scores:sql
# → scripts/out/seed-chinese-scores.sql（約 1.5MB，勿 commit）
```

在 SQL Editor 執行該檔前，請先跑 [`20260822170000_remedial_r_classes.sql`](supabase/migrations/20260822170000_remedial_r_classes.sql)（或讓 import 產生的 classes 區段含 7R／8R／9R）。若 Editor 嫌太大，改在 `.env.local` 加上 `SUPABASE_SERVICE_ROLE_KEY` 後：

```bash
npm run import:scores
```

涵蓋：G7–G12 上學期 + G7–G11 下學期。

## 3b. 全校學生大表（官方名冊）

來源：`Student Name List 2025-26_*.xlsx` 的 **ALL** sheet（約 1384 人）。

```bash
npm run import:roster:sql
```

1. 先執行 [`supabase/migrations/20260822013000_student_roster_fields.sql`](supabase/migrations/20260822013000_student_roster_fields.sql)（加 house／french 欄位）
2. 再依序執行 `scripts/out/roster-parts/00-classes.sql`、`01-students.sql` …

中文科成績仍留在 `semester_records`；大表會補齊沒有入分檔的學生。

## 4. 前端

```bash
npm run dev
```

登入仍用示範帳號（`admin` / `campus` 等）。有 Supabase 資料時，班級／個人／閱讀頁會改讀資料庫名冊與成績。
