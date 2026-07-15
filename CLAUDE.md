# CLAUDE.md — ระบบตรวจงานแม่บ้าน/รปภ (Staff Inspection System)

เอกสารส่งต่อโปรเจกต์ · อ่านไฟล์นี้ก่อนแตะโค้ด
เขียนจากการไล่โค้ดจริง — ถ้าโค้ดกับเอกสารนี้ขัดกัน **ให้เชื่อโค้ดแล้วมาแก้ไฟล์นี้**

---

## 1. ระบบนี้คืออะไร

ระบบมอบหมาย + ตรวจงานแม่บ้าน/รปภ. ผ่าน **LINE เป็นหลัก**
พนักงานสแกน QR ที่จุด → ถ่ายรูปก่อน/หลังทำงาน → ผู้ตรวจตรวจ → ผู้บริหารดูรายงาน
มีระบบแจ้งซ่อม/ของหมด พร้อม workflow เสนอราคา–อนุมัติ–ปิดงาน

**Stack:** Next.js 15.1.6 (App Router) · React 19 · TypeScript · Tailwind · Prisma 6.2.1 + PostgreSQL 16 · Auth.js v5 (`next-auth@5.0.0-beta.25`, JWT) · `@line/liff` · zxing (สแกน QR) · qrcode · zod · bcryptjs
**ภาษา:** UI/คอมเมนต์/ข้อความ **ภาษาไทยทั้งหมด** — เขียนโค้ดใหม่ให้คอมเมนต์ไทยตามสไตล์เดิม
**Deploy:** Docker Compose + Cloudflare Tunnel → https://inspect.urbaniaco.com · `TZ=Asia/Bangkok`

---

## 2. รันโปรเจกต์

```bash
cp .env.example .env          # แก้ค่า โดยเฉพาะ AUTH_SECRET, LINE_*, CLOUDFLARE_TUNNEL_TOKEN
docker compose up --build -d  # db → app (พอร์ต 3000) → adminer → cloudflared
docker compose logs -f app
```

**บัญชีจาก seed** (สร้างใหม่ทุกครั้งที่ container start):
`admin/admin1234` · `inspector/inspect1234` · `maid1/staff1234` · `guard1/staff1234`

**Container:** `c-app-1` `c-db-1` `c-adminer-1` `c-cloudflared-1` · DB เปิดพอร์ต 5432 ออก host

---

## 3. 🔴 กับดัก — อ่านก่อนแตะโค้ด

