"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { label: "Work", href: "/portfolio", match: "/portfolio" },
  { label: "Services", href: "/services", match: "/services" },
  { label: "Process", href: "/process", match: "/process" },
  { label: "Workshop", href: "/workshop", match: "/workshop" },
];

export default function Navbar() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [hasBackground, setHasBackground] = useState(!isHomePage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isHomePage) {
      setHasBackground(true);
      return;
    }

    const updateBackground = () => {
      const carousel = document.querySelector(".marketing-hero");
      setHasBackground(
        !carousel || carousel.getBoundingClientRect().bottom <= 76,
      );
    };

    updateBackground();
    window.addEventListener("scroll", updateBackground, { passive: true });
    window.addEventListener("resize", updateBackground);

    return () => {
      window.removeEventListener("scroll", updateBackground);
      window.removeEventListener("resize", updateBackground);
    };
  }, [isHomePage]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeAtDesktopWidth = () => {
      if (window.innerWidth > 820) setMobileMenuOpen(false);
    };

    window.addEventListener("resize", closeAtDesktopWidth);
    return () => window.removeEventListener("resize", closeAtDesktopWidth);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={`marketing-header${isHomePage ? " marketing-header--over-hero" : ""}${hasBackground ? " marketing-header--solid" : ""}${mobileMenuOpen ? " marketing-header--menu-open" : ""}`}
    >
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

        <button
          type="button"
          className="marketing-menu-toggle"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-controls="marketing-primary-navigation"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <nav
          id="marketing-primary-navigation"
          className={`marketing-nav${mobileMenuOpen ? " marketing-nav--open" : ""}`}
          aria-label="Primary navigation"
        >
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
