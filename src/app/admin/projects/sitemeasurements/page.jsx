"use client";
import React, { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  MapPin,
  User,
  Clock,
  ArrowRight,
  ClipboardList,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export default function SiteMeasurementsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingLots, setPendingLots] = useState([]);
  const [doneLots, setDoneLots] = useState([]);

  // Status Dropdown State
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null);
  const [statusDropdownPositions, setStatusDropdownPositions] = useState({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchSiteMeasurements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".status-dropdown-container")) {
        setStatusDropdownOpen(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdowns when scrolling
  useEffect(() => {
    const handleScroll = () => {
      setStatusDropdownOpen(null);
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const fetchSiteMeasurements = async () => {
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "get",
        url: "/api/lot/sitemeasurements",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      };

      const response = await axios.request(config);

      if (response.data.status) {
        setPendingLots(response.data.data.pending);
        setDoneLots(response.data.data.done);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching site measurements:", error);
      setError(error.message || "Failed to fetch site measurements");
    } finally {
      setLoading(false);
    }
  };

  // Helper to check stage status
  const getStageStatus = (lot, stageName) => {
    const stage = lot.stages?.find(
      (s) => s.name.toLowerCase() === stageName.toLowerCase(),
    );
    return stage ? stage.status : "NOT_STARTED";
  };

  // Handle status square click
  const handleStatusClick = (lot, event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const dropdownKey = lot.lot_id;

    // Position dropdown below the button
    const topPosition = rect.bottom + window.scrollY + 4;
    const leftPosition = rect.left + window.scrollX;

    setStatusDropdownPositions((prev) => ({
      ...prev,
      [dropdownKey]: {
        top: topPosition,
        left: leftPosition,
      },
    }));

    setStatusDropdownOpen(
      statusDropdownOpen === dropdownKey ? null : dropdownKey,
    );
  };

  // Handle stage status update
  const handleStageStatusUpdate = async (lot, newStatus) => {
    const stageName = "Site Measurements";
    try {
      setIsUpdatingStatus(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const stageObj = lot.stages?.find(
        (s) => s.name.toLowerCase() === stageName.toLowerCase(),
      );

      if (!stageObj || !stageObj.stage_id) {
        // Create stage
        const createResponse = await axios.post(
          "/api/stage/create",
          {
            lot_id: lot.lot_id,
            name: stageName.toLowerCase(),
            status: newStatus,
            notes: "",
            startDate: null,
            endDate: null,
            assigned_to: [],
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (createResponse.data.status) {
          toast.success("Status updated successfully");
          setStatusDropdownOpen(null);
          fetchSiteMeasurements();
        } else {
          toast.error(createResponse.data.message || "Failed to update status");
        }
      } else {
        // Update stage
        const response = await axios.patch(
          `/api/stage/${stageObj.stage_id}`,
          {
            name: stageObj.name,
            status: newStatus,
            notes: stageObj.notes || "",
            startDate: stageObj.startDate || null,
            endDate: stageObj.endDate || null,
            assigned_to:
              stageObj.assigned_to?.map((a) =>
                typeof a === "string" ? a : a.employee_id || a,
              ) || [],
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.data.status) {
          toast.success("Status updated successfully");
          setStatusDropdownOpen(null);
          // Refresh data from backend
          fetchSiteMeasurements();
        } else {
          toast.error(response.data.message || "Failed to update status");
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCardClick = (lot) => {
    if (!lot.project?.project_id) return;

    const projectHref = `/admin/projects/${lot.project.project_id}`;
    router.push(projectHref);
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: lot.project.name,
        href: projectHref,
      }),
    );
  };

  // Handle drop for react-dnd
  const handleDrop = async (lot, targetColumn) => {
    const currentStatus = getStageStatus(lot, "Site Measurements");
    let newStatus;

    // Determine new status based on target column
    if (targetColumn === "done") {
      if (currentStatus === "DONE") return; // Already done
      newStatus = "DONE";
    } else if (targetColumn === "pending") {
      if (currentStatus !== "DONE") return; // Already pending
      newStatus = "IN_PROGRESS";
    }

    // Update the status using the same API
    await handleStageStatusUpdate(lot, newStatus);
  };

  // DropZone component with react-dnd
  const DropZone = ({ children, targetColumn, isEmpty }) => {
    const [{ isOver, canDrop }, drop] = useDrop(
      () => ({
        accept: "LOT_CARD",
        drop: (item) => {
          handleDrop(item.lot, targetColumn);
        },
        collect: (monitor) => ({
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
        }),
      }),
      [targetColumn],
    );

    const isActive = isOver && canDrop;
    const bgColor = targetColumn === "done" ? "bg-green-50" : "bg-blue-50";
    const borderColor =
      targetColumn === "done" ? "border-green-300" : "border-blue-300";

    return (
      <div
        ref={drop}
        className={`flex-1 rounded-lg transition-colors min-h-0 ${
          isActive ? `${bgColor} border-2 border-dashed ${borderColor} p-1` : ""
        }`}
      >
        <div className="h-full overflow-y-auto space-y-3 pr-2">{children}</div>
      </div>
    );
  };

  const LotCard = ({ lot }) => {
    const clientName = lot.project?.client?.client_name || "Unknown Client";
    const projectName = lot.project?.name || "Unknown Project";
    const lotId = lot.lot_id || "No ID";

    const stageStatus = getStageStatus(lot, "Site Measurements");

    const statusConfig = {
      NOT_STARTED: {
        label: "Not Started",
        color: "bg-slate-100 text-slate-600 border-slate-200",
        dot: "bg-slate-400",
      },
      IN_PROGRESS: {
        label: "In Progress",
        color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        dot: "bg-yellow-400",
      },
      DONE: {
        label: "Done",
        color: "bg-green-50 text-green-700 border-green-200",
        dot: "bg-green-400",
      },
    };

    const currentStatus = statusConfig[stageStatus] || statusConfig.NOT_STARTED;

    // react-dnd hook
    const [{ isDragging }, drag] = useDrag(
      () => ({
        type: "LOT_CARD",
        item: { lot },
        collect: (monitor) => ({
          isDragging: monitor.isDragging(),
        }),
      }),
      [lot],
    );

    return (
      <div
        ref={drag}
        onClick={() => handleCardClick(lot)}
        className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-move group relative ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        <div className="flex justify-between items-start mb-3 relative z-20">
          <div className="status-dropdown-container relative z-30">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStatusClick(lot, e);
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${currentStatus.color} uppercase tracking-wide flex items-center gap-1.5 hover:bg-opacity-80 transition-colors cursor-pointer`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`}
              />
              {currentStatus.label}
            </button>

            {/* Dropdown Portal/Absolute Position */}
            {statusDropdownOpen === lot.lot_id && (
              <div
                className="fixed bg-white rounded-lg shadow-xl border border-slate-200 w-40 z-50 overflow-hidden text-sm"
                style={{
                  top: statusDropdownPositions[lot.lot_id]?.top,
                  left: statusDropdownPositions[lot.lot_id]?.left,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStageStatusUpdate(lot, key);
                    }}
                    className={`cursor-pointer w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 ${stageStatus === key ? "bg-slate-50 font-medium" : ""}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                    {config.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-1.5 rounded-full bg-slate-50 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        <h3
          className="text-lg font-bold text-slate-800 mb-1 line-clamp-1"
          title={projectName}
        >
          {projectName}
        </h3>

        <div className="space-y-2 mt-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="line-clamp-1">{clientName}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {lotId}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <AdminRoute>
        <div className="flex h-screen bg-slate-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <CRMLayout />

            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <MapPin className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                      Site Measurements
                    </h1>
                    <p className="text-sm text-slate-500">
                      Manage site measurement status across all projects
                    </p>
                  </div>
                </div>
              </div>

              <div className="m-6 flex-1 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : error ? (
                  <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                    {error}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                    {/* Pending Column */}
                    <div className="flex flex-col h-full min-h-0">
                      <div className="flex items-center justify-between bg-slate-50 z-10 py-2 mb-4">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-700">
                          <Clock className="w-5 h-5 text-orange-500" />
                          Pending Measurements
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                            {pendingLots.length}
                          </span>
                        </h2>
                      </div>

                      <DropZone
                        targetColumn="pending"
                        isEmpty={pendingLots.length === 0}
                      >
                        {pendingLots.length === 0 ? (
                          <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500">
                              No pending measurements
                            </p>
                          </div>
                        ) : (
                          pendingLots.map((lot) => (
                            <LotCard key={lot.lot_id} lot={lot} />
                          ))
                        )}
                      </DropZone>
                    </div>

                    {/* Done Column */}
                    <div className="flex flex-col h-full min-h-0">
                      <div className="flex items-center justify-between bg-slate-50 z-10 py-2 mb-4">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-700">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          Completed Measurements
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded-full">
                            {doneLots.length}
                          </span>
                        </h2>
                      </div>

                      <DropZone
                        targetColumn="done"
                        isEmpty={doneLots.length === 0}
                      >
                        {doneLots.length === 0 ? (
                          <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500">
                              No completed measurements
                            </p>
                          </div>
                        ) : (
                          doneLots.map((lot) => (
                            <LotCard key={lot.lot_id} lot={lot} />
                          ))
                        )}
                      </DropZone>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminRoute>
    </DndProvider>
  );
}
