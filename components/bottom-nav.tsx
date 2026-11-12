"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconHome, IconReport, IconSettings, IconTrophy } from "./icons";

const ITEMS = [
  { href: "/", label: "Dashboard", Icon: IconHome },
  { href: "/kalender", label: "Kalender", Icon: IconCalendar },
  { href: "/erfolge", label: "Erfolge", Icon: IconTrophy },
  { href: "/berichte", label: "Berichte", Icon: IconReport },
  { href: "/einstellungen", label: "Einstellungen", Icon: IconSettings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:inset-x-auto md:inset-y-0 md:left-0 md:w-56 md:border-r md:border-t-0 md:pb-0">
      <div className="hidden px-5 pb-6 pt-8 md:block">
        <div className="text-lg font-bold">Enduro One 2027</div>
      </div>
      <ul className="mx-auto flex max-w-xl justify-around md:mx-0 md:max-w-none md:flex-col md:gap-1 md:px-3">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm ${
                  active ? "text-orange-400 md:bg-zinc-900" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon width={22} height={22} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
