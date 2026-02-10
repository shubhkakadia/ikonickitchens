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
  SquareArrowOutUpRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  Settings2,
  CircleSmall,
  ArrowLeftToLine,
  ArrowRightToLine,
  CalendarDays,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDispatch, useSelector } from "react-redux";
import { addTab, replaceTab } from "@/state/reducer/tabs";
import {
  togglePinned,
  toggleProjectDropdown,
  toggleSuppliersDropdown,
  toggleInventoryDropdown,
} from "@/state/reducer/sidebar";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import versions from "@/config/versions.json";

export default function Sidebar() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { logout } = useAuth();
  const { activeTab } = useSelector((state) => state.tabs);
  const {
    isPinned,
    projectDropdownOpen,
    suppliersDropdownOpen,
    inventoryDropdownOpen,
  } = useSelector((state) => state.sidebar);
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const isExpanded = isPinned || isHovered;

  const navdata = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/admin/dashboard",
      access: false,
      subtabs: [],
    },
    {
      icon: CalendarDays,
      label: "Calendar",
      href: "/admin/calendar",
      access: false,
      subtabs: [],
    },
    {
      icon: IdCardLanyard,
      label: "Employees",
      href: "/admin/employees",
      access: false,
      subtabs: [],
    },
    {
      icon: User,
      label: "Clients",
      href: "/admin/clients",
      access: false,
      subtabs: [],
    },
    {
      icon: PanelsTopLeft,
      label: "Projects",
      href: "/admin/projects",
      access: false,
      subtabs: [
        {
          name: "Lots at a Glance",
          href: "/admin/projects/lotatglance",
        },
        {
          name: "Site Measurements",
          href: "/admin/projects/sitemeasurements",
        },
      ],
    },
    {
      icon: InspectionPanel,
      label: "Suppliers",
      href: "/admin/suppliers",
      access: false,
      subtabs: [
        {
          name: "Materials to Order",
          href: "/admin/suppliers/materialstoorder",
          access: false,
        },
        {
          name: "Purchase Order",
          href: "/admin/suppliers/purchaseorder",
          access: false,
        },
        {
          name: "Statements",
          href: "/admin/suppliers/statements",
          access: false,
        },
      ],
    },
    {
      icon: Warehouse,
      label: "Inventory",
      href: "/admin/inventory",
      access: false,
      subtabs: [
        {
          name: "Used Material",
          href: "/admin/inventory/usedmaterial",
          access: false,
        },
      ],
    },
    {
      icon: Trash2,
      label: "Deleted Media",
      href: "/admin/deletefiles",
      subtabs: [],
      access: false,
    },
    {
      icon: FileText,
      label: "Logs",
      href: "/admin/logs",
      subtabs: [],
      access: false,
    },
    {
      icon: Settings2,
      label: "Config",
      href: "/admin/config",
      subtabs: [],
      access: false,
    },
  ];

  return (
    <div
      className={`bg-slate-900 h-screen border-r border-slate-800 ${
        isExpanded ? "w-60" : "w-16"
      } ${!isPinned && isExpanded ? "fixed left-0 top-0 z-50 shadow-2xl" : "relative"}`}
      onMouseEnter={() => !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isPinned && setIsHovered(false)}
    >
      <div className="flex flex-col h-full px-3 py-4 gap-4">
        {/* Header with logo and toggle button */}
        <div className="flex items-center justify-between gap-2">
          {isExpanded ? (
            <>
              <Link
                href="/"
                className="flex flex-col items-center gap-2 py-2 flex-1"
              >
                <Image
                  loading="lazy"
                  src="/logo.webp"
                  alt="logo"
                  width={120}
                  height={120}
                  className="drop-shadow-sm"
                />
              </Link>
              <button
                onClick={() => dispatch(togglePinned())}
                className="cursor-pointer p-2 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
                aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
              >
                {isPinned ? (
                  <ArrowLeftToLine className="w-5 h-5 text-slate-400" />
                ) : (
                  <ArrowRightToLine className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </>
          ) : (
            <div
              onClick={() => dispatch(togglePinned())}
              className="cursor-pointer py-2 rounded-lg hover:bg-slate-800 transition-colors w-full flex items-center justify-center"
              aria-label="Pin sidebar open"
            >
              <Image
                src="/logo.webp"
                alt="logo"
                width={150}
                height={150}
                className="w-12 h-12 object-contain"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between flex-1 min-h-0 gap-4">
          <div className="flex flex-col overflow-y-auto pr-1 gap-1">
            {navdata.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.subtabs.length === 0 &&
                  pathname.startsWith(item.href + "/"));
              const isParentActive = pathname.startsWith(item.href);

              if (item.subtabs.length > 0) {
                const dropdownOpen =
                  item.label === "Projects"
                    ? projectDropdownOpen
                    : item.label === "Suppliers"
                      ? suppliersDropdownOpen
                      : item.label === "Inventory"
                        ? inventoryDropdownOpen
                        : false;

                const toggleDropdown = () => {
                  if (item.label === "Projects")
                    dispatch(toggleProjectDropdown());
                  else if (item.label === "Suppliers")
                    dispatch(toggleSuppliersDropdown());
                  else if (item.label === "Inventory")
                    dispatch(toggleInventoryDropdown());
                };

                return (
                  <div key={item.href} className="space-y-1">
                    <div
                      className={`w-full rounded-lg border transition-all duration-200 flex items-center gap-2 ${
                        isExpanded ? "px-3 py-2" : "px-2 py-2 justify-center"
                      } ${
                        isParentActive
                          ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      <button
                        onClick={() => {
                          router.push(item.href);
                          dispatch(
                            replaceTab({
                              id: uuidv4(),
                              title: item.label,
                              href: item.href,
                            }),
                          );
                        }}
                        className={`flex items-center gap-2 cursor-pointer text-sm ${
                          isExpanded ? "flex-1" : ""
                        }`}
                        title={!isExpanded ? item.label : ""}
                      >
                        <item.icon
                          className={`w-4 h-4 shrink-0 ${
                            isParentActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-white"
                          }`}
                        />
                        {isExpanded && (
                          <h1
                            className={`text-sm font-medium ${
                              isParentActive
                                ? "text-white"
                                : "text-slate-300 group-hover:text-white"
                            }`}
                          >
                            {item.label}
                          </h1>
                        )}
                      </button>

                      {isExpanded && (
                        <>
                          <button
                            onClick={toggleDropdown}
                            className="p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                            aria-label={
                              dropdownOpen
                                ? `Close ${item.label.toLowerCase()} dropdown`
                                : `Open ${item.label.toLowerCase()} dropdown`
                            }
                          >
                            {dropdownOpen ? (
                              <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
                            )}
                          </button>

                          <div
                            className="p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              dispatch(
                                addTab({
                                  id: uuidv4(),
                                  title: item.label,
                                  href: item.href,
                                }),
                              );
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                dispatch(
                                  addTab({
                                    id: uuidv4(),
                                    title: item.label,
                                    href: item.href,
                                  }),
                                );
                              }
                            }}
                            aria-label={`Open ${item.label} in new tab`}
                          >
                            <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                          </div>
                        </>
                      )}
                    </div>

                    {dropdownOpen && (
                      <div className="space-y-1.5">
                        {item.subtabs.map((link) => {
                          const isActiveSub = pathname === link.href;
                          return (
                            <button
                              key={link.href}
                              onClick={() => {
                                router.push(link.href);
                                dispatch(
                                  replaceTab({
                                    id: uuidv4(),
                                    title: link.name,
                                    href: link.href,
                                  }),
                                );
                              }}
                              className={`w-full text-left cursor-pointer rounded-lg border transition-all duration-200 flex items-center gap-2 ${
                                isExpanded
                                  ? "px-3 py-2"
                                  : "px-2 py-2 justify-center"
                              } ${
                                isActiveSub
                                  ? "bg-slate-800 text-white border-slate-700"
                                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                              }`}
                              title={!isExpanded ? link.name : ""}
                            >
                              {!isExpanded ? (
                                <CircleSmall
                                  className="w-2 h-2 shrink-0 text-slate-400"
                                  fill="currentColor"
                                />
                              ) : (
                                <>
                                  <CircleSmall
                                    className="w-2 h-2 shrink-0 text-slate-400"
                                    fill="currentColor"
                                  />

                                  <span className="text-sm font-medium">
                                    {link.name}
                                  </span>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      dispatch(
                                        addTab({
                                          id: uuidv4(),
                                          title: link.name,
                                          href: link.href,
                                        }),
                                      );
                                    }}
                                    className="ml-auto p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                                  >
                                    <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                                  </div>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  onClick={() => {
                    router.push(item.href);
                    dispatch(
                      replaceTab({
                        id: uuidv4(),
                        title: item.label,
                        href: item.href,
                      }),
                    );
                  }}
                  key={item.href}
                  className={`cursor-pointer rounded-lg transition-all duration-200 flex items-center gap-2 border ${
                    isExpanded ? "px-3 py-2.5" : "px-2 py-2 justify-center"
                  } ${
                    isActive
                      ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                      : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                  }`}
                  title={!isExpanded ? item.label : ""}
                >
                  <item.icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  {isExpanded && (
                    <>
                      <h1
                        className={`text-sm font-medium flex-1 text-left ${
                          isActive
                            ? "text-white"
                            : "text-slate-300 group-hover:text-white"
                        }`}
                      >
                        {item.label}
                      </h1>
                      <div
                        className="p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch(
                            addTab({
                              id: uuidv4(),
                              title: item.label,
                              href: item.href,
                            }),
                          );
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            dispatch(
                              addTab({
                                id: uuidv4(),
                                title: item.label,
                                href: item.href,
                              }),
                            );
                          }
                        }}
                        aria-label={`Open ${item.label} in new tab`}
                      >
                        <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                router.push("/admin/settings");
                dispatch(
                  replaceTab({
                    id: uuidv4(),
                    title: "Settings",
                    href: "/admin/settings",
                  }),
                );
              }}
              className={`cursor-pointer rounded-lg border transition-all duration-200 flex items-center gap-2 ${
                isExpanded ? "px-3 py-2.5" : "px-2 py-2 justify-center"
              } ${
                pathname === "/admin/settings"
                  ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
              title={!isExpanded ? "Settings" : ""}
            >
              <Settings
                className={`w-4 h-4 shrink-0 ${
                  pathname === "/admin/settings"
                    ? "text-white"
                    : "text-slate-400 group-hover:text-white"
                }`}
              />
              {isExpanded && (
                <>
                  <h1
                    className={`text-sm font-medium ${
                      pathname === "/admin/settings"
                        ? "text-white"
                        : "text-slate-300 group-hover:text-white"
                    }`}
                  >
                    Settings
                  </h1>
                  <div
                    className="ml-auto p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(
                        addTab({
                          id: uuidv4(),
                          title: "Settings",
                          href: "/admin/settings",
                        }),
                      );
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        dispatch(
                          addTab({
                            id: uuidv4(),
                            title: "Settings",
                            href: "/admin/settings",
                          }),
                        );
                      }
                    }}
                    aria-label="Open Settings in new tab"
                  >
                    <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                  </div>
                </>
              )}
            </button>

            <button
              onClick={() => logout()}
              title={!isExpanded ? "Logout" : ""}
            >
              <div
                className={`cursor-pointer rounded-lg transition-all duration-200 flex items-center gap-2 border ${
                  isExpanded ? "px-3 py-2.5" : "px-2 py-2 justify-center"
                } ${
                  pathname === "/admin/logout"
                    ? "border-red-200/60 bg-red-50 text-red-700 shadow-sm"
                    : "border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50/30 hover:text-red-500"
                }`}
              >
                <LogOut
                  className={`w-4 h-4 shrink-0 ${
                    pathname === "/admin/logout"
                      ? "text-red-700"
                      : "text-red-400"
                  }`}
                />
                {isExpanded && (
                  <h1
                    className={`text-sm font-medium ${
                      pathname === "/admin/logout"
                        ? "text-red-700"
                        : "text-red-400"
                    }`}
                  >
                    Logout
                  </h1>
                )}
              </div>
            </button>

            {isExpanded && (
              <p className="text-xs text-slate-500/80 text-center mt-2 px-2">
                v{versions.version}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
