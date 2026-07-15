import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

type IssueTypeFilter = "REPAIR" | "SUPPLY" | undefined;

// สรุปงานซ่อม/ของหมดสำหรับแดชบอร์ด ช่วง [from, to)
// - การ์ด "ต้องดำเนินการ" = ของค้างจริงตอนนี้ (ไม่ผูกช่วงเวลา)
// - การ์ด "ในช่วงนี้" = แจ้งใหม่/ปิดเสร็จ/ค่าใช้จ่าย ตาม from–to
export async function getRepairReport(
  from: Date,
  to: Date,
  opts?: { departmentId?: string; type?: IssueTypeFilter; checkpointId?: string }
) {
  const dept = opts?.departmentId;
  const type = opts?.type;
  const checkpointId = opts?.checkpointId;
  const cpWhere = dept ? { departmentId: dept } : undefined;

  // ฟิลเตอร์พื้นฐาน (ฝ่าย + ประเภท) ใช้ซ้ำหลาย query
  const baseWhere: Prisma.IssueWhereInput = {
    ...(cpWhere ? { checkpoint: cpWhere } : {}),
    ...(type ? { type } : {}),
  };

  // สรุป "ของหมด" — บังคับ type=SUPPLY เสมอ (ไม่ขึ้นกับตัวกรองเรื่อง/แท็บ)
  // เพื่อให้เห็นสรุปของหมดได้ทั้งแท็บภาพรวมและแท็บของหมด
  const supplyWhere: Prisma.IssueWhereInput = {
    ...(cpWhere ? { checkpoint: cpWhere } : {}),
    type: "SUPPLY",
  };

  const inRange = (d: Date | null | undefined) =>
    !!d && d.getTime() >= from.getTime() && d.getTime() < to.getTime();

  const [
    backlogGroups,
    periodIssues,
    proposedList,
    doneRepairs,
    supplyBacklogGroups,
    supplyNewCount,
    supplyResolvedCount,
    supplyList,
  ] = await Promise.all([
      // ── ของค้างตอนนี้ (ไม่ผูกช่วงเวลา) ──
      prisma.issue.groupBy({
        by: ["status"],
        where: {
          ...baseWhere,
          status: { in: ["OPEN", "PROPOSED", "APPROVED", "IN_PROGRESS"] },
        },
        _count: { _all: true },
      }),
      // ── งานที่แตะช่วงนี้ (แจ้ง/อนุมัติ/ปิด ในช่วง) — ดึงรอบเดียวแล้วคำนวณในหน่วยความจำ ──
      prisma.issue.findMany({
        where: {
          ...baseWhere,
          OR: [
            { createdAt: { gte: from, lt: to } },
            { approvedAt: { gte: from, lt: to } },
            { resolvedAt: { gte: from, lt: to } },
          ],
        },
        select: {
          id: true,
          type: true,
          createdAt: true,
          approvedAt: true,
          resolvedAt: true,
          checkpoint: {
            select: {
              departmentId: true,
              department: { select: { name: true } },
            },
          },
          proposals: {
            where: { selected: true },
            select: { price: true },
            take: 1,
          },
        },
      }),
      // ── รอผู้บริหารเลือกข้อเสนอ (backlog, เก่าสุดก่อน) ──
      prisma.issue.findMany({
        where: {
          type: "REPAIR",
          status: "PROPOSED",
          ...(cpWhere ? { checkpoint: cpWhere } : {}),
        },
        include: {
          checkpoint: { include: { site: true, department: true } },
          proposals: { select: { price: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
      // ── งานซ่อมที่ปิดเสร็จในช่วง (รูปก่อน/หลัง + ข้อเสนอที่เลือก) ──
      // ตัวกรอง "จุด" (checkpointId) มีผลเฉพาะรายการนี้เท่านั้น ไม่กระทบ KPI/งบ
      prisma.issue.findMany({
        where: {
          type: "REPAIR",
          status: "RESOLVED",
          resolvedAt: { gte: from, lt: to },
          ...(cpWhere ? { checkpoint: cpWhere } : {}),
          ...(checkpointId ? { checkpointId } : {}),
        },
        include: {
          checkpoint: { include: { site: true, department: true } },
          resolvedBy: { select: { name: true } },
          proposals: {
            where: { selected: true },
            select: { technician: true, price: true, detail: true },
            take: 1,
          },
        },
        orderBy: { resolvedAt: "desc" },
        take: 30,
      }),
      // ── ของหมดค้างตอนนี้: รอฝ่ายรับเรื่อง (OPEN) / รับเรื่องแล้วกำลังเติม (IN_PROGRESS) ──
      prisma.issue.groupBy({
        by: ["status"],
        where: { ...supplyWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
        _count: { _all: true },
      }),
      // ── ของหมด: แจ้งใหม่ในช่วง ──
      prisma.issue.count({
        where: { ...supplyWhere, createdAt: { gte: from, lt: to } },
      }),
      // ── ของหมด: เติมแล้ว (ปิดงาน) ในช่วง ──
      prisma.issue.count({
        where: {
          ...supplyWhere,
          status: "RESOLVED",
          resolvedAt: { gte: from, lt: to },
        },
      }),
      // ── ของหมด: รายการล่าสุด (แจ้ง/รับเรื่อง/เติมเสร็จ ในช่วง) + รูปหลักฐาน ──
      prisma.issue.findMany({
        where: {
          ...supplyWhere,
          OR: [
            { createdAt: { gte: from, lt: to } },
            { acceptedAt: { gte: from, lt: to } },
            { resolvedAt: { gte: from, lt: to } },
          ],
        },
        include: {
          checkpoint: { include: { site: true, department: true } },
          acceptedBy: { select: { name: true } },
          resolvedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

  const backlogCount = (s: string) =>
    backlogGroups.find((g) => g.status === s)?._count._all ?? 0;
  const backlog = {
    open: backlogCount("OPEN"),
    proposed: backlogCount("PROPOSED"),
    approved: backlogCount("APPROVED"),
    inProgress: backlogCount("IN_PROGRESS"),
    // รอช่างปิดงาน = อนุมัติแล้ว + กำลังแก้ไข
    inRepair: backlogCount("APPROVED") + backlogCount("IN_PROGRESS"),
  };

  const supplyBacklogCount = (s: string) =>
    supplyBacklogGroups.find((g) => g.status === s)?._count._all ?? 0;

  // ── สรุป "ในช่วงนี้" + แยกตามฝ่าย ──
  type DeptRow = {
    id: string;
    name: string;
    newCount: number;
    resolved: number;
    spend: number;
  };
  const deptMap = new Map<string, DeptRow>();
  const deptRow = (id: string | null, name: string | null): DeptRow => {
    const key = id ?? "__none__";
    let row = deptMap.get(key);
    if (!row) {
      row = { id: key, name: name ?? "ไม่ระบุฝ่าย", newCount: 0, resolved: 0, spend: 0 };
      deptMap.set(key, row);
    }
    return row;
  };

  // ── แนวโน้มรายวัน (เติมวันครบ) — คำนวณจาก periodIssues ที่ดึงมาแล้ว ไม่เพิ่ม query ──
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  type DailyRow = { date: string; newCount: number; resolved: number };
  const dailyMap = new Map<string, DailyRow>();
  for (
    const d = new Date(from);
    d.getTime() < to.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    const key = dayKey(d);
    dailyMap.set(key, { date: key, newCount: 0, resolved: 0 });
  }

  let newRepair = 0;
  let newSupply = 0;
  let resolvedInPeriod = 0;
  let spendTotal = 0;
  let spendCount = 0;
  let resolveMinSum = 0;
  let resolveMinCount = 0;

  for (const it of periodIssues) {
    const dRow = deptRow(
      it.checkpoint.departmentId,
      it.checkpoint.department?.name ?? null
    );
    if (inRange(it.createdAt)) {
      if (it.type === "REPAIR") newRepair++;
      else newSupply++;
      dRow.newCount++;
      const day = dailyMap.get(dayKey(it.createdAt));
      if (day) day.newCount++;
    }
    if (inRange(it.resolvedAt)) {
      resolvedInPeriod++;
      dRow.resolved++;
      const day = dailyMap.get(dayKey(it.resolvedAt!));
      if (day) day.resolved++;
      const mins =
        (it.resolvedAt!.getTime() - it.createdAt.getTime()) / 60000;
      if (Number.isFinite(mins) && mins >= 0) {
        resolveMinSum += mins;
        resolveMinCount++;
      }
    }
    // ค่าใช้จ่าย = งบที่อนุมัติในช่วง (เฉพาะงานซ่อมที่มีข้อเสนอถูกเลือก)
    if (inRange(it.approvedAt) && it.type === "REPAIR" && it.proposals[0]) {
      const price = it.proposals[0].price;
      spendTotal += price;
      spendCount++;
      dRow.spend += price;
    }
  }

  const byDepartment = [...deptMap.values()].sort(
    (a, b) => b.spend - a.spend || b.newCount - a.newCount
  );

  return {
    backlog,
    period: {
      newTotal: newRepair + newSupply,
      newRepair,
      newSupply,
      resolved: resolvedInPeriod,
      spendTotal,
      spendCount,
      spendAvg: spendCount > 0 ? Math.round(spendTotal / spendCount) : 0,
      // เวลาเฉลี่ยที่ใช้ซ่อม (นาที) ของงานที่ปิดในช่วง — null = ไม่มีงานปิด
      avgResolveMinutes:
        resolveMinCount > 0 ? Math.round(resolveMinSum / resolveMinCount) : null,
    },
    byDepartment,
    proposedList,
    doneRepairs,
    // แนวโน้มรายวัน (ตามตัวกรองเรื่อง/ฝ่ายที่เลือก)
    daily: [...dailyMap.values()],
    // สรุป "ของหมด" (คิดแยกจากตัวกรองเรื่อง — เห็นได้ทุกแท็บ)
    supply: {
      newCount: supplyNewCount,
      openNow: supplyBacklogCount("OPEN"),
      inProgressNow: supplyBacklogCount("IN_PROGRESS"),
      resolved: supplyResolvedCount,
      list: supplyList,
    },
  };
}

export type RepairReport = Awaited<ReturnType<typeof getRepairReport>>;
