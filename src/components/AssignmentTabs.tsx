"use client";

import { useState } from "react";
import BatchScheduleForm from "./BatchScheduleForm";
import BatchAssignForm from "./BatchAssignForm";

type ScheduleProps = React.ComponentProps<typeof BatchScheduleForm>;
type AssignProps = React.ComponentProps<typeof BatchAssignForm>;

export default function AssignmentTabs({
  staff,
  checkpoints,
  inspectors,
  schedules,
  defaultDate,
  assignments,
}: {
  staff: ScheduleProps["staff"];
  checkpoints: ScheduleProps["checkpoints"];
  inspectors: ScheduleProps["inspectors"];
  schedules: ScheduleProps["schedules"];
  defaultDate: AssignProps["defaultDate"];
  assignments: AssignProps["assignments"];
}) {
  const [tab, setTab] = useState<"schedule" | "daily">("schedule");

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      active
        ? "bg-brand text-white shadow-sm"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  return (
    <div className="space-y-4">
      {/* แท็บสลับประเภทงาน */}
      <div className="flex gap-2">
        <button
          type="button"
          className={tabCls(tab === "schedule")}
          onClick={() => setTab("schedule")}
        >
          งานประจำ (ทำซ้ำ)
        </button>
        <button
          type="button"
          className={tabCls(tab === "daily")}
          onClick={() => setTab("daily")}
        >
          งานรายวัน (ครั้งเดียว)
        </button>
      </div>

      <p className="text-sm text-gray-500 -mt-1">
        {tab === "schedule"
          ? "ตั้งครั้งเดียว ระบบจะแสดงให้พนักงานทุกวันที่กำหนดเอง"
          : "สำหรับงานเฉพาะกิจในวันใดวันหนึ่ง"}
      </p>
      <p className="text-xs text-gray-400 -mt-2">
        กรอกแล้วกด “＋ เพิ่มลงรายการ” ทีละงาน เพิ่มได้หลายงาน แล้วกด “บันทึกทั้งหมด” ทีเดียว
      </p>

      {tab === "schedule" ? (
        <BatchScheduleForm
          staff={staff}
          checkpoints={checkpoints}
          inspectors={inspectors}
          schedules={schedules}
        />
      ) : (
        <BatchAssignForm
          staff={staff}
          checkpoints={checkpoints}
          inspectors={inspectors}
          defaultDate={defaultDate}
          assignments={assignments}
        />
      )}
    </div>
  );
}
