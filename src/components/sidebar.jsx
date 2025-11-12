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
    <div className="flex flex-col bg-slate-800 w-64 h-screen py-4 space-y-4">
      <Link href="/" className="flex flex-col items-center">
        <Image loading="lazy" src="/logo.webp" alt="logo" width={150} height={150} />
      </Link>

      <div className="flex flex-col justify-between h-full min-h-0">
        <div className="flex flex-col overflow-y-auto pr-1">
          {navdata.map((item) => {
            // Check if this item is active based on the current active tab href
            const isActive = activeTab.href === item.href;
            if (item.label === "Projects") {
              const isProjectsActive =
                activeTab.href.startsWith("/admin/projects");
              return (
                <div key={item.href} className="mx-2 my-1">
                  <div
                    className={`w-full py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                      isProjectsActive
                        ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
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
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                    >
                      <item.icon
                        className={`w-5 h-5 ${
                          isProjectsActive
                            ? "text-white"
                            : "text-slate-400 group-hover:text-white"
                        }`}
                      />
                      <h1
                        className={`font-medium ${
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
                      className="p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
                      aria-label={
                        projectDropdownOpen
                          ? "Close projects dropdown"
                          : "Open projects dropdown"
                      }
                    >
                      {projectDropdownOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white" />
                      )}
                    </button>

                    {/* New tab button */}
                    <div
                      className="p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
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
                      <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </div>
                  </div>
                  {projectDropdownOpen && (
                    <div className="mt-1 mr-2 mb-2 space-y-1">
                      {[{
                        name: "Lots at a Glance",
                        href: "/admin/projects/lotatglance",
                      }].map((link) => {
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
                            className={`w-full text-left cursor-pointer py-2 px-3 rounded-md transition-all duration-200 flex items-center gap-2 ${
                              isActiveSub
                                ? "bg-slate-700 text-white"
                                : "text-slate-300 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            <span className="text-sm">{link.name}</span>
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
                              className="ml-auto p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
                            >
                              <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
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
              const isSuppliersActive = activeTab.href.startsWith("/admin/suppliers");
              return (
                <div key={item.href} className="mx-2 my-1">
                  <div
                    className={`w-full py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                      isSuppliersActive
                        ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20"
                        : "text-slate-300 hover:bg-slate-700 hover:text-white"
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
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                    >
                      <item.icon
                        className={`w-5 h-5 ${
                          isSuppliersActive ? "text-white" : "text-slate-400 group-hover:text-white"
                        }`}
                      />
                      <h1
                        className={`font-medium ${
                          isSuppliersActive ? "text-white" : "text-slate-300 group-hover:text-white"
                        }`}
                      >
                        {item.label}
                      </h1>
                    </button>

                    {/* Chevron button for dropdown toggle */}
                    <button
                      onClick={() => setSuppliersDropdownOpen((prev) => !prev)}
                      className="p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
                      aria-label={
                        suppliersDropdownOpen ? "Close suppliers dropdown" : "Open suppliers dropdown"
                      }
                    >
                      {suppliersDropdownOpen ? (
                        <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white" />
                      )}
                    </button>

                    {/* New tab button */}
                    <div
                      className="p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
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
                      <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </div>
                  </div>

                  {suppliersDropdownOpen && (
                    <div className="mt-1 mr-2 mb-2 space-y-1">
                      {[{
                        name: "Materials to Order",
                        href: "/admin/suppliers/materialstoorder",
                      },
                      {
                        name: "Purchase Order",
                        href: "/admin/suppliers/purchaseorder",
                      }].map((link) => {
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
                            className={`w-full text-left cursor-pointer py-2 px-3 rounded-md transition-all duration-200 flex items-center gap-2 ${
                              isActiveSub
                                ? "bg-slate-700 text-white"
                                : "text-slate-300 hover:bg-slate-700 hover:text-white"
                            }`}
                          >
                            <span className="text-sm">{link.name}</span>
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
                              className="ml-auto p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
                            >
                              <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
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
                className={`cursor-pointer mx-2 my-1 py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                  isActive
                    ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                <item.icon
                  className={`w-8 h-8 ${
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-white"
                  }`}
                />
                <div className="flex items-center gap-2 w-full">
                  <h1
                    className={`font-medium ${
                      isActive
                        ? "text-white"
                        : "text-slate-300 group-hover:text-white"
                    }`}
                  >
                    {item.label}
                  </h1>
                </div>
                <div
                  className="p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
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
                  <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col">
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
            className={`cursor-pointer mx-2 my-1 py-3 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
              activeTab.href === "/admin/settings"
                ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg shadow-slate-500/20"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <Settings
              className={`w-5 h-5 ${
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
              className="ml-auto p-1 rounded hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
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
              <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
            </div>
          </button>

          <button onClick={() => logout()}>
            <div
              className={`cursor-pointer mx-2 my-1 py-3 px-4 rounded-lg transition-all duration-200 flex items-center gap-3 group ${
                pathname === "/admin/logout"
                  ? "bg-red-50 text-red-700 shadow-sm"
                  : "text-slate-300 hover:bg-red-50 hover:text-red-600"
              }`}
            >
              <LogOut
                className={`w-5 h-5 ${
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
        </div>
      </div>
    </div>
  );
}
