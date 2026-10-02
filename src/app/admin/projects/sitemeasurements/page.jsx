"use client";
import React, { useEffect, useRef, useState } from "react";
import AdminShell from "@/components/AdminShell";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  COUNT_BADGE,
  STATUS_COLORS,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";
const STAGE_NAME = "Site Measurements";

// The statuses a site measurement can be moved between. The status menu is the
// keyboard route to what dragging a card does with a mouse.
const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "DONE"];

const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2 focus:outline-none focus:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed";

// Helpers shared by the board and its cards.
const findSiteStage = (lot) =>
  lot.stages?.find((s) => s.name.toLowerCase() === STAGE_NAME.toLowerCase());

const getStageStatus = (lot) => findSiteStage(lot)?.status || "NOT_STARTED";

const getAssignedTeamMembers = (lot, employees) => {
  const stage = findSiteStage(lot);
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

// Column drop target. Defined at module level so cards keep their DOM nodes
// (and keyboard focus) when the page state changes.
function DropZone({ children, targetColumn, onDrop }) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: "LOT_CARD",
      drop: (item) => {
        onDrop(item.lot, targetColumn);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [targetColumn, onDrop],
  );

  const isActive = isOver && canDrop;

  return (
    <div
      ref={drop}
      className={`flex-1 rounded-lg min-h-0 p-1 border-2 border-dashed transition-colors duration-200 ${
        isActive ? "border-primary bg-primary/5" : "border-transparent"
      }`}
    >
      <div className="h-full overflow-y-auto space-y-3 pr-2">{children}</div>
    </div>
  );
}

