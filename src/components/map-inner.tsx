"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import type { MapPoint } from "./map-view";

const icon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#047857;border:3px solid #fff;box-shadow:0 0 0 1px #047857"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MapInner({ points, height }: { points: MapPoint[]; height: number }) {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const center: [number, number] = valid.length ? [valid[0].lat, valid[0].lng] : [-2.5, 118];
  const bounds = valid.length > 1 ? L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])) : undefined;
  return (
    <div style={{ height }} className="overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={center} zoom={valid.length ? 11 : 5} bounds={bounds} boundsOptions={{ padding: [30, 30] }} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {valid.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
            <Popup>
              <div className="space-y-1 text-sm">
                <div className="font-semibold">{p.title}</div>
                {p.subtitle && <div>{p.subtitle}</div>}
                <div className="flex gap-2">
                  {p.href && <a href={p.href}>Detail</a>}
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">Navigasi</a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
