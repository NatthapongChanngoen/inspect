import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

function homeFor(role?: string): string {
  if (role === "ADMIN") return "/admin";
  if (role === "INSPECTOR") return "/inspector";
  return "/staff";
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  // ปล่อยผ่านเส้นทางของ Auth.js เอง
  if (path.startsWith("/api/auth")) return NextResponse.next();

  // ปล่อยผ่าน API สมัครสมาชิก (สาธารณะ)
  if (path.startsWith("/api/register")) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role as string | undefined;
  const isLogin = path === "/login";
  const isRegister = path === "/register";
  const isLanding = path === "/";
  // หน้าสาธารณะ: landing / login / สมัครสมาชิก
  const isPublic = isLogin || isRegister || isLanding;

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
    return NextResponse.redirect(new URL(homeFor(role), nextUrl));
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