function EmptyColumn({ icon: Icon, message }) {
  return (
    <div className="px-4 py-12 text-center bg-white rounded-lg border border-slate-200">
      <div className="flex flex-col items-center gap-2">
        <Icon className="w-8 h-8 text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}

function LotCard({
  lot,
  employees,
  menuOpen,
  menuPosition,
  isUpdatingStatus,
  onOpen,
  onStatusClick,
  onStatusSelect,
  onAssign,
}) {
  const clientName = lot.project?.client?.client_name || EMPTY;
  const projectName = lot.project?.name || EMPTY;
  const projectId = lot.project?.project_id;
  const lotId = lot.lot_id || EMPTY;

  const stageStatus = getStageStatus(lot);
  const statusLabel = formatLabel(stageStatus);
  const hasAssignees = (findSiteStage(lot)?.assigned_to?.length || 0) > 0;

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
      onClick={() => onOpen(lot)}
      className={`bg-white p-4 rounded-lg border border-slate-200 hover:border-primary/25 transition-colors duration-200 cursor-pointer group relative ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        {/* The project name is the keyboard route into the project */}
        <h3 className="min-w-0 text-sm font-semibold text-slate-800">
          {projectId ? (
            <Link
              href={`/admin/projects/${projectId}`}
              draggable={false}
              onClick={(e) => e.stopPropagation()}
              title={projectName}
              className="block truncate rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {projectName}
            </Link>
          ) : (
            <span className="block truncate" title={projectName}>
              {projectName}
            </span>
          )}
        </h3>

        <div className="status-dropdown-container shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStatusClick(lot, e);
            }}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label={`Change status, currently ${statusLabel}`}
            className={`${BADGE} ${STATUS_COLORS[stageStatus] || STATUS_COLORS.NOT_STARTED} cursor-pointer hover:opacity-80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary`}
          >
            {statusLabel}
            <ChevronDown className="w-3 h-3" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              className="fixed bg-white rounded-lg border border-slate-300 w-40 z-40 overflow-hidden"
              style={{
                top: menuPosition?.top,
                left: menuPosition?.left,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((key) => (
                <button
                  type="button"
                  key={key}
                  disabled={isUpdatingStatus}
                  aria-current={stageStatus === key ? "true" : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusSelect(lot, key);
                  }}
                  className={`${MENU_ITEM} ${stageStatus === key ? "bg-slate-50 font-medium" : ""}`}
                >
                  {formatLabel(key)}
                  {stageStatus === key && (
                    <Check
                      className="w-4 h-4 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="flex items-center gap-2 text-slate-600 min-w-0">
          <User
            className="w-4 h-4 text-slate-400 shrink-0"
            aria-hidden="true"
          />
          <span className="sr-only">Client:</span>
          <span className="truncate" title={clientName}>
            {clientName}
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-600 min-w-0">
          <ClipboardList
            className="w-4 h-4 text-slate-400 shrink-0"
            aria-hidden="true"
          />
          <span className="sr-only">Lot:</span>
          <span className="font-mono truncate" title={lotId}>
            {lotId}
          </span>
        </div>

        <div className="col-span-2 flex items-center gap-2 text-slate-600 min-w-0">
          <Users
            className="w-4 h-4 text-slate-400 shrink-0"
            aria-hidden="true"
          />
          <span className="sr-only">Assigned to:</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(lot);
            }}
            aria-haspopup="dialog"
            title="Assign team members"
            className={`cursor-pointer text-xs rounded-sm text-left truncate focus:outline-none focus:ring-2 focus:ring-primary ${
              hasAssignees ? "text-primary font-medium" : "text-slate-600"
            }`}
          >
            {getAssignedTeamMembers(lot, employees)}
          </button>
        </div>
      </div>

      {/* Hover indicator - bottom right corner */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <ArrowRight className="w-4 h-4 text-primary" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function SiteMeasurementsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
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
  const employeeModalRef = useRef(null);

  useModalFocus(employeeModalRef, showEmployeeDropdown);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The status menu and the assignment modal close on Escape (DESIGN.md 9.4).
  // Neither is destructive, and assignments save as they are clicked, so there
  // is no unsaved form to protect.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showEmployeeDropdown) {
        setShowEmployeeDropdown(false);
        setEmployeeSearchTerm("");
      } else if (statusDropdownOpen) {
        setStatusDropdownOpen(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showEmployeeDropdown, statusDropdownOpen]);

  const fetchSiteMeasurements = async () => {
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        setError("Your session has expired. Sign in again.");
        return;
      }

      const config = {
        method: "get",
        url: "/api/v1/lot/sitemeasurements",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      };

      const response = await axios.request(config);

      if (response.data.status) {
        setPendingLots(response.data.data.pending);
        setDoneLots(response.data.data.done);
      } else {
        setError(
          response.data.message ||
            "Couldn't load site measurements. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching site measurements:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load site measurements. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Retry from the error state: show the loader again, then refetch. Refreshes
  // after an update call fetchSiteMeasurements directly so the board doesn't
  // flash back to the loader.
  const retryFetch = () => {
    setLoading(true);
    setError("");
    fetchSiteMeasurements();
  };

  const fetchEmployees = async () => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        return;
      }

      const response = await axios.get("/api/v1/employee/all", {
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

  const closeEmployeeModal = () => {
    setShowEmployeeDropdown(false);
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
    const stage = findSiteStage(currentLotForAssignment);
    if (!stage) return false;
    const assignedIds = normalizeAssignedTo(stage.assigned_to || []);
    return assignedIds.includes(employeeId);
  };

  // Handle employee assignment toggle
  const handleToggleEmployeeAssignment = async (employeeId) => {
    if (!currentLotForAssignment) return;

    const stageName = STAGE_NAME;
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
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
          "/api/v1/stage/create",
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
          toast.success("Assignment updated.");
          fetchSiteMeasurements();
        } else {
          toast.error(
            createResponse.data.message ||
              "Couldn't update the assignment. Try again.",
          );
        }
      } else {
        // Update existing stage
        const response = await axios.patch(
          `/api/v1/stage/${stageObj.stage_id}`,
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
          toast.success("Assignment updated.");
          fetchSiteMeasurements();
        } else {
          toast.error(
            response.data.message ||
              "Couldn't update the assignment. Try again.",
          );
        }
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
      toast.error("Couldn't update the assignment. Try again.");
    }
  };

  // Handle status badge click
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
    const stageName = STAGE_NAME;
    try {
      setIsUpdatingStatus(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        return;
      }

      const stageObj = lot.stages?.find(
        (s) => s.name.toLowerCase() === stageName.toLowerCase(),
      );

      if (!stageObj || !stageObj.stage_id) {
        // Create stage
        const createResponse = await axios.post(
          "/api/v1/stage/create",
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
          toast.success("Status updated.");
          setStatusDropdownOpen(null);
          fetchSiteMeasurements();
        } else {
          toast.error(
            createResponse.data.message ||
              "Couldn't update the status. Try again.",
          );
        }
      } else {
        // Update stage
        const response = await axios.patch(
          `/api/v1/stage/${stageObj.stage_id}`,
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
          toast.success("Status updated.");
          setStatusDropdownOpen(null);
          // Refresh data from backend
          fetchSiteMeasurements();
        } else {
          toast.error(
            response.data.message || "Couldn't update the status. Try again.",
          );
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Couldn't update the status. Try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCardClick = (lot) => {
    if (!lot.project?.project_id) return;

    const projectHref = `/admin/projects/${lot.project.project_id}`;
    router.push(projectHref);
  };

  // Handle drop for react-dnd
  const handleDrop = async (lot, targetColumn) => {
    const currentStatus = getStageStatus(lot);
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

  const renderCard = (lot) => (
    <LotCard
      key={lot.lot_id}
      lot={lot}
      employees={employees}
      menuOpen={statusDropdownOpen === lot.lot_id}
      menuPosition={statusDropdownPositions[lot.lot_id]}
      isUpdatingStatus={isUpdatingStatus}
      onOpen={handleCardClick}
      onStatusClick={handleStatusClick}
      onStatusSelect={handleStageStatusUpdate}
      onAssign={handleOpenEmployeeDropdown}
    />
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <AdminShell>
        <main className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="px-4 py-2 shrink-0">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-semibold text-slate-800">
                Site measurements
              </h1>
              <div className="flex items-center gap-2">
                <SearchBar />
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full bg-white rounded-lg border border-slate-200">
                <div
                  className="flex flex-col items-center gap-2 px-4 py-12"
                  role="status"
                >
                  <span
                    className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-600">
                    Loading site measurements…
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full bg-white rounded-lg border border-slate-200">
                <div
                  className="flex flex-col items-center gap-2 px-4 py-12 text-center"
                  role="alert"
                >
                  <AlertTriangle
                    className="w-8 h-8 text-red-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-red-600">{error}</p>
                  <button
                    type="button"
                    onClick={retryFetch}
                    className={BTN_SECONDARY}
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Pending Column */}
                <section
                  aria-labelledby="pending-measurements-title"
                  className="flex flex-col h-full min-h-0"
                >
                  <div className="flex items-center justify-between py-2 mb-4">
                    <h2
                      id="pending-measurements-title"
                      className="flex items-center gap-2 text-lg font-semibold text-slate-800"
                    >
                      <Clock
                        className="w-5 h-5 text-slate-500"
                        aria-hidden="true"
                      />
                      Pending measurements
                      <span className={COUNT_BADGE}>{pendingLots.length}</span>
                    </h2>
                  </div>

                  <DropZone targetColumn="pending" onDrop={handleDrop}>
                    {pendingLots.length === 0 ? (
                      <EmptyColumn
                        icon={Clock}
                        message="No pending measurements"
                      />
                    ) : (
                      pendingLots.map(renderCard)
                    )}
                  </DropZone>
                </section>

                {/* Done Column */}
                <section
                  aria-labelledby="completed-measurements-title"
                  className="flex flex-col h-full min-h-0"
                >
                  <div className="flex items-center justify-between py-2 mb-4">
                    <h2
                      id="completed-measurements-title"
                      className="flex items-center gap-2 text-lg font-semibold text-slate-800"
                    >
                      <CheckCircle
                        className="w-5 h-5 text-slate-500"
                        aria-hidden="true"
                      />
                      Completed measurements
                      <span className={COUNT_BADGE}>{doneLots.length}</span>
                    </h2>
                  </div>

                  <DropZone targetColumn="done" onDrop={handleDrop}>
                    {doneLots.length === 0 ? (
                      <EmptyColumn
                        icon={CheckCircle}
                        message="No completed measurements"
                      />
                    ) : (
                      doneLots.map(renderCard)
                    )}
                  </DropZone>
                </section>
              </div>
            )}
          </div>
        </main>

        {/* Employee Assignment Dropdown Modal */}
        {showEmployeeDropdown && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4">
            <div
              ref={employeeModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="assign-team-title"
              className="employee-dropdown bg-white rounded-xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                <div className="min-w-0">
                  <h2
                    id="assign-team-title"
                    className="text-lg font-semibold text-slate-800"
                  >
                    Assign team members
                  </h2>
                  <p
                    className="text-xs text-slate-500 truncate"
                    title={currentLotForAssignment?.project?.name || undefined}
                  >
                    Project: {currentLotForAssignment?.project?.name || EMPTY}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEmployeeModal}
                  className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              <div className="px-6 pt-6 pb-3 shrink-0">
                <input
                  type="text"
                  data-autofocus
                  aria-label="Search employees"
                  value={employeeSearchTerm}
                  onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  placeholder="Search by name, ID or email"
                  className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Select or clear a person to assign them. Changes save
                  automatically.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {filteredEmployees.length > 0 ? (
                  <div className="space-y-2">
                    {filteredEmployees.map((employee) => {
                      const isAssigned = isEmployeeAssigned(
                        employee.employee_id,
                      );
                      return (
                        <button
                          type="button"
                          key={employee.employee_id}
                          aria-pressed={isAssigned}
                          onClick={() =>
                            handleToggleEmployeeAssignment(employee.employee_id)
                          }
                          className={`cursor-pointer w-full text-left p-3 border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                            isAssigned
                              ? "border-primary bg-primary/10 hover:bg-primary/20"
                              : "border-slate-200 hover:bg-slate-50 hover:border-primary/25"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {employee.first_name} {employee.last_name}
                            </span>
                            {isAssigned && (
                              <Check
                                className="w-4 h-4 text-primary"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="text-xs text-slate-600 font-mono">
                            {employee.employee_id}
                          </div>
                          {employee.email && (
                            <div className="text-xs text-slate-500">
                              {employee.email}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <User
                      className="w-8 h-8 text-slate-300"
                      aria-hidden="true"
                    />
                    {employees.length > 0 ? (
                      <>
                        <p className="text-sm text-slate-600">
                          No employees match your search
                        </p>
                        <button
                          type="button"
                          onClick={() => setEmployeeSearchTerm("")}
                          className={BTN_SECONDARY}
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-600">No employees yet</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={closeEmployeeModal}
                  className={BTN_PRIMARY}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminShell>
    </DndProvider>
  );
}
