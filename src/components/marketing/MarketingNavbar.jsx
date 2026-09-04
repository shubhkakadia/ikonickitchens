"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Work", href: "/portfolio", match: "/portfolio" },
  { label: "Services", href: "/services", match: "/services" },
  { label: "Process", href: "/process", match: "/process" },
  { label: "Workshop", href: "/workshop", match: "/workshop" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="marketing-header">
      <div className="marketing-header__inner">
        <Link
          href="/"
          className="marketing-brand"
          aria-label="Ikonic Kitchens and Cabinets home"
        >
          <Image
            src="/logo.webp"
            alt="Ikonic Kitchens and Cabinets"
            width={350}
            height={154}
            className="marketing-brand__logo"
            priority
          />
        </Link>

        <nav className="marketing-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active =
              pathname === item.match || pathname.startsWith(`${item.match}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="marketing-nav__link"
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          <Link href="/inquiries" className="marketing-nav__cta">
            Request a quote
          </Link>
        </nav>
      </div>
    </header>
  );
}
