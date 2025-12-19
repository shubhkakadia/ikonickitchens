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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDispatch, useSelector } from "react-redux";
import { addTab, replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import versions from "@/config/versions.json";

export default function Sidebar() {

  const dispatch = useDispatch();
  const pathname = usePathname();
  const { logout } = useAuth();
  const { activeTab } = useSelector((state) => state.tabs);
  const router = useRouter();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(true);
  const [suppliersDropdownOpen, setSuppliersDropdownOpen] = useState(true);
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(true);
  const navdata = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/admin/dashboard",
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
    { icon: User, label: "Clients", href: "/admin/clients", access: false, subtabs: [] },
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
    // { icon: Landmark, label: "Finance", href: "/admin/finance", subtabs: [] },
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
    }
  ];

  return (
    <div className="bg-slate-900 w-60 h-screen border-r border-slate-800">
      <div className="flex flex-col h-full px-4 py-4 gap-4">
        <Link href="/" className="flex flex-col items-center gap-2 py-2">
          <Image
            loading="lazy"
            src="/logo.webp"
            alt="logo"
            width={120}
            height={120}
            className="drop-shadow-sm"
          />
        </Link>

        <div className="flex flex-col justify-between flex-1 min-h-0 gap-4">
          <div className="flex flex-col overflow-y-auto pr-1 gap-1">
            {navdata.map((item) => {
              const isActive = pathname === item.href || (item.subtabs.length === 0 && pathname.startsWith(item.href + '/'));
              const isParentActive = pathname.startsWith(item.href);

              if (item.subtabs.length > 0) {
                // Get dropdown state based on label
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
                    setProjectDropdownOpen((prev) => !prev);
                  else if (item.label === "Suppliers")
                    setSuppliersDropdownOpen((prev) => !prev);
                  else if (item.label === "Inventory")
                    setInventoryDropdownOpen((prev) => !prev);
                };

                return (
                  <div key={item.href} className="space-y-1">
                    <div
                      className={`w-full rounded-lg border transition-all duration-200 flex items-center gap-2 px-3 py-2 ${isParentActive
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
                            })
                          );
                        }}
                        className="flex items-center gap-2 flex-1 cursor-pointer text-sm"
                      >
                        <item.icon
                          className={`w-4 h-4 ${isParentActive
                            ? "text-white"
                            : "text-slate-400 group-hover:text-white"
                            }`}
                        />
                        <h1
                          className={`text-sm font-medium ${isParentActive
                            ? "text-white"
                            : "text-slate-300 group-hover:text-white"
                            }`}
                        >
                          {item.label}
                        </h1>
                      </button>

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
                            })
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
                              })
                            );
                          }
                        }}
                        aria-label={`Open ${item.label} in new tab`}
                      >
                        <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>

                    {dropdownOpen && (
                      <div className="mt-1.5 space-y-1.5 ml-2">
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
                                  })
                                );
                              }}
                              className={`w-full text-left cursor-pointer px-3 py-2 rounded-lg border transition-all duration-200 flex items-center gap-2 ${isActiveSub
                                ? "bg-slate-800 text-white border-slate-700"
                                : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                                }`}
                            >
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
                                    })
                                  );
                                }}
                                className="ml-auto p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                              >
                                <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular item without subtabs
              return (
                <button
                  onClick={() => {
                    router.push(item.href);
                    dispatch(
                      replaceTab({
                        id: uuidv4(),
                        title: item.label,
                        href: item.href,
                      })
                    );
                  }}
                  key={item.href}
                  className={`cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 flex items-center gap-2 border ${isActive
                    ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                    : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                >
                  <item.icon
                    className={`w-4 h-4 ${isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-white"
                      }`}
                  />
                  <h1
                    className={`text-sm font-medium flex-1 text-left ${isActive
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
                        })
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
                          })
                        );
                      }
                    }}
                    aria-label={`Open ${item.label} in new tab`}
                  >
                    <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                  </div>
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
                  })
                );
              }}
              className={`cursor-pointer rounded-lg px-3 py-2.5 border transition-all duration-200 flex items-center gap-2 ${pathname === "/admin/settings"
                ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                }`}
            >
              <Settings
                className={`w-4 h-4 ${pathname === "/admin/settings"
                  ? "text-white"
                  : "text-slate-400 group-hover:text-white"
                  }`}
              />
              <h1
                className={`text-sm font-medium ${pathname === "/admin/settings"
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
                    })
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
                      })
                    );
                  }
                }}
                aria-label="Open Settings in new tab"
              >
                <SquareArrowOutUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
              </div>
            </button>

            <button onClick={() => logout()}>
              <div
                className={`cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-200 flex items-center gap-2 border ${pathname === "/admin/logout"
                  ? "border-red-200/60 bg-red-50 text-red-700 shadow-sm"
                  : "border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50/30 hover:text-red-500"
                  }`}
              >
                <LogOut
                  className={`w-4 h-4 ${pathname === "/admin/logout"
                    ? "text-red-700"
                    : "text-red-400"
                    }`}
                />
                <h1
                  className={`text-sm font-medium ${pathname === "/admin/logout"
                    ? "text-red-700"
                    : "text-red-400"
                    }`}
                >
                  Logout
                </h1>
              </div>
            </button>

            <p className="text-xs text-slate-500/80 text-center mt-2 px-2">
              v{versions.version}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
