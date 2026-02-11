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
  Check,
  X,
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

  // Employee assignment states
  const [employees, setEmployees] = useState([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [currentLotForAssignment, setCurrentLotForAssignment] = useState(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");

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

  // Fetch employees on component mount
  useEffect(() => {
    fetchEmployees();
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

  // Close employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmployeeDropdown && !event.target.closest(".employee-dropdown")) {
        setShowEmployeeDropdown(false);
        setEmployeeSearchTerm("");
      }
    };

    if (showEmployeeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showEmployeeDropdown]);

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

  const fetchEmployees = async () => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        return;
      }

      const response = await axios.get("/api/employee/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setEmployees(response.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Filter employees based on search term
  const filteredEmployees = employees.filter((employee) => {
    const searchLower = employeeSearchTerm.toLowerCase();
    const fullName =
      `${employee.first_name} ${employee.last_name}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      employee.employee_id.toLowerCase().includes(searchLower) ||
      employee.email?.toLowerCase().includes(searchLower)
    );
  });

  // Open employee dropdown for a specific lot
  const handleOpenEmployeeDropdown = (lot) => {
    setCurrentLotForAssignment(lot);
    setShowEmployeeDropdown(true);
    setEmployeeSearchTerm("");
  };

  // Helper to normalize assigned_to array
  const normalizeAssignedTo = (assignedTo) => {
    if (!assignedTo || assignedTo.length === 0) return [];
    return assignedTo.map((assignment) =>
      typeof assignment === "string" ? assignment : assignment.employee_id,
    );
  };

  // Check if employee is assigned to current lot
  const isEmployeeAssigned = (employeeId) => {
    if (!currentLotForAssignment) return false;
    const stage = currentLotForAssignment.stages?.find(
      (s) => s.name.toLowerCase() === "site measurements",
    );
    if (!stage) return false;
    const assignedIds = normalizeAssignedTo(stage.assigned_to || []);
    return assignedIds.includes(employeeId);
  };

  // Handle employee assignment toggle
  const handleToggleEmployeeAssignment = async (employeeId) => {
    if (!currentLotForAssignment) return;

    const stageName = "Site Measurements";
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const stageObj = currentLotForAssignment.stages?.find(
        (s) => s.name.toLowerCase() === stageName.toLowerCase(),
      );

      // Get current assigned employees
      const currentAssignedIds = normalizeAssignedTo(
        stageObj?.assigned_to || [],
      );

      // Toggle employee assignment
      let updatedAssignedIds;
      if (currentAssignedIds.includes(employeeId)) {
        updatedAssignedIds = currentAssignedIds.filter(
          (id) => id !== employeeId,
        );
      } else {
        updatedAssignedIds = [...currentAssignedIds, employeeId];
      }

      if (!stageObj || !stageObj.stage_id) {
        // Create stage with assignment
        const createResponse = await axios.post(
          "/api/stage/create",
          {
            lot_id: currentLotForAssignment.lot_id,
            name: stageName.toLowerCase(),
            status: "NOT_STARTED",
            notes: "",
            startDate: null,
            endDate: null,
            assigned_to: updatedAssignedIds,
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (createResponse.data.status) {
          toast.success("Assignment updated successfully");
          fetchSiteMeasurements();
        } else {
          toast.error(
            createResponse.data.message || "Failed to update assignment",
          );
        }
      } else {
        // Update existing stage
        const response = await axios.patch(
          `/api/stage/${stageObj.stage_id}`,
          {
            name: stageObj.name,
            status: stageObj.status,
            notes: stageObj.notes || "",
            startDate: stageObj.startDate || null,
            endDate: stageObj.endDate || null,
            assigned_to: updatedAssignedIds,
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.data.status) {
          toast.success("Assignment updated successfully");
          fetchSiteMeasurements();
        } else {
          toast.error(response.data.message || "Failed to update assignment");
        }
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Failed to update assignment");
    }
  };

  // Get assigned team members display
  const getAssignedTeamMembers = (lot) => {
    const stage = lot.stages?.find(
      (s) => s.name.toLowerCase() === "site measurements",
    );
    if (!stage || !stage.assigned_to || stage.assigned_to.length === 0) {
      return "Unassigned";
    }

    return stage.assigned_to
      .map((assignment) => {
        if (typeof assignment === "string") {
          const employee = employees.find((e) => e.employee_id === assignment);
          return employee
            ? `${employee.first_name} ${employee.last_name}`
            : assignment;
        }
        return `${assignment.employee.first_name} ${assignment.employee.last_name}`;
      })
      .join(", ");
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
        className={`bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-move group relative ${
          isDragging ? "opacity-40" : ""
        }`}
      >
        {/* Status badge - top right corner */}
        <div className="status-dropdown-container absolute top-3 right-3">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleStatusClick(lot, e);
            }}
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${currentStatus.color} uppercase tracking-wide flex items-center gap-1 hover:bg-opacity-80 transition-colors cursor-pointer`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
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

        {/* Project name with more space on right for status badge */}
        <h3
          className="text-base font-bold text-slate-800 mb-2 pr-24 line-clamp-1"
          title={projectName}
        >
          {projectName}
        </h3>

        {/* Grid layout for information - more compact */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="line-clamp-1 text-xs">{clientName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600">
            <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {lotId}
            </span>
          </div>

          <div className="col-span-2 flex items-center gap-1.5 text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEmployeeDropdown(lot);
              }}
              className={`cursor-pointer text-xs hover:text-primary-600 hover:underline text-left truncate ${
                lot.stages?.find(
                  (s) => s.name.toLowerCase() === "site measurements",
                )?.assigned_to?.length > 0
                  ? "text-primary-600 font-medium"
                  : "text-slate-600"
              }`}
            >
              {getAssignedTeamMembers(lot)}
            </button>
          </div>
        </div>

        {/* Hover indicator - bottom right corner */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="w-3.5 h-3.5 text-primary-600" />
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

        {/* Employee Assignment Dropdown Modal */}
        {showEmployeeDropdown && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="employee-dropdown bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-800">
                    Assign Team Members
                  </h3>
                  <button
                    onClick={() => {
                      setShowEmployeeDropdown(false);
                      setEmployeeSearchTerm("");
                    }}
                    className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  placeholder="Search employees..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
              </div>

              <div className="mb-3 text-xs text-slate-500 px-4 pt-2">
                Click to select/unselect. Changes are saved automatically.
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {filteredEmployees.length > 0 ? (
                  <div className="space-y-2">
                    {filteredEmployees.map((employee) => {
                      const isAssigned = isEmployeeAssigned(
                        employee.employee_id,
                      );
                      return (
                        <button
                          key={employee.employee_id}
                          onClick={() =>
                            handleToggleEmployeeAssignment(employee.employee_id)
                          }
                          className={`cursor-pointer w-full text-left p-3 border rounded-lg transition-colors ${
                            isAssigned
                              ? "border-primary-600 bg-primary-50 hover:bg-primary-100"
                              : "border-slate-200 hover:bg-slate-50 hover:border-primary-600"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-slate-900">
                                  {employee.first_name} {employee.last_name}
                                </div>
                                {isAssigned && (
                                  <Check className="w-4 h-4 text-primary-600" />
                                )}
                              </div>
                              <div className="text-sm text-slate-600">
                                ID: {employee.employee_id}
                              </div>
                              {employee.email && (
                                <div className="text-xs text-slate-500">
                                  {employee.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">No employees found</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 shrink-0">
                <button
                  onClick={() => {
                    setShowEmployeeDropdown(false);
                    setEmployeeSearchTerm("");
                  }}
                  className="cursor-pointer w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminRoute>
    </DndProvider>
  );
}
