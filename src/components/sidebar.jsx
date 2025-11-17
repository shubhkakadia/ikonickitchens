"use client";
import {
  LayoutDashboard,
  IdCardLanyard,
  Settings,
  User,
  PanelsTopLeft,
  InspectionPanel,
  Warehouse,
  Landmark,
  LogOut,
  SquareArrowOutUpRight,
  ChevronDown,
  ChevronUp,
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
import axios from "axios";
import versions from "@/config/versions.json";

export default function sidebar() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { logout, getToken } = useAuth();
  const sessionToken = getToken();
  const { activeTab } = useSelector((state) => state.tabs);
  const router = useRouter();
  const [clientNames, setClientNames] = useState([]);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [suppliersDropdownOpen, setSuppliersDropdownOpen] = useState(false);
  const [inventoryDropdownOpen, setInventoryDropdownOpen] = useState(false);
  const navdata = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin/dashboard" },
    { icon: IdCardLanyard, label: "Employees", href: "/admin/employees" },
    { icon: User, label: "Clients", href: "/admin/clients" },
    { icon: PanelsTopLeft, label: "Projects", href: "/admin/projects" },
    { icon: InspectionPanel, label: "Suppliers", href: "/admin/suppliers" },
    { icon: Warehouse, label: "Inventory", href: "/admin/inventory" },
    { icon: Landmark, label: "Finance", href: "/admin/finance" },
  ];

  const projectData = [
    {
      id: 1,
      buildername: "Builder 1",
      builderid: "1",
    },
    {
      id: 2,
      buildername: "Builder 2",
      builderid: "2",
    },
    {
      id: 3,
      buildername: "Builder 3",
      builderid: "3",
    },
    {
      id: 4,
      buildername: "Builder 4",
      builderid: "4",
    },
    {
      id: 5,
      buildername: "Builder 5",
      builderid: "5",
    },
  ];

  const getClientNames = async () => {
    try {
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/client/allnames",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...{},
        },
        data: {},
      };

      axios
        .request(config)
        .then((response) => {
          setClientNames(response.data.data);
          // filter the client with clinet_type builder
          setClientNames(
            response.data.data.filter(
              (client) => client.client_type === "builder"
            )
          );
        })
        .catch((error) => {
          console.log(error);
          setClientNames([]);
        });
    } catch (error) {
      console.log(error);
      setClientNames([]);
    }
  };

  useEffect(() => {
    getClientNames();
  }, []);
  return (
    <div className="bg-slate-900 w-60 h-screen border-r border-slate-800">
      <div className="flex flex-col h-full px-3 py-3 gap-3">
        <Link href="/" className="flex flex-col items-center gap-1 py-1">
          <Image
            loading="lazy"
            src="/logo.webp"
            alt="logo"
            width={120}
            height={120}
            className="drop-shadow-sm"
          />
        </Link>

        <div className="flex flex-col justify-between flex-1 min-h-0 gap-3">
          <div className="flex flex-col overflow-y-auto pr-1 gap-1">
            {navdata.map((item) => {
              // Check if this item is active based on the current active tab href
              const isActive = activeTab.href === item.href;
              if (item.label === "Projects") {
                const isProjectsActive =
                  activeTab.href.startsWith("/admin/projects");
                return (
                  <div key={item.href} className="space-y-1">
                    <div
                      className={`w-full rounded-md border transition-all duration-200 flex items-center gap-2 px-3 py-2 ${
                        isProjectsActive
                          ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      {/* Main Projects button area */}
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
                          className={`w-4 h-4 ${
                            isProjectsActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-white"
                          }`}
                        />
                        <h1
                          className={`text-sm font-medium ${
                            isProjectsActive
                              ? "text-white"
                              : "text-slate-300 group-hover:text-white"
                          }`}
                        >
                          {item.label}
                        </h1>
                      </button>

                      {/* Chevron button for dropdown toggle */}
                      <button
                        onClick={() => setProjectDropdownOpen((prev) => !prev)}
                        className="p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                        aria-label={
                          projectDropdownOpen
                            ? "Close projects dropdown"
                            : "Open projects dropdown"
                        }
                      >
                        {projectDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        )}
                      </button>

                      {/* New tab button */}
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
                    {projectDropdownOpen && (
                      <div className="mt-1 space-y-1">
                        {[
                          {
                            name: "Lots at a Glance",
                            href: "/admin/projects/lotatglance",
                          },
                        ].map((link) => {
                          const isActiveSub = activeTab.href === link.href;
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
                              className={`w-full text-left cursor-pointer px-3 py-1.5 rounded-md border transition-all duration-200 flex items-center gap-2 ${
                                isActiveSub
                                  ? "bg-slate-800 text-white border-slate-700"
                                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                              }`}
                            >
                              <span className="text-xs font-medium">
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
              if (item.label === "Suppliers") {
                const isSuppliersActive =
                  activeTab.href.startsWith("/admin/suppliers");
                return (
                  <div key={item.href} className="space-y-1">
                    <div
                      className={`w-full rounded-md border transition-all duration-200 flex items-center gap-2 px-3 py-2 ${
                        isSuppliersActive
                          ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      {/* Main Suppliers button area */}
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
                          className={`w-4 h-4 ${
                            isSuppliersActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-white"
                          }`}
                        />
                        <h1
                          className={`text-sm font-medium ${
                            isSuppliersActive
                              ? "text-white"
                              : "text-slate-300 group-hover:text-white"
                          }`}
                        >
                          {item.label}
                        </h1>
                      </button>

                      {/* Chevron button for dropdown toggle */}
                      <button
                        onClick={() =>
                          setSuppliersDropdownOpen((prev) => !prev)
                        }
                        className="p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                        aria-label={
                          suppliersDropdownOpen
                            ? "Close suppliers dropdown"
                            : "Open suppliers dropdown"
                        }
                      >
                        {suppliersDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        )}
                      </button>

                      {/* New tab button */}
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

                    {suppliersDropdownOpen && (
                      <div className="mt-1 space-y-1">
                        {[
                          {
                            name: "Materials to Order",
                            href: "/admin/suppliers/materialstoorder",
                          },
                          {
                            name: "Purchase Order",
                            href: "/admin/suppliers/purchaseorder",
                          },
                        ].map((link) => {
                          const isActiveSub = activeTab.href === link.href;
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
                              className={`w-full text-left cursor-pointer px-3 py-1.5 rounded-md border transition-all duration-200 flex items-center gap-2 ${
                                isActiveSub
                                  ? "bg-slate-800 text-white border-slate-700"
                                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                              }`}
                            >
                              <span className="text-xs font-medium">
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
              if (item.label === "Inventory") {
                const isInventoryActive =
                  activeTab.href.startsWith("/admin/inventory");
                return (
                  <div key={item.href} className="space-y-1">
                    <div
                      className={`w-full rounded-md border transition-all duration-200 flex items-center gap-2 px-3 py-2 ${
                        isInventoryActive
                          ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                      }`}
                    >
                      {/* Main Inventory button area */}
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
                          className={`w-4 h-4 ${
                            isInventoryActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-white"
                          }`}
                        />
                        <h1
                          className={`text-sm font-medium ${
                            isInventoryActive
                              ? "text-white"
                              : "text-slate-300 group-hover:text-white"
                          }`}
                        >
                          {item.label}
                        </h1>
                      </button>

                      {/* Chevron button for dropdown toggle */}
                      <button
                        onClick={() =>
                          setInventoryDropdownOpen((prev) => !prev)
                        }
                        className="p-1.5 rounded-md hover:bg-slate-700/70 transition-colors duration-200 cursor-pointer"
                        aria-label={
                          inventoryDropdownOpen
                            ? "Close inventory dropdown"
                            : "Open inventory dropdown"
                        }
                      >
                        {inventoryDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white" />
                        )}
                      </button>

                      {/* New tab button */}
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

                    {inventoryDropdownOpen && (
                      <div className="mt-1 space-y-1">
                        {[
                          {
                            name: "Used Material",
                            href: "/admin/inventory/usedmaterial",
                          },
                        ].map((link) => {
                          const isActiveSub = activeTab.href === link.href;
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
                              className={`w-full text-left cursor-pointer px-3 py-1.5 rounded-md border transition-all duration-200 flex items-center gap-2 ${
                                isActiveSub
                                  ? "bg-slate-800 text-white border-slate-700"
                                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                              }`}
                            >
                              <span className="text-xs font-medium">
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
                  className={`cursor-pointer rounded-md px-3 py-2 transition-all duration-200 flex items-center gap-2 border ${
                    isActive
                      ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                      : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
                  }`}
                >
                  <item.icon
                    className={`w-4 h-4 ${
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-white"
                    }`}
                  />
                  <div className="flex items-center gap-2 w-full">
                    <h1
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-white"
                          : "text-slate-300 group-hover:text-white"
                      }`}
                    >
                      {item.label}
                    </h1>
                  </div>
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
              className={`cursor-pointer rounded-md px-3 py-2 border transition-all duration-200 flex items-center gap-2 ${
                activeTab.href === "/admin/settings"
                  ? "border-slate-600 bg-slate-800 text-white shadow-sm"
                  : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <Settings
                className={`w-4 h-4 ${
                  activeTab.href === "/admin/settings"
                    ? "text-white"
                    : "text-slate-400 group-hover:text-white"
                }`}
              />
              <h1
                className={`text-sm font-medium ${
                  activeTab.href === "/admin/settings"
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
                className={`cursor-pointer rounded-md px-3 py-2 transition-all duration-200 flex items-center gap-2 border ${
                  pathname === "/admin/logout"
                    ? "border-red-200/60 bg-red-50 text-red-700 shadow-sm"
                    : "border-transparent text-slate-300 hover:border-red-200 hover:bg-red-50/30 hover:text-red-500"
                }`}
              >
                <LogOut
                  className={`w-4 h-4 ${
                    pathname === "/admin/logout"
                      ? "text-red-700"
                      : "text-red-400 "
                  }`}
                />
                <h1
                  className={`text-sm font-medium ${
                    pathname === "/admin/logout"
                      ? "text-red-700"
                      : "text-red-400 "
                  }`}
                >
                  Logout
                </h1>
              </div>
            </button>

            {/* Version Indicator */}
            <p className="text-xs text-slate-500/80 text-center mt-1 px-2">
              v{versions.version}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
