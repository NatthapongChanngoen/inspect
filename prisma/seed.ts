import { PrismaClient, Role, StaffType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function upsertUser(opts: {
  username: string;
  name: string;
  password: string;
  role: Role;
  phone?: string;
  nationalId?: string;
  staffType?: StaffType;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  return prisma.user.upsert({
    where: { username: opts.username },
    update: {
      name: opts.name,
      role: opts.role,
      phone: opts.phone,
      nationalId: opts.nationalId,
      staffType: opts.staffType ?? null,
    },
    create: {
      username: opts.username,
      name: opts.name,
      role: opts.role,
      phone: opts.phone,
      nationalId: opts.nationalId,
      staffType: opts.staffType ?? null,
      passwordHash,
    },
  });
}

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin1234";

  // ---- ผู้ใช้ ----
  await upsertUser({
    username: adminUsername,
    name: "ผู้ดูแลระบบ",
    password: adminPassword,
    role: Role.ADMIN,
  });

  const inspector = await upsertUser({
    username: "inspector",
    name: "สมศรี ผู้ตรวจ",
    password: "inspect1234",
    role: Role.INSPECTOR,
    phone: "0810000001",
    nationalId: "1100000000011",
  });

  const maid = await upsertUser({
    username: "maid1",
    name: "มาลี แม่บ้าน",
    password: "staff1234",
    role: Role.STAFF,
    phone: "0820000001",
    nationalId: "1100000000029",
    staffType: StaffType.HOUSEKEEPER,
  });

  const guard = await upsertUser({
    username: "guard1",
    name: "สมชาย รปภ.",
    password: "staff1234",
    role: Role.STAFF,
    phone: "0830000001",
    nationalId: "1100000000037",
    staffType: StaffType.SECURITY,
  });

  // ---- สถานที่ตัวอย่าง ----
  // หากมีอยู่แล้วไม่ต้องสร้างซ้ำ (กันข้อมูลตัวอย่างซ้ำตอน restart)
  const existingSite = await prisma.site.findFirst({
    where: { name: "อาคารสำนักงานใหญ่ (ตัวอย่าง)" },
  });

  const site =
    existingSite ??
    (await prisma.site.create({
      data: {
        name: "อาคารสำนักงานใหญ่ (ตัวอย่าง)",
        address: "กรุงเทพมหานคร",
      },
    }));

  // ---- ฝ่ายตัวอย่าง ----
  // หากมีอยู่แล้วไม่ต้องสร้างซ้ำ (กันข้อมูลตัวอย่างซ้ำตอน restart)
  async function ensureDepartment(name: string) {
    const existing = await prisma.department.findFirst({ where: { name } });
    return existing ?? (await prisma.department.create({ data: { name } }));
  }
  const deptHousekeeping = await ensureDepartment("ฝ่ายแม่บ้าน");
  const deptSecurity = await ensureDepartment("ฝ่ายรักษาความปลอดภัย");
  await ensureDepartment("ฝ่ายอาคารสถานที่");

  // ---- จุดเช็คอินตัวอย่าง ----
  if ((await prisma.checkpoint.count({ where: { siteId: site.id } })) === 0) {
    const cp1 = await prisma.checkpoint.create({
      data: {
        siteId: site.id,
        departmentId: deptHousekeeping.id,
        name: "ห้องน้ำ ชั้น 1",
        latitude: 13.7563,
        longitude: 100.5018,
        radiusMeters: 80,
        description: "ทำความสะอาดห้องน้ำชายและหญิง",
      },
    });

    const cp2 = await prisma.checkpoint.create({
      data: {
        siteId: site.id,
        departmentId: deptSecurity.id,
        name: "ป้อมยาม ทางเข้าหลัก",
        latitude: 13.7565,
        longitude: 100.5021,
        radiusMeters: 80,
        description: "ตรวจตราและบันทึกการเข้าออก",
      },
    });

    // ---- มอบหมายงานวันนี้ ----
    await prisma.assignment.create({
      data: {
        userId: maid.id,
        checkpointId: cp1.id,
        scheduledDate: todayMidnight(),
        note: "เช็ดถูพื้นและเติมสบู่",
      },
    });
    await prisma.assignment.create({
      data: {
        userId: guard.id,
        checkpointId: cp2.id,
        scheduledDate: todayMidnight(),
      },
    });
  }

  console.log("✅ Seed เสร็จสิ้น");
  console.log(`   admin: ${adminUsername} / ${adminPassword}`);
  console.log(`   inspector: inspector / inspect1234`);
  console.log(`   staff: maid1 / staff1234 , guard1 / staff1234`);
  void inspector;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
