import { redirect } from "next/navigation";

// เปิดเว็บที่ "/" → ไปหน้าเข้าสู่ระบบทันที
// (ผู้ที่ล็อกอินแล้ว middleware จะ redirect ไปแดชบอร์ดตามบทบาทก่อนถึงหน้านี้)
export default function Home() {
  redirect("/login");
}
