# Supabase 設定（2025/26 成績）

## 1. 環境變數

**GitHub Pages / `npm run build`：** 倉庫內已有可提交的 [`.env.production`](.env.production)（只含 `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`）。Vite production build 會自動讀取；建置結束後 `verify:pages-supabase` 會確認 `docs/assets` bundle 已內嵌連線設定，否則失敗，避免再推上「未連線」的站。

**本機開發／匯入腳本：** 複製 `.env.example` 為 `.env.local`（已 gitignore）：

```bash
VITE_SUPABASE_URL=https://heriailewjegnisaqiir.supabase.co
VITE_SUPABASE_ANON_KEY=你的_anon_key
# 選填：有 service_role 就可用 API 匯入，不必貼大 SQL
# SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

Dashboard 位置：Project Settings → API。`anon` key 本來就會進瀏覽器；**切勿**把 `SUPABASE_SERVICE_ROLE_KEY` 寫進 `.env.production` 或前端。

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

**分數頁**：`/class` 學年選擇器會依 `academic_year_start` 重新向 Supabase 載入成績，並套用該學年白名單（2526／2627）顯示任教老師。跨年歷史**只依官方 STID** 連結；不依班級座號猜測，避免插班生繼承他人舊分。畫面多為 0–100 換算分，與登分檔加權貢獻對照時請用同一公式驗算。

**級名次分母**：個人頁 Top%／級名次只跟「**同一 `academic_year_start` + 同一顯示年級**」比（例如 2025 G7 ≈／233），不會把 2024 G7 與 2025 G7 混成四百多人。匯入時每列必須帶正確的 `academic_year_start`；前端 `yearHistory` 必須寫入 `firstAcademicYearStart`／`secondAcademicYearStart`。更新成績後請跑下方 verify。

**勿再複製往年分數到新年 `student_no`**：舊的 `sync:prior-scores:2627`（含座位 fallback）已停用；若 DB 仍有 `source_file` 以 `sync2627:` 開頭的列，請清掉：

```bash
npm run cleanup:sync2627-scores          # 需 SUPABASE_SERVICE_ROLE_KEY
npm run cleanup:sync2627-scores:sql      # 只產 SQL → scripts/out/
npm run verify:stid-score-history        # 抽查：插班生無幽靈舊分、延續生仍有歷史
npm run verify:score-rank-cohorts        # 抽查：級名次分母不跨屆混算
```

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

## 3d. 出卷／職責（admin 編輯）

1. 在 SQL Editor 執行 [`supabase/migrations/20260906120000_duty_year_docs.sql`](supabase/migrations/20260906120000_duty_year_docs.sql)
2. **出卷** 的矩陣編輯器在 `/resources/papers`（工具列 **編輯**）。管理員「新學年準備」頁有入口，深連結 `#/resources/papers?year=YYYY&edit=1`。
3. 架構（可維護性）：
   - **單一編輯面**：出卷 UI 只在 `PapersPage` + `PapersEdit`；`AdminPage` 只做狀態摘要與導航，避免複製一整套矩陣編輯器。
   - **資料層**：`dutyStore` 統一 hydrate／bootstrap／save；靜態 seed（`assessmentDuty*.generated.ts`）僅後備；`assessment_duty_years` 為寫入後的來源。
   - **衍生資料**：教師工作量由 `assessmentDutyDerive` 從矩陣 + EC 重算，不另存。
4. 管理員可改派、增刪年級／格子／EC；無資料學年可 **建立空白** 或 **從上學年複製**，**儲存** 後寫入：
   - `assessment_duty_years`（年級矩陣 + EC 附錄）
   - `dept_duty_years`（科組職責；在「職責」頁同樣可建立空白／從上學年複製）
5. 一般教師帳號只讀。若遠端已有該學年列，改種子檔不會影響線上資料——請用編輯器修正。

## 3e. 新學年準備（CSV 範本）

1. 執行 migration [`supabase/migrations/20260909120000_year_setup_docs.sql`](supabase/migrations/20260909120000_year_setup_docs.sql)（`teacher_whitelist_years`、`grade_deadlines_years`，以及名冊／成績的 authenticated 寫入政策）。
2. （建議）部署 Edge Function：`supabase functions deploy admin-year-import`。前端會優先呼叫 Edge；若未部署則回退為已登入管理員的直接 upsert。
3. 管理員開啟 `#/admin`（導覽「新學年準備」）→ 選學年 → 檢查清單 → 各項 **下載範本／匯出目前資料／上傳 CSV**。

| kind | 範本欄位 | 寫入 |
|------|----------|------|
| `teacher_whitelist` | `Initial,Chi. Name,Email Address,Class 1–4` | `teacher_whitelist_years` |
| `student_roster` | `stid,class,class_number,name_zh,name_en,house,french,remarks` | `students`／`classes` |
| `chinese_streaming` | `stid,admin_class,group_name,teacher_initial,french` | `students.teaching_group` |
| `school_calendar` | 對齊校曆 seed CSV（`Date,Event,Category,…`） | `campus_calendar_events` |
| `assessment_duty` | `grade,category,semester,part,note,teacher_initial,weight,section,ec_slot` | `assessment_duty_years` |
| `dept_duty` | `category,title,teacher_initial,role,notes` | `dept_duty_years` |
| `semester_scores` | `stid,semester,daily,reading,writing` | `semester_records`（僅 totals；正式對帳請用 Excel 入分腳本） |
| `grade_deadlines` | `grade,activity_title,activity_due,submitted` | `grade_deadlines_years` |
| `teacher_timetable` | `teacher_initial,weekday,start,end,type,subject,group,room,label` | `teacher_timetable_years`（班級時間表由此衍生） |