| # | กับดัก | ผลถ้าไม่รู้ |
|---|---|---|
| 1 | **`Dockerfile` CMD รัน `prisma db push --accept-data-loss` + `seed` ทุกครั้งที่ start** | แก้ schema แล้ว **คอลัมน์ถูก drop อัตโนมัติ** ตอนรีสตาร์ต · **ไม่มีโฟลเดอร์ `prisma/migrations/`** · **ไม่มีระบบ backup** → `pg_dump` เองก่อนแก้ schema เสมอ |
| 2 | **`"รายงาน".includes("งาน") === true`** | ลำดับ trigger ใน [`lineRouting.ts`](src/lib/lineRouting.ts) **ห้ามสลับ** — ต้อง `admin → รายงาน → แจ้งซ่อม/ของหมด → งาน → เมนู` |
| 3 | **`assertAdmin()` คุม 18 action, `assertCanAssign()` คุม 12** ([actions.ts](src/app/admin/actions.ts)) | ยัด role ใหม่เข้า `assertAdmin` = เปิดสิทธิ์ลบผู้ใช้/รีเซ็ตรหัส/ลบสถานที่พร้อมกันทั้งกระดาน |
| 4 | **ทุก export ใน `actions.ts` คือ server action** ที่ client ยิงตรงได้ | ซ่อนปุ่มใน UI **ไม่ใช่ security** — ต้องมี `assert*` ในตัว action เสมอ |
| 5 | **ลบสถานที่ = หายทั้งโซ่** `Site → Checkpoint[] → Assignment/Schedule/Issue → RepairProposal` | guard นับแค่ `WorkRecord` → สถานที่ที่มีใบแจ้งซ่อมค้างแต่ไม่มีคนเช็คอิน **ลบได้เงียบ ๆ** |
| 6 | **cron อยู่ใน process ของแอป** ([instrumentation.ts](src/instrumentation.ts)) | scale หลาย replica = งานรันซ้ำ · รีสตาร์ตคร่อมเวลา = **ข้ามงานเงียบ ๆ ไม่มี catch-up** |
| 7 | **ไม่มี action "ถอนอนุมัติ" ข้อเสนอราคา** | `selectRepairProposal` พลาดแล้วกู้ไม่ได้ → มี optimistic lock กันไว้แล้ว **ห้ามถอดออก** |
| 8 | **สิทธิ์ derive แบบ runtime join**: `me.departmentId === issue.checkpoint.departmentId` | **ย้ายจุดไปฝ่ายอื่น = issue เก่าเปลี่ยนเจ้าของย้อนหลังทันที** |
| 9 | **GPS ถูกถอดออกจาก flow เช็คอินหมดแล้ว** | โค้ด/ฟิลด์/env เกี่ยวกับ GPS เป็น legacy — README เก่ายังบอกว่าต้องใช้ (ผิด) |
| 10 | **`suspicious`/`suspiciousFlags` ไม่มีโค้ดเขียนแล้ว** | หน้า `/admin/suspicious` **ว่างเสมอ** |

---

## 4. หลักการออกแบบ (ทำตามนี้)

### 4.1 `src/lib/permissions.ts` = แหล่งความจริงเดียวเรื่องสิทธิ์
`AppRole` · `ROLE_LABELS` · `homeFor()` · `canAccessAdminPath()` · `navHrefsFor()` · `canAssign()`
middleware / AdminNav / actions / ป้ายชื่อบทบาท **ต้องอ่านจากที่นี่** ห้าม hardcode role string ที่อื่น
⚠️ ห้าม import prisma/bcrypt เข้าไฟล์นี้ — middleware รันบน **Edge runtime**

### 4.2 ชั้นการป้องกัน 3 ชั้น (ต้องมีครบ)
1. **middleware** — กันเข้าหน้า (`canAccessAdminPath`)
2. **`assert*()` ใน server action / API route** — ด่านจริง ห้ามข้าม
3. **ซ่อนปุ่มใน UI** — แค่ UX ไม่ใช่ security (แต่ต้องทำ ไม่งั้นกดแล้ว throw = หน้าขาว)

### 4.3 LINE = fail-soft 100%
`pushMessage`/`replyMessage` คืน `false` เงียบ ๆ ถ้าไม่ตั้ง token · caller ห่อ try/catch ทุกที่
→ **LINE ล่มต้องไม่ทำให้เช็คอิน/อนุมัติ/ปิดงานพัง** · แลกด้วย: ไม่มี retry ไม่มีคิว ไม่รู้ว่าส่งไม่ถึง

### 4.4 การเลือกใช้ Server Action vs API Route
- **Server Action** ([`admin/actions.ts`](src/app/admin/actions.ts)) — งานฝั่งแอดมิน/ฟอร์มในเว็บ
- **API Route** — ต้องรับ `FormData` + ไฟล์จาก client component, ถูกเรียกจากภายนอก (LINE webhook), หรือต้องคุม status code (409/401)

### 4.5 แจ้งเตือนงานซ่อม/ของหมด routing ตาม **ฝ่ายของจุด** ไม่ใช่ของ issue
`Issue` **ไม่มีฟิลด์ `departmentId`** — ดูจาก `checkpoint.departmentId` เสมอ
`notifyNewIssue` fallback → ADMIN + INSPECTOR ถ้าฝ่ายไม่มีใครผูก LINE

---

## 5. บทบาท (5 บทบาท)

