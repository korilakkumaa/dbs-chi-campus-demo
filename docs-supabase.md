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

來源：`Student Name List 2025-26_*.xlsx` 或 `Student Name List 2026-27_*.xlsx` 的 **ALL** sheet。

```bash
npm run import:roster          # 2025/26
npm run import:roster:2627     # 2026/27
npm run import:roster:2627:sql # 只產 SQL，不寫入 Supabase
```

1. 先執行 [`supabase/migrations/20260822013000_student_roster_fields.sql`](supabase/migrations/20260822013000_student_roster_fields.sql)（加 house／french 欄位）
2. 再依序執行 `scripts/out/roster-parts/00-classes.sql`、`01-students.sql` …

中文科成績仍留在 `semester_records`；大表會補齊沒有入分檔的學生。

**2026/27 中文教學小組**（G7–G9 streaming + 高中小組 Excel）：

```bash
npm run import:streaming:2627
```

依 2627 教師白名單將 `Group Name`（如 `G7D`、`G10A`）轉成 `teaching_group`（如 `7D-FYC`、`10A-YCN`）；**FR（法文班）歸入該年級 EC**（如 `G7 EC-WKL`），顯示在 EC 老師名單。

## 3c. 校曆（admin 改動同步給教師）

1. 在 SQL Editor 執行 [`supabase/migrations/20260824120000_campus_calendar_events.sql`](supabase/migrations/20260824120000_campus_calendar_events.sql)
2. 管理員在「詳細日曆」新增、改標題或刪除的**全校活動**會寫入 `campus_calendar_events`，教師重新整理（或即時推送）後即可看到。
3. 教師自己點課節新增的私人備註會同步至 Supabase（依 `audience.ownerId`），供 iCal 訂閱與 Google 同步使用。

## 3e. 外部日曆訂閱（Google / Apple）與 Google 直接同步

1. 在 SQL Editor 執行 [`supabase/migrations/20260831120000_calendar_time_feed_google.sql`](supabase/migrations/20260831120000_calendar_time_feed_google.sql)（事件時間欄位、訂閱 token、Google 對照表）。
2. 產生 Edge Function 用的校曆 seed（build 時會自動跑；手動：`npm run export:calendar-bundle`）。
3. 部署訂閱 feed：

```bash
npm run export:calendar-bundle
supabase functions deploy calendar-feed
```

4. 詳細日曆頁「同步至外部日曆」：
   - **訂閱連結**：依教師身分過濾個人版校曆（含私人備註），Google／Apple 會定期拉更新。
   - **Google 直接同步**：需以 Google 登入並授權 `calendar.events`；變更後自動推送到 Google 主日曆。

5. **Google 直接同步**還需在 **Google Cloud Console**（不是 Supabase）設定日曆 scope：
   - [Google Auth Platform](https://console.cloud.google.com/auth) → 你的 OAuth client 所在專案
   - **Data Access（資料存取 / Scopes）** → **Add or remove scopes** → 搜尋 `calendar` → 勾選 **Google Calendar API** 下的 `.../auth/calendar.events`（或手動加入該 URL）
   - **API 和服務 → 資料庫** → 啟用 **Google Calendar API**
   - 回到網站詳細日曆，按 **「授權 Google 日曆」**（`prompt=consent` 重新授權；僅「Google 登入」不夠）

6. 訂閱連結含 secret token，請勿公開分享；若外洩可在詳細日曆按「重新產生連結」。

7. 若用 **Google 登入**後無法建立訂閱連結，請再執行 [`20260831123000_calendar_feed_rls_authenticated.sql`](supabase/migrations/20260831123000_calendar_feed_rls_authenticated.sql)（修正 `authenticated` 角色的 RLS）。

## 3d. 欠交習作提醒（首頁右欄）

1. 在 SQL Editor 執行 [`supabase/migrations/20260825120000_homework_abs.sql`](supabase/migrations/20260825120000_homework_abs.sql)
2. 將 Google Sheet「發佈至網頁」為 CSV，或準備本機 CSV，欄位需含：學生班別、學生組別、任教老師 INITIAL、習作名稱、ABS（大小寫皆可）；建議另加學生編號／學號／姓名以便對名冊。
3. 在 `.env.local` 設定 `HOMEWORK_ABS_SHEET_CSV_URL`（或 `HOMEWORK_ABS_SHEET_CSV_PATH`）、`SUPABASE_SERVICE_ROLE_KEY`，以及寄信用的 `RESEND_API_KEY`、`HOMEWORK_ABS_FROM_EMAIL`。
4. 同步（建議每三天跑一次，可用 cron / GitHub Actions）：

```bash
npm run sync:homework-abs
# 同步後順便清佇列：
npm run sync:homework-abs -- --process-mail
```

5. 部署 Edge Function（點「剔」立刻寄信）：

```bash
supabase functions deploy send-homework-abs-email
supabase secrets set RESEND_API_KEY=re_… HOMEWORK_ABS_FROM_EMAIL='Campus CMS <…>'
```

若 Function 尚未部署，剔仍會寫入佇列，之後可用 `npm run process:homework-abs-mail` 補寄。

6. 首頁右欄依**當前教師白名單組別**顯示欠交；交叉＝永久略過；寄出紀錄在 `/progress/abs-mail`。

## 4. 前端

```bash
npm run dev
```


