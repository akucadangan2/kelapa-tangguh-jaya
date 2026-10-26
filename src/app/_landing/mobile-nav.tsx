"use client";
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  ["#produk", "Produk"],
  ["#cara-jual", "Cara Jual"],
  ["#aplikasi", "Aplikasi"],
  ["#pembeli", "Untuk Pembeli"],
  ["#kontak", "Kontak"],
];

export function MobileNav({ loginHref, loginLabel }: { loginHref: string; loginLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        aria-label={open ? "Tutup menu" : "Buka menu"}
        onClick={() => setOpen(!open)}
        className="grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-slate-200 bg-white shadow-lg">
          <nav className="flex flex-col px-4 py-2">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="border-b border-slate-100 py-3.5 text-[15px] font-medium text-slate-700 last:border-0">
                {label}
              </a>
            ))}
            <Link href={loginHref} className="my-3 rounded-lg border border-slate-300 py-3 text-center text-sm font-semibold text-slate-700">
              {loginLabel}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}