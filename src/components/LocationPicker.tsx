"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";

const TH_CENTER = { lat: 13.736, lng: 100.523 };

export default function LocationPicker({
  defaultLat,
  defaultLng,
  defaultRadius = 50,
}: {
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
}) {
  const hasDefault = defaultLat != null && defaultLng != null;
  const [lat, setLat] = useState<number>(defaultLat ?? TH_CENTER.lat);
  const [lng, setLng] = useState<number>(defaultLng ?? TH_CENTER.lng);
  const [radius, setRadius] = useState<number>(defaultRadius);
  const [hasPoint, setHasPoint] = useState<boolean>(hasDefault);
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);
  const markerRef = useRef<LeafletNS.Marker | null>(null);
  const circleRef = useRef<LeafletNS.Circle | null>(null);

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;

      const startLat = defaultLat ?? TH_CENTER.lat;
      const startLng = defaultLng ?? TH_CENTER.lng;
      const zoom = hasDefault ? 17 : 6;

      const map = L.map(mapEl.current).setView([startLat, startLng], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div style="font-size:30px;line-height:1">📍</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 28],
      });
      const marker = L.marker([startLat, startLng], {
        draggable: true,
        icon,
        opacity: hasDefault ? 1 : 0.5,
      }).addTo(map);
      const circle = L.circle([startLat, startLng], {
        radius: defaultRadius,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
      }).addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      const setPoint = (la: number, ln: number) => {
        setLat(la);
        setLng(ln);
        setHasPoint(true);
        marker.setLatLng([la, ln]);
        marker.setOpacity(1);
        circle.setLatLng([la, ln]);
      };

      map.on("click", (e: LeafletNS.LeafletMouseEvent) =>
        setPoint(e.latlng.lat, e.latlng.lng)
      );
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        setPoint(p.lat, p.lng);
      });

      // ถ้ายังไม่มีค่าเริ่มต้น ลองดึงตำแหน่งปัจจุบันอัตโนมัติ
      if (!hasDefault && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setPoint(pos.coords.latitude, pos.coords.longitude);
            map.setView([pos.coords.latitude, pos.coords.longitude], 17);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }

      setTimeout(() => map.invalidateSize(), 150);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ปรับขนาดวงกลมเมื่อรัศมีเปลี่ยน
  useEffect(() => {
    circleRef.current?.setRadius(radius || 0);
  }, [radius]);

  function useCurrentLocation() {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(la);
        setLng(ln);
        setHasPoint(true);
        markerRef.current?.setLatLng([la, ln]);
        markerRef.current?.setOpacity(1);
        circleRef.current?.setLatLng([la, ln]);
        mapRef.current?.setView([la, ln], 17);
      },
      () => {
        setLocating(false);
        setGeoError("ไม่สามารถอ่านพิกัดได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="label mb-0">เลือกตำแหน่งจุดบนแผนที่</label>
        <button
          type="button"
          className="btn-ghost !py-1.5 text-sm"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? "กำลังหา…" : "📍 ใช้ตำแหน่งปัจจุบัน"}
        </button>
      </div>

      <div
        ref={mapEl}
        className="h-72 w-full rounded-xl overflow-hidden border border-gray-300 relative isolate z-0"
      />

      {geoError && <p className="text-sm text-red-600">{geoError}</p>}

      <p className="text-xs text-gray-500">
        คลิกบนแผนที่หรือลากหมุดเพื่อเลือกจุด ·{" "}
        {hasPoint ? (
          <span className="text-gray-700 font-medium">
            พิกัด {lat.toFixed(6)}, {lng.toFixed(6)}
          </span>
        ) : (
          <span className="text-amber-600">ยังไม่ได้เลือกจุด</span>
        )}
      </p>

      <div>
        <label className="label">รัศมีที่อนุญาต (เมตร)</label>
        <input
          name="radiusMeters"
          type="number"
          min={5}
          className="input"
          value={radius}
          onChange={(e) => setRadius(parseInt(e.target.value || "0", 10) || 0)}
        />
      </div>

      <input type="hidden" name="latitude" value={hasPoint ? lat : ""} />
      <input type="hidden" name="longitude" value={hasPoint ? lng : ""} />
    </div>
  );
}
