# คู่มือเชื่อมระบบเข้ากับ LINE (OA + LIFF)

ให้พนักงานเปิดแอปจาก **LINE** แล้วล็อกอินด้วย LINE — ยังคงระบบ QR + GPS + ถ่ายรูป (กันโกง) ครบ
ทำตามทีละขั้น แล้วนำ **ค่า 2 ตัว** มาใส่ `.env` คือ `LIFF_ID` และ `LINE_LOGIN_CHANNEL_ID`

> โดเมนของระบบตอนนี้คือ **`https://inspect.urbaniaco.com`**

---

## ภาพรวม (3 อย่างที่ต้องสร้าง)
```
Provider (ของบริษัท)
 ├── Messaging API channel  = ตัว LINE OA  → ทำ Rich Menu (ปุ่มเข้าแอป) + แจ้งเตือน
 └── LINE Login channel
      └── LIFF app  → ได้ LIFF ID  (เว็บเราเปิดในไลน์)
```

---

## ขั้นที่ 1 — สมัคร LINE Official Account (OA)
1. ไปที่ **https://manager.line.biz** → เข้าด้วยบัญชี LINE ของบริษัท
2. **Create / สร้างบัญชีใหม่** → ตั้งชื่อ เช่น "ระบบตรวจงาน Urbania" → เลือกหมวดหมู่
3. พนักงานจะ **แอด OA เป็นเพื่อน** ด้วย QR (ดูที่ Home → ข้อมูลบัญชี)

## ขั้นที่ 2 — เปิด Messaging API ให้ OA
1. LINE Official Account Manager → **Settings (ตั้งค่า)** → **Messaging API**
2. กด **Enable / ใช้ Messaging API** → เลือก/สร้าง **Provider** (ชื่อบริษัท)
3. OA จะปรากฏเป็น **Messaging API channel** ใน LINE Developers

## ขั้นที่ 3 — สร้าง LINE Login channel + LIFF
1. ไปที่ **https://developers.line.biz/console/**
2. เลือก **Provider เดียวกับขั้นที่ 2**
3. **Create a new channel → LINE Login** (App types: เลือก **Web app**)
4. เข้า channel → **Basic settings** → คัดลอก **Channel ID** ➜ `LINE_LOGIN_CHANNEL_ID`
5. แท็บ **LIFF** → **Add**
   - **Endpoint URL**: `https://inspect.urbaniaco.com/line`
   - **Size**: Full
   - **Scopes**: ติ๊ก **profile** + **openid**
   - กด Add → ได้ **LIFF ID** (เช่น `1234567890-abcdEfgh`) ➜ `LIFF_ID`

## ขั้นที่ 4 — ใส่ค่าใน `.env` แล้วรันใหม่
```
LIFF_ID=1234567890-abcdEfgh
LINE_LOGIN_CHANNEL_ID=2000xxxxxx
```
```
docker compose up -d
```

## ขั้นที่ 5 — ตั้ง Rich Menu ใน OA (ปุ่มเข้าแอป)
1. LINE Official Account Manager → **Rich menu** → สร้างใหม่
2. ปุ่ม เช่น "เริ่มงาน / เช็คอิน" → Action = **Link** → URL: `https://liff.line.me/<LIFF_ID>`
3. เปิดใช้งาน

---

## พนักงานใช้งานยังไง
1. แอด OA เป็นเพื่อน (สแกน QR)
2. กดปุ่มใน Rich Menu → ไลน์เปิดแอปเรา (LIFF)
3. ครั้งแรก: กด **อนุญาต (ล็อกอิน LINE)** → ระบบให้ **ผูกบัญชี** โดยกรอก username/password ของระบบครั้งเดียว
4. ครั้งต่อไป: กดแล้วเข้าได้เลย → เห็นงานวันนี้ → สแกน QR + GPS + ถ่ายรูป ตามปกติ

---

## หมายเหตุ
- ต้องมีโดเมน **https** ใช้งานได้ (มี Cloudflare Tunnel แล้ว: `inspect.urbaniaco.com`)
- ถ้าเปลี่ยนโดเมน อย่าลืมแก้ **Endpoint URL** ของ LIFF ให้ตรง
- ก่อนใส่ `LIFF_ID` หน้า `/line` จะขึ้นข้อความ "ยังไม่ได้ตั้งค่า LINE" (ปกติ ไม่ใช่ error)
- (ภายหลัง) จะเพิ่ม **แจ้งเตือน push** ผ่าน OA ต้องใช้ Channel access token จาก Messaging API channel — เพิ่มทีหลังได้
