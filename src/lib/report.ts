import { prisma } from "@/lib/db";
import { LATE_GRACE_MINUTES } from "@/lib/date";

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

type Bucket = {
  total: number;
  approved: number;
  rejected: number;
  missed: number;
};
const emptyBucket = (): Bucket => ({
  total: 0,
  approved: 0,
  rejected: 0,
  missed: 0,
});

// รายงานสรุปสำหรับผู้บริหาร ช่วง [from, to)
export async function getExecutiveReport(
  from: Date,
  to: Date,
  departmentId?: string
) {
  // กรองตามฝ่าย (ถ้าเลือก) — ฝ่ายผูกกับจุดเช็คอิน
  const cpWhere = departmentId ? { departmentId } : undefined;
  const [
    records,
    issuesOpened,
    issuesResolved,
    issuesOpenNow,
    roleGroups,
    typeGroups,
    siteCount,
    checkpointActive,
    reviews,
    issuesList,
  ] = await Promise.all([
    prisma.workRecord.findMany({
      where: {
        checkInAt: { gte: from, lt: to },
        ...(cpWhere ? { checkpoint: cpWhere } : {}),
      },
      include: {
        checkpoint: { include: { site: true } },
        user: { select: { id: true, name: true, staffType: true, role: true } },
        inspector: { select: { name: true } },
        inspector2: { select: { name: true } },
      },
    }),
    prisma.issue.groupBy({
      by: ["type"],
      where: {
        createdAt: { gte: from, lt: to },
        ...(cpWhere ? { checkpoint: cpWhere } : {}),
      },
      _count: { _all: true },
    }),
    prisma.issue.count({
      where: {
        resolvedAt: { gte: from, lt: to },
        ...(cpWhere ? { checkpoint: cpWhere } : {}),
      },
    }),
    prisma.issue.count({
      where: { status: "OPEN", ...(cpWhere ? { checkpoint: cpWhere } : {}) },
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["staffType"], _count: { _all: true } }),
    prisma.site.count(),
    prisma.checkpoint.count({ where: { active: true } }),
    prisma.review.findMany({
      where: {
        reviewedAt: { gte: from, lt: to },
        ...(cpWhere ? { workRecord: { checkpoint: cpWhere } } : {}),
      },
      include: { inspector: { select: { id: true, name: true } } },
    }),
    prisma.issue.findMany({
      where: {
        createdAt: { gte: from, lt: to },
        ...(cpWhere ? { checkpoint: cpWhere } : {}),
      },
      include: {
        checkpoint: { include: { site: true } },
        reportedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const dailyMap = new Map<string, Bucket>();

  // ----- KPI รวม -----
  const kpi = emptyBucket() as Bucket & {
    pending: number;
    submitted: number;
    inProgress: number;
    notReviewed: number;
    returned: number;
  };
  kpi.pending = 0;
  kpi.submitted = 0;
  kpi.inProgress = 0;
  kpi.notReviewed = 0;
  kpi.returned = 0;
  const bySiteMap = new Map<string, Bucket & { name: string }>();
  const byCheckpointMap = new Map<
    string,
    Bucket & { name: string; site: string; inspectors: Set<string> }
  >();
  const byType: Record<"HOUSEKEEPER" | "SECURITY", Bucket> = {
    HOUSEKEEPER: emptyBucket(),
    SECURITY: emptyBucket(),
  };
  const staffMap = new Map<
    string,
    Bucket & {
      name: string;
      staffType: string | null;
      scheduled: number; // งานที่มีเวลาเริ่มกำหนด (วัดสายได้)
      late: number; // งานที่เข้าสาย
    }
  >();

  for (const r of records) {
    kpi.total++;
    const s = r.status;
    const bump = (b: Bucket) => {
      b.total++;
      if (s === "APPROVED") b.approved++;
      else if (s === "REJECTED") b.rejected++;
      else if (s === "MISSED") b.missed++;
    };
    if (s === "APPROVED") kpi.approved++;
    else if (s === "REJECTED") kpi.rejected++;
    else if (s === "MISSED") kpi.missed++;
    else {
      // งานค้าง: IN_PROGRESS / SUBMITTED / NOT_REVIEWED / RETURNED
      kpi.pending++;
      if (s === "SUBMITTED") kpi.submitted++;
      else if (s === "NOT_REVIEWED") kpi.notReviewed++;
      else if (s === "RETURNED") kpi.returned++;
      else kpi.inProgress++;
    }

    // by site
    const siteId = r.checkpoint.siteId;
    const site =
      bySiteMap.get(siteId) ??
      { name: r.checkpoint.site.name, ...emptyBucket() };
    bump(site);
    bySiteMap.set(siteId, site);

    // by checkpoint (รายจุด)
    const cp =
      byCheckpointMap.get(r.checkpointId) ??
      {
        name: r.checkpoint.name,
        site: r.checkpoint.site.name,
        inspectors: new Set<string>(),
        ...emptyBucket(),
      };
    bump(cp);
    if (r.inspector?.name) cp.inspectors.add(r.inspector.name);
    if (r.inspector2?.name) cp.inspectors.add(r.inspector2.name);
    byCheckpointMap.set(r.checkpointId, cp);

    // by staff type
    if (r.user.staffType === "HOUSEKEEPER") bump(byType.HOUSEKEEPER);
    else if (r.user.staffType === "SECURITY") bump(byType.SECURITY);

    // by staff (เฉพาะ STAFF)
    if (r.user.role === "STAFF") {
      const st =
        staffMap.get(r.user.id) ??
        {
          name: r.user.name,
          staffType: r.user.staffType,
          scheduled: 0,
          late: 0,
          ...emptyBucket(),
        };
      bump(st);
      if (r.lateMinutes != null) {
        st.scheduled++;
        if (r.lateMinutes > LATE_GRACE_MINUTES) st.late++;
      }
      staffMap.set(r.user.id, st);
    }

    // รายวัน
    const dk = dayKey(new Date(r.checkInAt));
    const db = dailyMap.get(dk) ?? emptyBucket();
    bump(db);
    dailyMap.set(dk, db);
  }

  // สร้างรายวันต่อเนื่องทุกวันในช่วง (วันไม่มีงาน = 0)
  const daily: {
    date: string;
    total: number;
    approved: number;
    rejected: number;
    missed: number;
    passRate: number;
  }[] = [];
  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    const b = dailyMap.get(key) ?? emptyBucket();
    daily.push({
      date: key,
      total: b.total,
      approved: b.approved,
      rejected: b.rejected,
      missed: b.missed,
      passRate: pct(b.approved, b.approved + b.rejected),
    });
  }

  // งานล่าสุดในช่วง
  const recentWork = [...records]
    .sort(
      (a, b) =>
        new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
    )
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      staff: r.user.name,
      checkpoint: r.checkpoint.name,
      site: r.checkpoint.site.name,
      status: r.status,
      checkInAt: r.checkInAt,
    }));

  // รายการแจ้งซ่อม/ของหมดล่าสุดในช่วง
  const recentIssues = issuesList.map((it) => ({
    type: it.type,
    status: it.status,
    detail: it.detail,
    checkpoint: it.checkpoint.name,
    site: it.checkpoint.site.name,
    createdAt: it.createdAt,
  }));

  const performed = kpi.total - kpi.missed;
  const reviewed = kpi.approved + kpi.rejected;

  const withRates = (b: Bucket) => ({
    ...b,
    performed: b.total - b.missed,
    passRate: pct(b.approved, b.approved + b.rejected),
    attendanceRate: pct(b.total - b.missed, b.total),
  });

  // คะแนนประสิทธิภาพ 0–100 (คุณภาพงาน 60% + มาปฏิบัติงาน 40%)
  const perfScore = (passRate: number, attendanceRate: number) =>
    Math.round(passRate * 0.6 + attendanceRate * 0.4);

  const bySite = [...bySiteMap.values()]
    .map((b) => ({ name: b.name, ...withRates(b) }))
    .sort((a, b) => b.total - a.total);

  // รายจุด — เรียงแย่สุดก่อน: (ไม่ผ่าน+ขาด) มากก่อน → อัตราผ่านน้อยก่อน
  const byCheckpoint = [...byCheckpointMap.values()]
    .map((b) => {
      const r = withRates(b);
      return {
        ...r,
        name: b.name,
        site: b.site,
        inspectors: [...b.inspectors],
        score: perfScore(r.passRate, r.attendanceRate),
      };
    })
    .sort(
      (a, b) =>
        b.rejected + b.missed - (a.rejected + a.missed) ||
        a.passRate - b.passRate
    );

  const staffRanking = [...staffMap.values()]
    .map((b) => {
      const r = withRates(b);
      return {
        name: b.name,
        staffType: b.staffType,
        ...r,
        score: perfScore(r.passRate, r.attendanceRate),
        // ตรงเวลา% (จากงานที่มีเวลาเริ่มกำหนด); null = ไม่มีงานที่วัดสายได้
        onTimeRate:
          b.scheduled > 0 ? pct(b.scheduled - b.late, b.scheduled) : null,
      };
    })
    .sort((a, b) => b.score - a.score || b.attendanceRate - a.attendanceRate);

  const issueCount = (t: string) =>
    issuesOpened.find((g) => g.type === t)?._count._all ?? 0;
  const roleCount = (r: string) =>
    roleGroups.find((g) => g.role === r)?._count._all ?? 0;
  const typeCount = (t: string) =>
    typeGroups.find((g) => g.staffType === t)?._count._all ?? 0;

  // สรุปผู้ตรวจ (จำนวนที่ตรวจในช่วง)
  const inspMap = new Map<string, { name: string; reviewed: number }>();
  for (const rv of reviews) {
    const e =
      inspMap.get(rv.inspectorId) ??
      { name: rv.inspector.name, reviewed: 0 };
    e.reviewed++;
    inspMap.set(rv.inspectorId, e);
  }
  const inspectors = [...inspMap.values()].sort(
    (a, b) => b.reviewed - a.reviewed
  );

  return {
    kpi: {
      total: kpi.total,
      performed,
      missed: kpi.missed,
      approved: kpi.approved,
      rejected: kpi.rejected,
      pending: kpi.pending,
      submitted: kpi.submitted,
      inProgress: kpi.inProgress,
      notReviewed: kpi.notReviewed,
      returned: kpi.returned,
      attendanceRate: pct(performed, kpi.total),
      passRate: pct(kpi.approved, reviewed),
    },
    bySite,
    byCheckpoint,
    byStaffType: {
      HOUSEKEEPER: withRates(byType.HOUSEKEEPER),
      SECURITY: withRates(byType.SECURITY),
    },
    staffRanking,
    issues: {
      repairOpened: issueCount("REPAIR"),
      supplyOpened: issueCount("SUPPLY"),
      resolved: issuesResolved,
      openNow: issuesOpenNow,
    },
    scope: {
      totalUsers: roleGroups.reduce((a, g) => a + g._count._all, 0),
      housekeeper: typeCount("HOUSEKEEPER"),
      security: typeCount("SECURITY"),
      inspectors: roleCount("INSPECTOR"),
      sites: siteCount,
      checkpoints: checkpointActive,
    },
    inspectors,
    daily,
    recentWork,
    recentIssues,
  };
}

export type ExecutiveReport = Awaited<ReturnType<typeof getExecutiveReport>>;