| Role | หน้าแรก | เข้าได้ |
|---|---|---|
| `STAFF` (+`staffType`: `HOUSEKEEPER`/`SECURITY`) | `/staff` | `/staff/*`, `/issues` (เฉพาะที่ตัวเองแจ้ง) |
| `INSPECTOR` | `/inspector` | `/inspector/*` — **ตรวจงานไหนก็ได้ ไม่มีการระบุผู้ตรวจล่วงหน้า** |
| `SUPERVISOR` (ผู้สั่งงาน) | `/admin/assignments` | `/admin/sites`, `/admin/checkpoints`, `/admin/assignments` — **สร้าง/แก้ได้ ลบสถานที่/จุดไม่ได้** (ลบงานที่มอบหมายได้) |
| `EXECUTIVE` (ผู้บริหาร) | `/admin/executive` | `/admin/executive`, `/admin/repairs`, `/issues` — **คนเดียวที่เลือกข้อเสนอราคาได้** |
| `ADMIN` | `/admin` | ทุกหน้า ทุก action |

---

## 6. Workflow หลัก

### 6.1 เช็คอิน → ส่งงาน → ตรวจ (หัวใจของระบบ)

```
[พนักงาน] /staff → กด "เริ่มงาน (เช็คอิน)"
   ↓ CheckinForm: สแกน QR → รูปยืนยันที่จุด → รูปก่อนทำงาน
   ↓ POST /api/checkin/session → ได้ nonce (ใช้ครั้งเดียว TTL 5 นาที)
   ↓ POST /api/checkin (FormData)
        auth → validate → หา checkpoint (active)
        → consumeSession(nonce, userId, checkpointId, "CHECKIN")
        → token === checkpoint.qrToken ?           ← ยืนยัน "อยู่ที่จุดจริง"
        → กันเช็คอินซ้ำวันเดียวกัน → 409 {error, id} (client เด้งไปงานเดิม ไม่ error)
        → หา expectedStartTime + reviewPolicy (assignment ก่อน → fallback schedule)
        → คำนวณสาย (ดู 6.2)
        → saveUpload ×2 → create WorkRecord (IN_PROGRESS, verifiedByQr)
   ↓ POST /api/submit (รูปหลัง + หมายเหตุ) → SUBMITTED

[ผู้ตรวจ] /inspector (คิวรอตรวจ) → /inspector/[id]
   ├─ POST /api/review          — ตรวจระยะไกล (บล็อกถ้า reviewPolicy=ON_SITE)
   ├─ POST /api/review/onsite   — ตรวจที่จุด (ต้อง nonce+QR+รูป · บล็อกถ้า reviewPolicy=REMOTE)
   └─ POST /api/review/return   — ตีกลับ → RETURNED (ไม่สร้าง Review, พนักงานส่งใหม่ได้)
   ↓ FAIL → notifyRejected() ทันที
   ↓ ตรวจครบทุกงานของวัน → maybeNotifyReviewSummary() (กันซ้ำด้วย resultNotifiedAt)
```

**สถานะงาน:** `IN_PROGRESS → SUBMITTED → APPROVED|REJECTED` · `RETURNED` (ส่งใหม่ได้) · `MISSED` (ตัดรอบเที่ยงคืน) · `NOT_REVIEWED` (ตัดรอบ 17:00 — ยังตรวจย้อนหลังได้)

### 6.2 กติกานับสาย (สำคัญ — เคยแก้เพราะของเดิมผิด)
```
lateBaseAt  = ค่าที่ช้ากว่า ระหว่าง [เวลาเริ่มที่กำหนด] กับ [submittedAt ของงานก่อนหน้าที่เสร็จวันนี้]
lateMinutes = max(0, เวลาเช็คอิน − lateBaseAt)
ไม่กำหนดเวลาเริ่ม → ทั้งคู่ = null (ไม่วัดสาย)
```
**เหตุผล:** คนเดียวทำ 3 จุดพร้อมกันไม่ได้ — ถ้านับจากเวลาเริ่มอย่างเดียว จุด 2/3 จะสายอัตโนมัติ
ผ่อนผัน `LATE_GRACE_MINUTES = 5` ([date.ts](src/lib/date.ts))

