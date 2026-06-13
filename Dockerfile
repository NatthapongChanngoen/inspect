# ---- Staff Inspection System : Next.js + Prisma ----
FROM node:20-slim AS base

# prisma ต้องใช้ openssl
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ติดตั้ง dependencies (cache layer)
COPY package.json package-lock.json* ./
RUN npm install

# คัดลอกซอร์สโค้ดทั้งหมด
COPY . .

# generate prisma client + build next (ไม่ต้องต่อ DB ตอน build)
RUN npx prisma generate
RUN npm run build

# โฟลเดอร์เก็บรูปอัปโหลด
RUN mkdir -p /app/uploads

EXPOSE 3000

# ตอน start: สร้าง/อัปเดต schema ในฐานข้อมูล (db push), seed ข้อมูลเริ่มต้น, แล้วรันแอป
# ใช้ db push เพราะเป็นโปรเจคเริ่มต้นที่ยังไม่มีไฟล์ migration (เปลี่ยนเป็น migrate deploy ได้ภายหลัง)
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run seed && npm run start"]
