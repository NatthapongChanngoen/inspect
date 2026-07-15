import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function homeFor(role?: string): string {
  if (role === "ADMIN") return "/admin";
  if (role === "EXECUTIVE") return "/admin/executive";
  if (role === "INSPECTOR") return "/inspector";
  return "/staff";
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  // ปล่อยผ่านเส้นทางของ Auth.js เอง
  if (path.startsWith("/api/auth")) return NextResponse.next();

  // ปล่อยผ่าน API ผูกบัญชี LINE (สาธารณะ)
  if (path.startsWith("/api/line")) return NextResponse.next();

  // ปล่อยผ่าน API แจ้งปัญหาสาธารณะผ่าน LINE (ไม่ต้องล็อกอินแอป)
  if (path.startsWith("/api/issues/public")) return NextResponse.next();

  // ปล่อยผ่านรูปจุดสาธารณะ (ให้ LINE ดึงรูปไปแสดงในข้อความได้)
  if (path.startsWith("/api/cp-photo")) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as string | undefined;
  const isLogin = path === "/login";
  const isLanding = path === "/";
  const isLine = path === "/line";
  // ช่องทางแจ้งซ่อมสาธารณะผ่าน LINE (/line?to=report) — ต้องเข้าได้แม้ล็อกอินอยู่ (ไม่เด้ง)
  const isReportEntry = isLine && nextUrl.searchParams.get("to") === "report";
  // หน้าสาธารณะ: landing / login / เข้าผ่าน LINE
  const isPublic = isLogin || isLanding || isLine;

  // ช่องทางแจ้งซ่อมสาธารณะ: ปล่อยผ่านทุกกรณี (ทั้งยังไม่ล็อกอินและล็อกอินแล้ว)
  if (isReportEntry) return NextResponse.next();

  if (!isLoggedIn) {
    if (isPublic) return NextResponse.next();
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  // ล็อกอินแล้ว: เด้งออกจากหน้า landing/login/สมัคร ไปยังหน้าแรกตามบทบาท
  if (isPublic) {
    return NextResponse.redirect(new URL(homeFor(role), nextUrl));
  }

  // ควบคุมสิทธิ์ตามบทบาท
  if (path.startsWith("/admin") && role !== "ADMIN") {
    // ผู้บริหารเข้าได้เฉพาะรายงานผู้บริหาร + รายงานเวลา
    const execAllowed =
      role === "EXECUTIVE" &&
      (path.startsWith("/admin/executive") ||
        path.startsWith("/admin/reports") ||
        path.startsWith("/admin/repairs"));
    if (!execAllowed) {
      return NextResponse.redirect(new URL(homeFor(role), nextUrl));
    }
  }
  if (path.startsWith("/inspector") && !(role === "INSPECTOR" || role === "ADMIN")) {
    return NextResponse.redirect(new URL(homeFor(role), nextUrl));
  }
  if (path.startsWith("/staff") && !(role === "STAFF" || role === "ADMIN")) {
    return NextResponse.redirect(new URL(homeFor(role), nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // ทำงานทุกเส้นทาง ยกเว้นไฟล์สแตติก/รูป/manifest
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|illustrations/|sw.js).*)",
  ],
};