### 6.3 แจ้งซ่อม (REPAIR) — 4 ขั้น มีเงิน มีผู้บริหาร
| ขั้น | ใครทำ | → สถานะ | LINE เด้งหาใคร |
|---|---|---|---|
| แจ้ง (**บังคับรูป**) | ใครก็ได้ (เว็บ/LINE) | `OPEN` | ฝ่ายของจุด → fallback ADMIN+INSPECTOR |
| เสนอราคา | ฝ่าย / ADMIN | `PROPOSED` | ADMIN + EXECUTIVE |
| **เลือกข้อเสนอ** | **EXECUTIVE เท่านั้น** | `APPROVED` | ฝ่ายของจุด ⚠️ **ไม่มี fallback** |
| ปิดงาน + รูป | ฝ่าย / ADMIN | `RESOLVED` | ADMIN + EXECUTIVE (ผู้แจ้งไม่ได้รับ) |

### 6.4 ของหมด (SUPPLY) — 3 ขั้น ไม่มีเงิน
| ขั้น | ใครทำ | → สถานะ | LINE เด้งหาใคร |
|---|---|---|---|
| แจ้ง (รูปไม่บังคับ) | ใครก็ได้ | `OPEN` | ฝ่ายของจุด → fallback |
| รับเรื่อง | ฝ่าย / ADMIN | `IN_PROGRESS` | **ไม่ส่งหาใครเลย** |
| เติมของ + รูป | ฝ่าย / ADMIN | `RESOLVED` | **ผู้แจ้ง** + ADMIN |

> ทางลัด: dropdown ที่ `/admin/issues` (`updateIssueStatus`) ให้ ADMIN ตั้ง `OPEN/IN_PROGRESS/RESOLVED` ตรง ๆ **ข้ามทุกขั้น ไม่ต้องมีรูป ไม่แจ้งใคร** · ตั้ง REPAIR เป็น `IN_PROGRESS` แล้ว **งานตัน** (ไม่มีปุ่มไหนโผล่)

### 6.5 Cron ([instrumentation.ts](src/instrumentation.ts) + [jobs.ts](src/lib/jobs.ts))
| เวลา | งาน | สั่งมือได้ที่ (ADMIN) |
|---|---|---|
| 00:00 | `runMidnightCutoff()` — งานเมื่อวานที่ไม่ส่ง → `MISSED` (สร้าง record ใหม่ถ้าไม่เคยเช็คอิน) | `POST /api/admin/jobs/midnight` `{date?}` |
| 16:30 | `sendInspectorDailyList()` — ส่งรายการตรวจให้ INSPECTOR ทุกคน | `POST /api/admin/jobs/inspector-list` |
| 17:00 | `runReviewCutoff()` — `SUBMITTED` → `NOT_REVIEWED` | `POST /api/admin/jobs/review-cutoff` |
| 08:00 (วันที่ 1) | `sendExecutiveSummary()` — สรุปเดือนก่อนเข้า LINE (ADMIN+EXECUTIVE) | `POST /api/admin/jobs/exec-summary` `{from,to,label?}` |
| ทุกนาที | `sendDueReminders()` — เตือนถึงเวลาเริ่มงาน | `POST /api/admin/jobs/reminders` `{time?}` |

---

## 7. API ทั้งหมด

