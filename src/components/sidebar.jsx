"use client";
import {
  LayoutDashboard,
  IdCardLanyard,
  Settings,
  User,
  PanelsTopLeft,
  InspectionPanel,
  Warehouse,
  LogOut,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Settings2,
  ArrowLeftToLine,
  ArrowRightToLine,
  CalendarDays,
  ListTodo,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDispatch, useSelector } from "react-redux";
import {
  togglePinned,
  toggleEmployeeDropdown,
  toggleProjectDropdown,
  toggleSuppliersDropdown,
  toggleInventoryDropdown,
} from "@/state/reducer/sidebar";
import versions from "@/config/versions.json";
// The sidebar is the one dark surface in the admin (DESIGN.md 15.6). The navy
// `primary` ring would vanish on slate-900, so keyboard focus uses slate-300.
const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300";

// Item chrome: idle, hover and active come straight from 15.6.
const ITEM_BASE =
  "group flex items-center gap-2 rounded-lg border text-sm font-medium transition-colors duration-200";
const ITEM_IDLE =
  "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-white";
const ITEM_ACTIVE = "border-slate-600 bg-slate-800 text-white";

const itemPadding = (isExpanded) =>
  isExpanded ? "px-3 py-2" : "px-2 py-2 justify-center";

const iconClass = (isActive) =>
  `w-4 h-4 shrink-0 ${
    isActive ? "text-white" : "text-slate-400 group-hover:text-white"
  }`;

const NAV_ITEMS = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/admin/dashboard",
    subtabs: [],
  },
  {
    icon: ListTodo,
    label: "To-do",
    href: "/admin/todo",
    subtabs: [],
  },
  {
    icon: CalendarDays,
    label: "Calendar",
    href: "/admin/calendar",
    subtabs: [],
  },
  {
    icon: IdCardLanyard,
    label: "Employees",
    href: "/admin/employees",
    toggle: toggleEmployeeDropdown,
    openKey: "employeeDropdownOpen",
    subtabs: [{ name: "Clock punches", href: "/admin/employees/punches" }],
  },
  {
    icon: User,
    label: "Clients",
    href: "/admin/clients",
    subtabs: [],
  },
  {
    icon: PanelsTopLeft,
    label: "Projects",
    href: "/admin/projects",
    toggle: toggleProjectDropdown,
    openKey: "projectDropdownOpen",
    subtabs: [
      { name: "Lots at a glance", href: "/admin/projects/lotatglance" },
      { name: "Site measurements", href: "/admin/projects/sitemeasurements" },
    ],
  },
  {
    icon: InspectionPanel,
    label: "Suppliers",
    href: "/admin/suppliers",
    toggle: toggleSuppliersDropdown,
    openKey: "suppliersDropdownOpen",
    subtabs: [
      {
        name: "Materials to order",
        href: "/admin/suppliers/materialstoorder",
      },
      { name: "Purchase orders", href: "/admin/suppliers/purchaseorder" },
      { name: "Statements", href: "/admin/suppliers/statements" },
    ],
  },
  {
    icon: Warehouse,
    label: "Inventory",
    href: "/admin/inventory",
    toggle: toggleInventoryDropdown,
    openKey: "inventoryDropdownOpen",
    subtabs: [{ name: "Used material", href: "/admin/inventory/usedmaterial" }],
  },
  {
    icon: Trash2,
    label: "Deleted media",
    href: "/admin/deletefiles",
    subtabs: [],
  },
  {
    icon: FileText,
    label: "Logs",
    href: "/admin/logs",
    subtabs: [],
  },
  {
    icon: Settings2,
    label: "Config",
    href: "/admin/config",
    subtabs: [],
  },
];

// A leaf link (no sub-pages): icon, label when expanded, accessible name always.
function NavLink({ item, isActive, isExpanded }) {
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      title={!isExpanded ? item.label : undefined}
      className={`${ITEM_BASE} ${FOCUS_RING} ${itemPadding(isExpanded)} ${
        isActive ? ITEM_ACTIVE : ITEM_IDLE
      }`}
    >
      <item.icon className={iconClass(isActive)} aria-hidden="true" />
      {isExpanded && <span className="flex-1 truncate">{item.label}</span>}
    </Link>
  );
}

