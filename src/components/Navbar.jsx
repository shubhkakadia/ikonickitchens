"use client";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";

export default function Navbar({ bar }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const navdata = [
    { label: "HOME", href: "/" },
    { label: "KITCHENS", href: "/kitchens" },
    { label: "LAUNDRY", href: "/laundry" },
    { label: "BATHROOM", href: "/bathroom" },
    { label: "WARDROBES", href: "/wardrobes" },
    { label: "PORTFOLIO", href: "/portfolio" },
    { label: "BLOGS", href: "/blogs" },
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div
      className={`w-full fixed top-0 left-0 z-50 ${isScrolled || bar ? "bg-gray-800/95" : "bg-gray-800/0"
        } transition-all duration-300 ease-in-out`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-2">
          <Link href="/" className="flex items-center py-2">
            <Image
              loading="lazy"
              src="/logo.webp"
              alt="Ikoniq Logo"
              width={150}
              height={24}
              className="h-10 sm:h-20 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6 xl:space-x-12">
            <Link
              href={"/"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              HOME
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/kitchens"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              KITCHENS
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/laundry"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              LAUNDRY
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/bathroom"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              BATHROOM
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/wardrobes"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              WARDROBES
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/portfolio"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              PORTFOLIO
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/blogs"}
              className="text-white hover:text-[#B92F34] font-light transition-colors duration-200 relative group text-sm xl:text-base"
            >
              BLOGS
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#B92F34] transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link
              href={"/inquiries"}
              className="bg-[#B92F34] hover:bg-[#A0252A] text-white px-4 xl:px-6 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 text-sm xl:text-base"
            >
              GET QUOTE
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="lg:hidden p-2 text-white hover:text-[#B92F34] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#B92F34] focus:ring-offset-2 rounded-lg"
            aria-label="Toggle mobile menu"
            aria-expanded={isOpen}
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center">
              <span
                className={`block w-6 h-0.5 bg-current transition-all duration-300 ease-in-out ${isOpen ? "rotate-45 translate-y-1.5" : ""
                  }`}
              ></span>
              <span
                className={`block w-6 h-0.5 bg-current transition-all duration-300 ease-in-out mt-1 ${isOpen ? "opacity-0" : ""
                  }`}
              ></span>
              <span
                className={`block w-6 h-0.5 bg-current transition-all duration-300 ease-in-out mt-1 ${isOpen ? "-rotate-45 -translate-y-1.5" : ""
                  }`}
              ></span>
            </div>
          </button>

          {/* Mobile Menu Backdrop */}
          <div
            className={`lg:hidden fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            onClick={() => setIsOpen(false)}
            style={{ top: "73px" }} // Adjust based on your navbar height
          />

          {/* Mobile Menu */}
          <div
            className={`lg:hidden absolute top-16 right-0 w-full shadow-2xl border-b transition-all duration-300 ease-in-out transform ${isOpen
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
              }`}
          >
            <nav className="space-y-1 p-6">
              {navdata.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block text-white hover:text-[#B92F34] hover:bg-gray-50 font-light transition-all duration-200 py-3 px-4 rounded-lg text-base transform ${isOpen
                      ? "translate-x-0 opacity-100"
                      : "translate-x-4 opacity-0"
                    }`}
                  style={{
                    transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
                  }}
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={"/inquiries"}
                className={`block bg-[#B92F34] hover:bg-[#A0252A] text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 text-base mt-4 text-center ${isOpen
                    ? "translate-x-0 opacity-100"
                    : "translate-x-4 opacity-0"
                  }`}
                style={{
                  transitionDelay: isOpen ? "300ms" : "0ms",
                }}
                onClick={() => setIsOpen(false)}
              >
                GET QUOTE
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