| Method + Path | ใครเรียกได้ | Request | ทำอะไร |
|---|---|---|---|
| `GET/POST /api/auth/[...nextauth]` | สาธารณะ | — | Auth.js handlers |
| `POST /api/checkin/session` | ล็อกอิน | `{checkpointId}` | ออก nonce (TTL 5 นาที, ใช้ครั้งเดียว) |
| `POST /api/checkin` | ล็อกอิน | **FormData** `checkpointId, nonce, token, verifyPhoto, before` | เช็คอิน → `{id}` · **409 `{error,id}`** ถ้าซ้ำวันเดียวกัน |
| `POST /api/submit` | เจ้าของงาน | FormData `workRecordId, after, note?` | ส่งงาน → `SUBMITTED` |
| `POST /api/review` | INSPECTOR/ADMIN | JSON `{workRecordId, result, comment?}` | ตรวจระยะไกล |
| `POST /api/review/session` | INSPECTOR/ADMIN | `{workRecordId}` | ออก nonce purpose=`REVIEW` |
| `POST /api/review/onsite` | INSPECTOR/ADMIN | FormData + **รูปบังคับ** | ตรวจที่จุด (ต้อง nonce+QR) |
| `POST /api/review/return` | INSPECTOR/ADMIN | JSON `{workRecordId, reason}` | ตีกลับ → `RETURNED` |
| `POST /api/issues` | ล็อกอิน | FormData `type, checkpointId, detail, photo?` | แจ้งปัญหา (REPAIR บังคับรูป) |
| `POST /api/issues/public` | **สาธารณะ** | FormData `idToken, type, checkpointId, detail, photo?` | แจ้งผ่าน LINE ไม่ต้องล็อกอิน (ยืนยันด้วย idToken) |
| `POST /api/issues/[id]/complete` | ฝ่ายของจุด / ADMIN | FormData `photo` (บังคับ) | ปิดงาน → `RESOLVED` |
| `GET /api/files/[...path]` | **ต้องล็อกอิน** | — | เสิร์ฟไฟล์อัปโหลด (กัน path traversal) |
| `GET /api/cp-photo/[id]` | **สาธารณะ** | — | รูปแรกของจุด — **ให้ LINE ดึงไปแสดงใน Flex** (ใช้ `id` ไม่ใช่ `qrToken`) |
| `POST /api/line/webhook` | LINE | raw body + `x-line-signature` | บอทตอบ (ดู §8) |
| `POST /api/line/bind` | สาธารณะ | `{idToken, name, nationalId}` | ผูก LINE ด้วยชื่อ+เลขบัตร (แม่บ้าน/รปภ) |
| `POST /api/line/bind-password` | สาธารณะ | `{idToken, username, password}` | ผูก LINE ด้วยชื่อ+รหัส (ผู้ตรวจ/ผู้สั่งงาน/ผู้บริหาร/แอดมิน) |
| `POST /api/admin/jobs/*` | **ADMIN** | ดู §6.5 | สั่ง cron มือ |

**Public paths ใน middleware:** `/api/auth/*` · `/api/line/*` · `/api/issues/public` · `/api/cp-photo/*` · `/` · `/login` · `/line` (+ `/line?to=report` ผ่านแม้ล็อกอินแล้ว)

---

## 8. LINE Integration

### API ภายนอกที่ต่อ
| ปลายทาง | ใช้ทำอะไร | ไฟล์ |
|---|---|---|
| `POST https://api.line.me/oauth2/v2.1/verify` | ตรวจ idToken จาก LIFF (`client_id = LINE_LOGIN_CHANNEL_ID`) → `{lineUserId, name, picture}` | [line.ts](src/lib/line.ts) |
| `POST https://api.line.me/v2/bot/message/push` | ส่งแจ้งเตือน (Bearer `LINE_MESSAGING_TOKEN`) | [lineMessaging.ts](src/lib/lineMessaging.ts) |
| `POST https://api.line.me/v2/bot/message/reply` | ตอบ webhook | [lineMessaging.ts](src/lib/lineMessaging.ts) |

### Webhook — ตรวจลายเซ็น
```ts
const expected = crypto.createHmac("sha256", CHANNEL_SECRET).update(rawBody).digest("base64");
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```
**ต้องใช้ `await req.text()` ห้าม `req.json()`** (ต้องได้ raw body) · ไม่ตั้ง secret → ตอบ 200 เฉย ๆ · ลายเซ็นผิด → 401