班級分派下拉與白名單 CSV **同源**（寫入 `teacher_whitelist_years`）。成績截止日期「提交」會持久化至 `grade_deadlines_years`。

時間表（個人／班級）寫入 `teacher_timetable_years`（migration [`20260911120000_teacher_timetable_years.sql`](supabase/migrations/20260911120000_teacher_timetable_years.sql)）。管理員可在 `#/admin` 匯出／上傳 CSV，或「發布本機種子」；班級時間表由個人週課表衍生，無需另存。遠端已有該學年列時，改本機 `teacherWeekly*.generated.ts` 不會影響線上資料——請用 CSV 或重新發布。

**勿**把 `SUPABASE_SERVICE_ROLE_KEY` 放進 Pages／Vite 前端。
## 3e. 外部日曆訂閱（Google / Apple）與 Google 直接同步

1. 在 SQL Editor 執行 [`supabase/migrations/20260831120000_calendar_time_feed_google.sql`](supabase/migrations/20260831120000_calendar_time_feed_google.sql)（事件時間欄位、訂閱 token、Google 對照表）。
2. 產生 Edge Function 用的校曆 seed（build 時會自動跑；手動：`npm run export:calendar-bundle`）。
3. 部署訂閱 feed：

```bash
npm run export:calendar-bundle
supabase functions deploy calendar-feed --no-verify-jwt
```

部署後請用**不帶** `Authorization` header 的請求確認（模擬 Apple 日曆）：

```bash
curl -i "$SUPABASE_URL/functions/v1/calendar-feed?token=YOUR_TOKEN"
# 應回 200 + text/calendar；若仍是 401 Missing authorization header，
# 到 Dashboard → Edge Functions → calendar-feed 關閉「Verify JWT」，或：
# supabase functions deploy calendar-feed --no-verify-jwt
```

4. 詳細日曆頁「同步至外部日曆」：
   - **Apple 日曆**：訂閱 webcal 連結（依教師身分過濾個人版校曆，**僅含該教師自己的私人備註** + 應見之共享校曆）；Apple 約每 3 小時拉更新。
   - **Google 日曆**：Google 登入並授權後自動直接同步；開著詳細日曆頁時約 1–2 秒推送，**關閉網站後由後端每 3 小時同步**。
   - **隱私**：管理員在入口可預覽他人私人備註，但 Google／Apple 外部同步**不會**把其他老師的 `personal` 事件推到非 owner 的外部日曆（即時推送與 cron 相同）。

5. **Google 直接同步**還需在 **Google Cloud Console**（不是 Supabase）設定日曆 scope：
   - [Google Auth Platform](https://console.cloud.google.com/auth) → 你的 OAuth client 所在專案
   - **Data Access（資料存取 / Scopes）** → **Add or remove scopes** → 搜尋 `calendar` → 勾選 **Google Calendar API** 下的 `.../auth/calendar.events`（或手動加入該 URL）
   - **API 和服務 → 資料庫** → 啟用 **Google Calendar API**
   - 回到網站詳細日曆，完成 Google 授權（`prompt=consent` 重新授權；僅「Google 登入」不夠）

6. **後端定時同步（每 3 小時）**：
   - 在 SQL Editor 執行 [`20260901120000_google_calendar_cron_sync.sql`](supabase/migrations/20260901120000_google_calendar_cron_sync.sql)
   - 部署 Edge Function：

```bash
npm run export:calendar-bundle
supabase functions deploy calendar-sync-google --no-verify-jwt
```

   - 在 Supabase → Edge Functions → Secrets 設定：
     - `CALENDAR_SYNC_CRON_SECRET`（自訂長隨機字串，cron 呼叫用）
     - `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`（與 Supabase Google Provider 同一 OAuth client）
   - 在 GitHub repo secrets 加入 `CALENDAR_SYNC_CRON_SECRET`（及既有 `VITE_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`）；[`.github/workflows/sync-google-calendar.yml`](.github/workflows/sync-google-calendar.yml) 會每 3 小時觸發一次。
   - 手動測試：`curl -X POST "$SUPABASE_URL/functions/v1/calendar-sync-google" -H "Authorization: Bearer $CALENDAR_SYNC_CRON_SECRET" -H "apikey: $SERVICE_ROLE_KEY" -d '{}'`
   - 教師首次授權後，refresh token 會寫入 `google_calendar_sync.provider_refresh_token`，供後端使用。

7. 訂閱連結含 secret token，請勿公開分享；若外洩可在詳細日曆按「重新產生連結」。

8. 若用 **Google 登入**後無法建立訂閱連結，請再執行 [`20260831123000_calendar_feed_rls_authenticated.sql`](supabase/migrations/20260831123000_calendar_feed_rls_authenticated.sql)（修正 `authenticated` 角色的 RLS）。

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


