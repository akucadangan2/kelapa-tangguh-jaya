"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";
import { DEFAULT_ORDER, DEFAULT_TEXT, findTour, type TourKey } from "@/lib/tour-steps";

type Step = { el: HTMLElement | null; title: string; body: string };

const q = (s: string) => document.querySelector(s) as HTMLElement | null;
const qa = (s: string) => Array.from(document.querySelectorAll(s)) as HTMLElement[];
const shown = (el: HTMLElement | null | undefined) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 ? el : null;
};

const FIND: Record<TourKey, () => HTMLElement | null> = {
  menu: () => qa("aside nav").map(shown).find(Boolean) ?? shown(q('button[aria-label="Buka menu"]')),
  bell: () => shown(q('header a[aria-label="Notifikasi"]')),
  header: () => {
    const h = q("main h1");
    return shown((h?.closest("div.mb-6") as HTMLElement) ?? h?.parentElement ?? h);
  },
  export: () => shown(qa("main button").find((b) => /Excel/.test(b.textContent ?? ""))?.parentElement),
  progress: () => {
    const o = q("main ol.flex.items-start");
    return shown((o?.closest("section") as HTMLElement) ?? o);
  },
  stats: () => shown(qa("main div.grid.grid-cols-2").find((el) => !el.closest("form") && !el.closest("section") && el.children.length >= 2)),
  tabs: () => shown(q("main div.inline-flex.min-w-full")),
  filter: () => shown(q("main form.mb-5.rounded-2xl")),
  collapse: () => shown(q("main details")),
  table: () => {
    const t = q("main table");
    return shown((t?.closest("section") as HTMLElement) ?? t);
  },
  side: () => qa("main .lg\\:sticky").map(shown).find(Boolean) ?? null,
  list: () => shown(q("main section")),
};

/** Panduan per halaman: sorot bagian halaman satu per satu, muncul sekali per menu per pengguna. */
export function Tour({ userId }: { userId: string }) {
  const path = usePathname();
  const cfg = findTour(path);
  const storeKey = cfg ? `tourweb:${userId}:${cfg.id}` : "";
  const [mounted, setMounted] = useState(false);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState({ w: 1200, h: 800 });

  useEffect(() => setMounted(true), []);

  const start = useCallback(() => {
    if (!cfg) return;
    const list: Step[] = [{ el: null, title: cfg.title, body: cfg.intro }];
    const used = new Set<HTMLElement>();
    for (const k of cfg.order ?? DEFAULT_ORDER) {
      let el: HTMLElement | null = null;
      try { el = FIND[k](); } catch { el = null; }
      if (!el || used.has(el)) continue;
      used.add(el);
      list.push({ el, title: DEFAULT_TEXT[k].title, body: cfg.text?.[k] ?? DEFAULT_TEXT[k].body });
    }
    setI(0);
    setSteps(list);
  }, [cfg]);

  const close = useCallback(() => {
    setSteps(null);
    setRect(null);
    try { if (storeKey) localStorage.setItem(storeKey, "1"); } catch {}
  }, [storeKey]);

  // Muncul otomatis saat menu pertama kali dibuka.
  useEffect(() => {
    setSteps(null);
    setRect(null);
    if (!cfg || !storeKey) return;
    let seen = "1";
    try { seen = localStorage.getItem(storeKey) ?? ""; } catch {}
    if (seen) return;
    const t = setTimeout(start, 800);
    return () => clearTimeout(t);
  }, [path, storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gulir ke bagian yang disorot dan ikuti posisinya.
  useLayoutEffect(() => {
    const el = steps?.[i]?.el;
    const measure = () => {
      setVw({ w: window.innerWidth, h: window.innerHeight });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    if (el && !el.closest("aside, header")) {
      const r = el.getBoundingClientRect();
      const top = r.height > window.innerHeight * 0.6 ? r.top + window.scrollY - 80 : r.top + window.scrollY - (window.innerHeight - r.height) / 2;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    measure();
    const t1 = setTimeout(measure, 250);
    const t2 = setTimeout(measure, 600);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [steps, i]);

  // Keyboard: Esc tutup, panah kanan/kiri pindah langkah.
  useEffect(() => {
    if (!steps) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") (i < steps.length - 1 ? setI(i + 1) : close());
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, i, close]);

  if (!mounted || !cfg) return null;

  const step = steps?.[i];
  const last = steps ? i === steps.length - 1 : false;
  const pad = 6;
  const hole = rect
    ? {
        top: Math.max(rect.top - pad, 8),
        left: Math.max(rect.left - pad, 8),
        width: Math.min(rect.width + pad * 2, vw.w - 16),
        height: Math.min(rect.bottom + pad, vw.h - 8) - Math.max(rect.top - pad, 8),
      }
    : null;
  const cardW = Math.min(360, vw.w - 32);
  let cardStyle: React.CSSProperties = { width: cardW, left: (vw.w - cardW) / 2, top: Math.max(16, vw.h / 2 - 120) };
  if (hole && hole.height > 0) {
    const left = Math.min(Math.max(hole.left, 16), vw.w - cardW - 16);
    const below = vw.h - (hole.top + hole.height);
    if (below > 230) cardStyle = { width: cardW, left, top: hole.top + hole.height + 12 };
    else if (hole.top > 230) cardStyle = { width: cardW, left, bottom: vw.h - hole.top + 12 };
    else cardStyle = { width: cardW, left: (vw.w - cardW) / 2, bottom: 16 };
  }

  return (
    <>
      {!steps && (
        <button
          type="button"
          onClick={start}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-300/40 transition hover:border-emerald-300 hover:text-emerald-700 print:hidden"
          aria-label="Panduan halaman ini"
        >
          <HelpCircle size={18} className="text-emerald-600" />
          <span className="hidden sm:inline">Panduan</span>
        </button>
      )}

      {steps && step && (
        <div className="fixed inset-0 z-[70] print:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
          {hole && hole.height > 0 ? (
            <div
              className="pointer-events-none fixed rounded-xl ring-2 ring-emerald-400 transition-all duration-300"
              style={{ ...hole, boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)" }}
            />
          ) : (
            <div className="pointer-events-none fixed inset-0 bg-slate-900/55" />
          )}

          <div className="fixed rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl transition-all duration-300" style={cardStyle}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-emerald-700">{i + 1} / {steps.length}</span>
              <button type="button" onClick={close} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Tutup panduan">
                <X size={16} />
              </button>
            </div>
            <div className="text-[15px] font-semibold text-slate-900">{step.title}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
            <div className="mt-4 flex items-center gap-1">
              {steps.map((_, j) => (
                <span key={j} className={`h-1.5 rounded-full transition-all ${j === i ? "w-5 bg-emerald-600" : "w-1.5 bg-slate-200"}`} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" onClick={close} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Lewati
              </button>
              <div className="flex gap-2">
                {i > 0 && (
                  <button type="button" onClick={() => setI(i - 1)} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Kembali
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (last ? close() : setI(i + 1))}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  {last ? "Selesai" : "Lanjut"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}