### Trigger (ลำดับห้ามสลับ — [lineRouting.ts](src/lib/lineRouting.ts))
`follow` → ต้อนรับ · `admin` → ล็อกอินแอดมิน · `รายงาน` → รายงานผู้บริหาร · `แจ้งซ่อม`/`ของหมด` → เมนูแจ้ง · `งาน` → เมนูงาน · `เมนู/menu/เริ่ม/start/สวัสดี/hello/hi` → ต้อนรับ · **ไม่ตรง = เงียบ ไม่ตอบ**

### LIFF
`liff.init()` ถูกเรียกใน **3 component เท่านั้น**: `LineLogin` · `LinePasswordLogin` · `PublicIssueForm`
`LIFF_ID` อ่านฝั่ง server แล้วส่งเป็น prop (**ไม่ใช้ `NEXT_PUBLIC_*`**)
`CheckinForm` ไม่ได้ใช้ LIFF — แค่เช็ค user-agent `/Line\//i` บังคับให้เปิดในแอป LINE
**Flex `image` ต้องเป็น URL สาธารณะ HTTPS** → นี่คือเหตุผลที่มี `/api/cp-photo/[id]` + `PUBLIC_BASE_URL`

---

## 9. โครงไฟล์

```
prisma/schema.prisma          # ⚠️ แก้แล้ว db push จะ drop คอลัมน์ตอน restart
prisma/seed.ts                # รันทุก container start (upsert — ไม่ทับข้อมูลเดิม)
src/middleware.ts             # ด่านที่ 1 — ใช้ canAccessAdminPath()
src/instrumentation.ts        # cron (setTimeout/setInterval ใน process)
src/auth.ts / auth.config.ts  # 2 providers: credentials + line (idToken)
src/lib/
  permissions.ts   ⭐ สิทธิ์ทั้งหมด (Edge-safe ห้าม import prisma)
  lineRouting.ts   ⭐ classifyMessage — ลำดับ trigger มีกับดัก
  lineMessaging.ts    push/reply + Flex builder 18 ตัว
  line.ts             verifyLineIdToken
  jobs.ts             งานตามเวลา 5 ตัว
  verify.ts           nonce ใช้ครั้งเดียว (CHECKIN|REVIEW)
  storage.ts          saveUpload/readUpload (กัน path traversal)
  report.ts           getExecutiveReport
  repairReport.ts     getRepairReport
  issueNotify.ts / reviewNotify.ts
  date.ts             fmtDate/lateInfo/daysSince/fmtDaySpan · LATE_GRACE_MINUTES
  db.ts / session.ts / checkpoint.ts
  geo.ts           ❌ legacy (GPS ถอดออกแล้ว)
src/app/admin/actions.ts  ⭐ 35 server actions — ทุกตัวต้องมี assert*()
src/components/           60 ไฟล์
```

---

## 10. ฐานข้อมูล

**Models:** `User` `Site` `Department` `Checkpoint` `Schedule` `Assignment` `WorkRecord` `Review` `CheckInSession` `Issue` `RepairProposal`

**Enums:**
- `Role`: STAFF, INSPECTOR, ADMIN, EXECUTIVE, SUPERVISOR
- `WorkStatus`: IN_PROGRESS, SUBMITTED, APPROVED, REJECTED, MISSED, NOT_REVIEWED, RETURNED
- `IssueType`: REPAIR, SUPPLY · `IssueStatus`: OPEN, PROPOSED, APPROVED, IN_PROGRESS, RESOLVED
- `StaffType`: HOUSEKEEPER, SECURITY · `ReviewResult`: PASS, FAIL
- `ReviewMode`: REMOTE, ON_SITE · `ReviewPolicy`: REMOTE, ON_SITE, BOTH

