"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote, Bell, BookOpen, Box, ChevronDown, Factory, Flame, Home, LineChart, LogOut, Map, Menu, Settings, ShoppingCart, Wallet, X,
} from "lucide-react";
import type { NavGroup } from "@/lib/nav";
import logo from "@/app/logo.png";

const ICONS: Record<string, any> = { home: Home, map: Map, cart: ShoppingCart, wallet: Wallet, box: Box, flame: Flame, factory: Factory, cash: Banknote, book: BookOpen, chart: LineChart, settings: Settings };

type Props = { nav: NavGroup[]; name: string; roles: string; unread: number; company: string; badges?: Record<string, number> };

/** Kerangka aplikasi: sidebar (desktop), laci menu (HP) dan bilah atas. */
export function Sidebar({ nav, name, roles, unread, company, badges = {} }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const best = nav
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => path === h || path.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];
  const activeGroup = nav.find((g) => g.items.some((i) => i.href === best))?.label;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const current = nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))).find((i) => i.href === best);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const badge = (href: string) => badges[href] ?? 0;
  const groupTotal = (g: NavGroup) => g.items.reduce((a, x) => a + badge(x.href), 0);
  const fmt = (v: number) => (v > 99 ? "99+" : String(v));

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5">
      <Image src={logo} alt={company} width={40} height={40} className="h-10 w-10 rounded-xl bg-white object-contain ring-1 ring-slate-200" />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-900">{company}</div>
        <div className="text-xs text-slate-500">Kopra · Tempurung · Arang</div>
      </div>
    </Link>
  );

  const menu = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
      {nav.map((g) => {
        const Icon = ICONS[g.icon] ?? Home;
        const single = g.items.length === 1;
        const isOpen = collapsed[g.label] === undefined ? true : !collapsed[g.label];
        const groupActive = g.label === activeGroup;
        if (single) {
          const i = g.items[0];
          const act = i.href === best;
          return (
            <Link
              key={g.label}
              href={i.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${act ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              <Icon size={18} className={act ? "text-white" : "text-slate-400"} />
              <span className="flex-1">{g.label}</span>
              {badge(i.href) > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${act ? "bg-white text-emerald-700" : "bg-amber-500 text-white"}`}>{fmt(badge(i.href))}</span>
              )}
            </Link>
          );
        }
        return (
          <div key={g.label}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [g.label]: isOpen }))}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${groupActive ? "text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
            >
              <Icon size={18} className={groupActive ? "text-emerald-600" : "text-slate-400"} />
              <span className="flex-1 text-left">{g.label}</span>
              {!isOpen && groupTotal(g) > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{fmt(groupTotal(g))}</span>
              )}
              <ChevronDown size={16} className={`text-slate-400 transition ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            {isOpen && (
              <div className="mb-1 ml-5 border-l border-slate-200 pl-3">
                {g.items.map((i) => {
                  const act = i.href === best;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`relative flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${act ? "bg-emerald-50 font-semibold text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                    >
                      {act && <span className="absolute -left-[13px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-emerald-600" />}
                      <span className="truncate">{i.label}</span>
                      {badge(i.href) > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{fmt(badge(i.href))}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const user = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">{initial}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800">{name}</div>
          <div className="truncate text-xs text-slate-500">{roles}</div>
        </div>
        <form action="/logout" method="post">
          <button title="Keluar" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
            <LogOut size={18} />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
        {brand}
        {menu}
        {user}
      </aside>

      {/* Laci menu HP */}
      <div className={`fixed inset-0 z-50 lg:hidden print:hidden ${open ? "" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-slate-900/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <button className="absolute right-3 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="Tutup menu">
            <X size={20} />
          </button>
          {brand}
          {menu}
          {user}
        </aside>
      </div>

      {/* Bilah atas */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur lg:ml-64 print:hidden">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
          <button onClick={() => setOpen(true)} className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Buka menu">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            {current ? (
              <div className="flex items-center gap-1.5 truncate text-sm">
                <span className="hidden text-slate-400 sm:inline">{current.group}</span>
                <span className="hidden text-slate-300 sm:inline">/</span>
                <span className="truncate font-semibold text-slate-800">{current.label}</span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-slate-800">{company}</span>
            )}
          </div>
          <span suppressHydrationWarning className="hidden text-xs text-slate-400 md:block">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </span>
          <Link href="/notifikasi" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Notifikasi">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 lg:hidden">{initial}</div>
        </div>
      </header>
    </>
  );
}