export default function Sidebar() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { logout } = useAuth();
  const sidebarState = useSelector((state) => state.sidebar);
  const { isPinned } = sidebarState;
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isPinned || isHovered;

  // Keyboard users get the labels too: expand when focus arrives by keyboard,
  // collapse when it leaves. A mouse click must not keep the sidebar open.
  const handleFocus = (event) => {
    if (!isPinned && event.target.matches(":focus-visible")) {
      setIsHovered(true);
    }
  };
  const handleBlur = (event) => {
    if (!isPinned && !event.currentTarget.contains(event.relatedTarget)) {
      setIsHovered(false);
    }
  };

  const isSettingsActive = pathname === "/admin/settings";

  return (
    <div
      className={`bg-slate-900 h-screen border-r ${
        isExpanded ? "w-60" : "w-16"
      } ${
        !isPinned && isExpanded
          ? "fixed left-0 top-0 z-30 border-slate-700"
          : "relative border-slate-800"
      }`}
      onMouseEnter={() => !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isPinned && setIsHovered(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="flex flex-col h-full px-3 py-4 gap-4">
        {/* Logo and pin toggle */}
        <div className="flex items-center justify-between gap-2">
          {isExpanded ? (
            <>
              <Link
                href="/"
                aria-label="Ikonic Kitchens and Cabinets home"
                className={`flex flex-col items-center gap-2 py-2 flex-1 rounded-lg ${FOCUS_RING}`}
              >
                <Image
                  loading="lazy"
                  src="/logo.webp"
                  alt=""
                  width={120}
                  height={120}
                />
              </Link>
              <button
                type="button"
                onClick={() => dispatch(togglePinned())}
                aria-pressed={isPinned}
                className={`cursor-pointer p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-200 shrink-0 ${FOCUS_RING}`}
                aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
                title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
              >
                {isPinned ? (
                  <ArrowLeftToLine className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <ArrowRightToLine className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => dispatch(togglePinned())}
              aria-label="Pin sidebar open"
              title="Pin sidebar open"
              className={`cursor-pointer py-2 rounded-lg hover:bg-slate-800 transition-colors duration-200 w-full flex items-center justify-center ${FOCUS_RING}`}
            >
              <Image
                src="/logo.webp"
                alt=""
                width={150}
                height={150}
                className="w-12 h-12 object-contain"
              />
            </button>
          )}
        </div>

        <div className="flex flex-col justify-between flex-1 min-h-0 gap-4">
          <nav
            aria-label="Main navigation"
            className="flex flex-col overflow-y-auto pr-1 gap-1"
          >
            {NAV_ITEMS.map((item) => {
              const inSection =
                pathname === item.href || pathname.startsWith(item.href + "/");

              if (item.subtabs.length === 0) {
                return (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={inSection}
                    isExpanded={isExpanded}
                  />
                );
              }

              const dropdownOpen = sidebarState[item.openKey];
              const activeSub = item.subtabs.find(
                (sub) => pathname === sub.href,
              );
              // Exactly one active item (15.6): the parent only shows active
              // when none of its visible sub-pages is.
              const isParentActive = inSection && !(dropdownOpen && activeSub);
              const listId = `sidebar-sub-${item.label
                .toLowerCase()
                .replace(/\s+/g, "-")}`;

              return (
                <div key={item.href} className="space-y-1">
                  <div
                    className={`${ITEM_BASE} ${itemPadding(isExpanded)} ${
                      isParentActive ? ITEM_ACTIVE : ITEM_IDLE
                    }`}
                  >
                    <Link
                      href={item.href}
                      aria-current={isParentActive ? "page" : undefined}
                      aria-label={item.label}
                      title={!isExpanded ? item.label : undefined}
                      className={`flex items-center gap-2 rounded-sm ${
                        isExpanded ? "flex-1 min-w-0" : ""
                      } ${FOCUS_RING}`}
                    >
                      <item.icon
                        className={iconClass(isParentActive)}
                        aria-hidden="true"
                      />
                      {isExpanded && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                    </Link>

                    {isExpanded && (
                      <button
                        type="button"
                        onClick={() => dispatch(item.toggle())}
                        aria-expanded={dropdownOpen}
                        aria-controls={listId}
                        aria-label={`${dropdownOpen ? "Collapse" : "Expand"} ${item.label.toLowerCase()} pages`}
                        className={`cursor-pointer p-1.5 rounded-lg text-slate-400 hover:bg-slate-700/70 hover:text-white transition-colors duration-200 ${FOCUS_RING}`}
                      >
                        {dropdownOpen ? (
                          <ChevronUp className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>

                  {dropdownOpen && (
                    <div id={listId} className="space-y-1">
                      {item.subtabs.map((link) => {
                        const isActiveSub = pathname === link.href;
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            aria-current={isActiveSub ? "page" : undefined}
                            aria-label={link.name}
                            title={!isExpanded ? link.name : undefined}
                            className={`${ITEM_BASE} ${FOCUS_RING} ${itemPadding(
                              isExpanded,
                            )} ${isActiveSub ? ITEM_ACTIVE : ITEM_IDLE}`}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-500 group-hover:bg-slate-300"
                              aria-hidden="true"
                            />
                            {isExpanded && (
                              <span className="flex-1 truncate">
                                {link.name}
                              </span>
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

          <div className="flex flex-col gap-2">
            <Link
              href="/admin/settings"
              aria-current={isSettingsActive ? "page" : undefined}
              aria-label="Settings"
              title={!isExpanded ? "Settings" : undefined}
              className={`${ITEM_BASE} ${FOCUS_RING} ${itemPadding(
                isExpanded,
              )} ${isSettingsActive ? ITEM_ACTIVE : ITEM_IDLE}`}
            >
              <Settings
                className={iconClass(isSettingsActive)}
                aria-hidden="true"
              />
              {isExpanded && <span className="flex-1 truncate">Settings</span>}
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              aria-label="Log out"
              title={!isExpanded ? "Log out" : undefined}
              className={`cursor-pointer w-full text-left ${ITEM_BASE} ${FOCUS_RING} ${itemPadding(
                isExpanded,
              )} border-transparent text-red-300 hover:border-slate-700 hover:bg-slate-800/60 hover:text-red-200`}
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              {isExpanded && <span className="flex-1 truncate">Log out</span>}
            </button>

            {isExpanded && (
              <p className="text-xs text-slate-500 text-center mt-2 px-2">
                v{versions.version}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