**ต้องรู้:**
- `Checkpoint.qrToken` @unique = ความลับเช็คอิน **ห้ามเปิดเผยใน URL สาธารณะ**
- `Review.inspectorId` = **คนที่กดตรวจจริง** (คนละเรื่องกับการมอบหมาย — ไม่มีการระบุผู้ตรวจล่วงหน้าแล้ว)
- `Issue.reportedById` เป็น nullable — ผู้แจ้งผ่าน LINE ที่ไม่ผูกบัญชีจะเก็บ `reporterName`/`reporterLineId` แทน
- `CheckInSession` ไม่มี FK จริง (เก็บ `userId`/`checkpointId` เป็น String ลอย)
- `Checkpoint.department` = **SetNull** · `Checkpoint.site` = **Cascade**

---

## 11. วิธีทดสอบ (แพตเทิร์นที่ใช้ได้จริง)

```bash
npx prisma generate && npx tsc --noEmit     # ด่านหลัก — จับ role/field ที่ตกหล่นได้ครบ
docker compose up --build -d app

# ล็อกอินผ่าน API (ใช้ทดสอบหน้าเว็บด้วย curl)
CSRF=$(curl -s -c cj.txt localhost:3000/api/auth/csrf | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
curl -s -b cj.txt -c cj.txt -o /dev/null -X POST localhost:3000/api/auth/callback/credentials \
  -d "csrfToken=$CSRF&username=admin&password=admin1234&callbackUrl=%2F"
curl -s -b cj.txt localhost:3000/admin/executive
```

| ข้อควรระวังตอนทดสอบ | วิธี |
|---|---|
| สคริปต์ `tsx` ที่ใช้ `@/` alias | **ต้องรันจาก `D:\C`** ไม่งั้น resolve ไม่เจอ |
| ต่อ DB จาก host | `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inspection` (ไม่ใช่ `@db:`) |
| **grep นับ text ใน HTML ได้ 2 เท่า** | RSC flight payload ซ้ำข้อความ — **หารสอง** |
| grep หา `"7 วัน"` ไม่เจอ | React แทรก `<!-- -->` ระหว่าง static text กับ `{expr}` → จริงคือ `7<!-- --> วัน` |
| ทดสอบ webhook (HMAC) | Git Bash ส่ง byte ภาษาไทยให้ openssl กับ curl ไม่ตรงกัน → **เขียน body ลงไฟล์** แล้วใช้ `openssl -in file` + `curl --data-binary @file` |
| ตรรกะที่ทดสอบยาก (สิทธิ์/routing) | แยกเป็น **pure function** แล้วยิง tsx unit test — ดีกว่าคลิกดู (เช่น `permissions.ts`, `lineRouting.ts`) |

**⚠️ ห้ามสร้างบัญชีสิทธิ์สูงพร้อมรหัสตายตัวเพื่อทดสอบ** — ระบบนี้เปิดออกอินเทอร์เน็ตจริง ใช้บัญชี seed ที่มีอยู่ หรือให้เจ้าของระบบสร้างให้

---

## 12. หนี้ทางเทคนิค / สิ่งที่ยังไม่มี

### 🔴 ควรทำก่อนขยายระบบ
1. **backup + เลิก `--accept-data-loss`** → `pg_dump` อัตโนมัติ + ย้ายไป `prisma migrate deploy` (มี script `migrate:deploy` ใน package.json แล้วแต่ยังไม่ใช้)
2. **ปิดบัญชีไม่มีผลทันที** — เช็ค `active` แค่ตอนล็อกอิน + JWT อยู่ได้ 30 วัน
3. **ไม่มี rate limit** — login / bind / bind-password / issues/public ยิงซ้ำได้ไม่จำกัด
4. **cron ไม่ทนรีสตาร์ต** — ไม่มี catch-up, ไม่กัน dup ถ้าหลาย instance

