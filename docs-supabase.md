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

本機已從 Downloads 上下學期 Excel 產生 seed：

```bash
npm run import:scores:sql
# → scripts/out/seed-chinese-scores.sql（約 1.5MB，勿 commit）
```

在 SQL Editor 執行該檔。若 Editor 嫌太大，改在 `.env.local` 加上 `SUPABASE_SERVICE_ROLE_KEY` 後：

```bash
npm run import:scores
```

涵蓋：G7–G12 上學期 + G7–G11 下學期（G7 全年齊全）。

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
