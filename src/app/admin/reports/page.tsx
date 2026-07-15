import { redirect } from "next/navigation";

// รายงานเวลาถูกรวมเข้าหน้ารายงานผู้บริหารแล้ว (/admin/executive)
export default function ReportsRedirect() {
  redirect("/admin/executive");
}
