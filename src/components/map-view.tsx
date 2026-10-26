"use client";
import dynamic from "next/dynamic";

export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string; href?: string };

const Inner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-500">Memuat peta...</div>,
});

export function MapView({ points, height = 420 }: { points: MapPoint[]; height?: number }) {
  return <Inner points={points} height={height} />;
}
