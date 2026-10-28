"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Select } from "@/components/ui";

type R = { code: string; name: string; kind: string | null };
type Value = { province_code?: string | null; regency_code?: string | null; district_code?: string | null; village_code?: string | null };

const LEVELS = [
  { key: "province_code", label: "Provinsi" },
  { key: "regency_code", label: "Kabupaten/Kota" },
  { key: "district_code", label: "Kecamatan" },
  { key: "village_code", label: "Desa/Kelurahan" },
] as const;

/** Pilihan wilayah bertingkat dari tabel regions (Kepmendagri 2025). */
export function RegionPicker({ value, defaultProvince = "71" }: { value?: Value; defaultProvince?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [sel, setSel] = useState<string[]>([
    value?.province_code || defaultProvince,
    value?.regency_code || "",
    value?.district_code || "",
    value?.village_code || "",
  ]);
  const [lists, setLists] = useState<R[][]>([[], [], [], []]);

  const load = async (i: number, parent: string) => {
    let q = supabase.from("regions").select("code, name, kind").eq("level", i + 1).order("name").limit(2000);
    if (i > 0) q = q.eq("parent_code", parent);
    const { data } = await q;
    setLists((l) => l.map((x, j) => (j === i ? ((data ?? []) as R[]) : x)));
  };

  useEffect(() => {
    load(0, "");
    sel.slice(0, 3).forEach((c, i) => {
      if (c) load(i + 1, c);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (i: number, code: string) => {
    setSel((s) => s.map((v, j) => (j < i ? v : j === i ? code : "")));
    setLists((l) => l.map((x, j) => (j > i ? [] : x)));
    if (code && i < 3) load(i + 1, code);
  };

  const pick = (i: number) => lists[i].find((r) => r.code === sel[i]);
  const d = pick(3);
  const c = pick(2);
  const k = pick(1);
  const label = [
    d && `${d.kind === "KELURAHAN" ? "Kel." : "Desa"} ${d.name}`,
    c && `Kec. ${c.name}`,
    k && k.name.replace(/^Kabupaten /, "Kab. "),
  ].filter(Boolean).join(", ");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {LEVELS.map((lv, i) => {
        const locked = i > 0 && !sel[i - 1];
        return (
          <Field key={lv.key} label={lv.label}>
            <Select
              name={lv.key}
              value={sel[i]}
              disabled={locked}
              onChange={(e) => change(i, e.target.value)}
              placeholder={locked ? `Pilih ${LEVELS[i - 1].label.toLowerCase()} dulu` : `Pilih ${lv.label.toLowerCase()}`}
              options={lists[i].map((r) => ({ value: r.code, label: r.name }))}
            />
          </Field>
        );
      })}
      <input type="hidden" name="region_label" value={label} />
    </div>
  );
}