### 🟠 ควรมี
5. **IDOR (read-side)** — `/api/files/[...path]`, `/inspector/[id]`, `/issues/[id]` เปิดให้ทุกคนที่ล็อกอินอ่านได้ ไม่เช็คเจ้าของ
6. **ไม่จำกัดขนาดอัปโหลด + ไม่ลบไฟล์กำพร้า** → ดิสก์โตไม่หยุด
7. **คนไม่ผูก LINE ไม่ได้รับแจ้งเตือนอะไรเลย** (ทุก query กรอง `lineUserId != null`) และไม่มีกล่องข้อความในระบบทดแทน
8. **ไม่มี monitoring/health check** — พังแล้วไม่รู้
9. **`selectRepairProposal` ไม่มี fallback แจ้งเตือน** — จุดที่ไม่มีฝ่าย อนุมัติแล้วเงียบ ไม่มีใครไปซ่อม
10. **`/admin/issues?status=PROPOSED` กรองไม่ได้** — whitelist ที่ [admin/issues/page.tsx](src/app/admin/issues/page.tsx) รับแค่ `OPEN|IN_PROGRESS|RESOLVED`

### Legacy ที่ยังไม่ลบ
`lib/geo.ts` · `LocationPicker` · `GpsButton` · `Checkpoint.lat/lng/radiusMeters` · `WorkRecord.gps*`/`verifiedByGps`/`checkInLat/Lng` · env `CHECKIN_MAX_ACCURACY_M`/`CHECKIN_MAX_GPS_AGE_SEC`/`CHECKIN_SUSPICIOUS_ACCURACY_M` (**ไม่ถูกใช้ในโค้ดแล้ว**) · `createAssignment`/`createSchedule`/`toggleCheckpointActive` (dead code แต่ยัง export = ยิงได้)

### เอกสารเก่าที่ผิดแล้ว
- **`README.md`** — บอกว่ามี 3 บทบาท (จริง 5), บอกว่าเช็คอินต้อง GPS ในรัศมี (ถอดออกแล้ว), อ้างหน้า `/register` (ไม่มี)
- **`LINE_SETUP.md`** — วิธีตั้ง LINE ยังใช้ได้ แต่ท้ายไฟล์บอกว่าต้องเปิด GPS + ระบุ cron แค่ 2 ตัว (จริง 5)

---

## 13. Environment Variables

| ตัวแปร | จำเป็น | ผลถ้าไม่ตั้ง |
|---|---|---|
| `DATABASE_URL` | ✅ | แอปไม่ขึ้น |
| `AUTH_SECRET` | ✅ | JWT ไม่ปลอดภัย (`openssl rand -base64 32`) |
| `AUTH_TRUST_HOST=true` | ✅ | Auth.js อ่าน host จาก Cloudflare ไม่ได้ |
| `LIFF_ID` | LINE | หน้า `/line` ปิด |
| `LINE_LOGIN_CHANNEL_ID` | LINE | `verifyLineIdToken` คืน null → ผูกบัญชี/แจ้งผ่าน LINE ไม่ได้ |
| `LINE_MESSAGING_TOKEN` | LINE | **ปิดการ push เงียบ ๆ** (ระบบทำงานปกติ) |
| `LINE_CHANNEL_SECRET` | LINE | **ปิด webhook** (ตอบ 200 เฉย ๆ) |
| `PUBLIC_BASE_URL` | LINE | ข้อความแจ้งงานไม่มีรูปจุด |
| `UPLOAD_DIR` | — | ดีฟอลต์ `./uploads` (ใน container = `/app/uploads` volume) |
| `SEED_ADMIN_USERNAME/PASSWORD` | — | ดีฟอลต์ `admin`/`admin1234` |
| `CHECKIN_SESSION_TTL_MIN` | — | ดีฟอลต์ 5 (อายุ nonce) |
| `TZ=Asia/Bangkok` | ✅ | **cron + ขอบวัน/เดือนเพี้ยน** |
| `CLOUDFLARE_TUNNEL_TOKEN` | deploy | tunnel ไม่ขึ้น |
