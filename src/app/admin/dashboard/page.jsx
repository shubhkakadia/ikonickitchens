"use client";
import React, { useEffect, useState } from "react";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  FolderKanban,
  Layers,
  ClipboardList,
  ShoppingCart,
  Package,
  RefreshCcw,
  History,
  User,
  ChevronDown,
  Calendar,
  Clock,
  RotateCcw,
  Database,
  Target,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import Sidebar from "../../../components/sidebar";
import SearchBar from "@/components/SearchBar";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement,
);

// Color palette for charts
const CHART_COLORS = [
  "#B92F34", // Primary Red
  "#000080", // Primary Blue
  "#059669", // Emerald
  "#7C3AED", // Violet
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#8B5CF6", // Purple
];

// Supplier colors for line chart
const SUPPLIER_COLORS = {
  polytec: "#B92F34",
  eurofit: "#000080",
  hafele: "#059669",
  blum: "#7C3AED",
  other: "#F59E0B",
};

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: "#1e293b",
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: "#f1f5f9",
      },
      ticks: {
        font: { size: 11 },
        color: "#64748b",
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        font: { size: 11 },
        color: "#64748b",
      },
    },
  },
};

// KPI Card Component
const KPICard = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  prefix = "",
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-lg border border-slate-200 p-2 md:p-2.5 xl:p-3 transition-all duration-300 group ${onClick ? "cursor-pointer" : ""}`}
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-[9px] md:text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
          {title}
        </p>
        <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
          {prefix}
          {typeof value === "number" ? value.toLocaleString() : value}
        </h3>
        {subtitle && (
          <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 leading-tight">
            {subtitle}
          </p>
        )}
      </div>
      <div
        className={`p-1.5 md:p-2 rounded-lg ${color} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
      </div>
    </div>
  </div>
);

// Chart Card Wrapper Component
const ChartCard = ({ title, children, className = "" }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}
  >
    <div className="px-5 py-4 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// Format time ago
const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Get action color
const getActionColor = (action) => {
  const colors = {
    CREATE: "bg-emerald-100 text-emerald-700",
    UPDATE: "bg-blue-100 text-blue-700",
    DELETE: "bg-red-100 text-red-700",
    LOGIN: "bg-violet-100 text-violet-700",
    LOGOUT: "bg-slate-100 text-slate-700",
  };
  return colors[action] || "bg-slate-100 text-slate-700";
};

// Calculate days left from end date
const getDaysLeft = (endDate) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  // Check if date is invalid
  if (isNaN(end.getTime())) return null;

  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get days left badge color and text
const getDaysLeftBadge = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined) {
    return { color: "bg-slate-100 text-slate-600", text: "No due date" };
  }
  if (daysLeft < 0) {
    return {
      color: "bg-red-100 text-red-700",
      text: `${Math.abs(daysLeft)}d overdue`,
    };
  }
  if (daysLeft === 0) {
    return { color: "bg-red-100 text-red-700", text: "Due today" };
  }
  if (daysLeft <= 3) {
    return { color: "bg-amber-100 text-amber-700", text: `${daysLeft}d left` };
  }
  if (daysLeft <= 7) {
    return {
      color: "bg-yellow-100 text-yellow-700",
      text: `${daysLeft}d left`,
    };
  }
  return {
    color: "bg-emerald-100 text-emerald-700",
    text: `${daysLeft}d left`,
  };
};

// Get status color
const getStatusColor = (status) => {
  const colors = {
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-slate-100 text-slate-600",
    NOT_STARTED: "bg-slate-100 text-slate-600",
  };
  return colors[status] || "bg-slate-100 text-slate-600";
};

export default function page() {
  const { getToken, userData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [logsData, setLogsData] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [dashboardYearFilter, setDashboardYearFilter] = useState("all");
  const [dashboardYearDropdownOpen, setDashboardYearDropdownOpen] =
    useState(false);
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState("all");
  const [dashboardMonthDropdownOpen, setDashboardMonthDropdownOpen] =
    useState(false);
  const [storageUsage, setStorageUsage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageDropdownOpen, setStorageDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employeeData, setEmployeeData] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionToken = getToken();

      if (!sessionToken) {
        setError("No valid session found. Please login again.");
        return;
      }

      // Prepare month and year for API request
      const month =
        dashboardMonthFilter === "all" ? "all" : dashboardMonthFilter;
      const year = dashboardYearFilter === "all" ? "all" : dashboardYearFilter;

      const response = await axios.post(
        "/api/dashboard",
        {
          month,
          year,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        setDashboardData(response.data.data);
      } else {
        setError(response.data.message || "Failed to fetch dashboard data");
      }
    } catch (err) {
      console.error("Dashboard API Error:", err);
      setError(
        err.response?.data?.message ||
          "An error occurred while fetching dashboard data",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) return;

      const response = await axios.get("/api/logs", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        const sortedLogs = (response.data.data || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10);
        setLogsData(sortedLogs);
      }
    } catch (err) {
      console.error("Logs API Error:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchStorageUsage = async () => {
    try {
      setStorageLoading(true);
      const response = await fetch("/storage-usage.json");
      if (response.ok) {
        const data = await response.json();
        setStorageUsage(data);
      }
    } catch (err) {
      console.error("Storage Usage Error:", err);
    } finally {
      setStorageLoading(false);
    }
  };

  const fetchEmployeeData = async () => {
    if (!userData?.user?.employee_id) return;

    try {
      setEmployeeLoading(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get(
        `/api/employee/${userData.user.employee_id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        setEmployeeData(response.data.data);
      }
    } catch (err) {
      console.error("Employee API Error:", err);
    } finally {
      setEmployeeLoading(false);
    }
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      return "Good Morning!";
    } else if (hour >= 12 && hour < 17) {
      return "Good Afternoon!";
    } else {
      return "Good Evening!";
    }
  };

  // Format date and time with seconds
  const formatDateTime = () => {
    return currentTime.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  useEffect(() => {
    fetchDashboard();
    fetchLogs();
    fetchStorageUsage();
  }, [dashboardYearFilter, dashboardMonthFilter]);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch employee data when userData is available
  useEffect(() => {
    if (userData?.user?.employee_id) {
      fetchEmployeeData();
    }
  }, [userData?.user?.employee_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dashboard-year-dropdown-container")) {
        setDashboardYearDropdownOpen(false);
      }
      if (!event.target.closest(".dashboard-month-dropdown-container")) {
        setDashboardMonthDropdownOpen(false);
      }
      if (!event.target.closest(".dashboard-storage-dropdown-container")) {
        setStorageDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset month filter when year changes to "all"
  useEffect(() => {
    if (dashboardYearFilter === "all") {
      setDashboardMonthFilter("all");
    }
  }, [dashboardYearFilter]);

  // Get all available years from dashboard data (from multiple sources)
  const getAllDashboardYears = () => {
    const years = new Set();

    // Get years from totalSpent
    if (dashboardData?.totalSpent) {
      dashboardData.totalSpent.forEach((item) => {
        const year = item.month_year.split("-")[0];
        years.add(year);
      });
    }

    // Get years from stages due dates
    if (dashboardData?.topstagesDue) {
      dashboardData.topstagesDue.forEach((stage) => {
        if (stage.endDate) {
          const date = new Date(stage.endDate);
          if (!isNaN(date.getTime())) {
            years.add(date.getFullYear().toString());
          }
        }
      });
    }

    return Array.from(years).sort((a, b) => b - a);
  };

  // Format month number to month name
  const formatMonthName = (monthNumber) => {
    const date = new Date(2000, parseInt(monthNumber) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long" });
  };

  // Get available months for selected year
  const getAvailableMonthsForYear = () => {
    if (dashboardYearFilter === "all") {
      return [];
    }

    // Return all 12 months regardless of available data
    // This ensures the dropdown always shows all months when a year is selected
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  };

  // Format month_year to readable format
  const formatMonthYear = (monthYear) => {
    const [year, month] = monthYear.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  // Format storage size
  const formatStorageSize = (sizeMB) => {
    if (sizeMB < 1) {
      return `${(sizeMB * 1024).toFixed(2)} KB`;
    }
    if (sizeMB < 1024) {
      return `${sizeMB.toFixed(2)} MB`;
    }
    return `${(sizeMB / 1024).toFixed(2)} GB`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format timestamp in Adelaide timezone
  const formatTimestampAdelaide = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString("en-AU", {
      timeZone: "Australia/Adelaide",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  // Transform lotsByStage for Chart.js doughnut chart
  const getLotsByStageChartData = () => {
    if (!dashboardData?.lotsByStage || dashboardData.lotsByStage.length === 0)
      return null;

    return {
      labels: dashboardData.lotsByStage.map(
        (item) => item.name.charAt(0).toUpperCase() + item.name.slice(1),
      ),
      datasets: [
        {
          data: dashboardData.lotsByStage.map((item) => item._count),
          backgroundColor: CHART_COLORS.slice(
            0,
            dashboardData.lotsByStage.length,
          ),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    };
  };

  // Transform MTOsByStatus for Chart.js doughnut chart
  const getMTOsByStatusChartData = () => {
    if (!dashboardData?.MTOsByStatus || dashboardData.MTOsByStatus.length === 0)
      return null;

    return {
      labels: dashboardData.MTOsByStatus.map((item) =>
        item.status.replace(/_/g, " "),
      ),
      datasets: [
        {
          data: dashboardData.MTOsByStatus.map((item) => item._count),
          backgroundColor: CHART_COLORS.slice(
            0,
            dashboardData.MTOsByStatus.length,
          ),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    };
  };

  // Transform purchaseOrdersByStatus for Chart.js doughnut chart
  const getPOsByStatusChartData = () => {
    if (
      !dashboardData?.purchaseOrdersByStatus ||
      dashboardData.purchaseOrdersByStatus.length === 0
    )
      return null;

    return {
      labels: dashboardData.purchaseOrdersByStatus.map((item) =>
        item.status.replace(/_/g, " "),
      ),
      datasets: [
        {
          data: dashboardData.purchaseOrdersByStatus.map((item) => item._count),
          backgroundColor: CHART_COLORS.slice(
            0,
            dashboardData.purchaseOrdersByStatus.length,
          ),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    };
  };

  // Get filtered and sorted stages due (by least days left first)
  const getSortedStagesDue = () => {
    if (!dashboardData?.topstagesDue) return [];

    // First, filter out stages without endDate
    let filtered = dashboardData.topstagesDue.filter((stage) => {
      if (!stage.endDate) return false;
      const date = new Date(stage.endDate);
      return !isNaN(date.getTime());
    });

    // Filter by year
    if (dashboardYearFilter !== "all") {
      filtered = filtered.filter((stage) => {
        const date = new Date(stage.endDate);
        return date.getFullYear().toString() === dashboardYearFilter;
      });
    }

    // Filter by month
    if (dashboardMonthFilter !== "all" && dashboardYearFilter !== "all") {
      filtered = filtered.filter((stage) => {
        const date = new Date(stage.endDate);
        return date.getMonth() + 1 === parseInt(dashboardMonthFilter);
      });
    }

    return filtered.sort((a, b) => {
      const daysLeftA = getDaysLeft(a.endDate);
      const daysLeftB = getDaysLeft(b.endDate);
      if (daysLeftA === null) return 1;
      if (daysLeftB === null) return -1;
      return daysLeftA - daysLeftB;
    });
  };

  const lotsByStageChartData = getLotsByStageChartData();
  const mtosByStatusChartData = getMTOsByStatusChartData();
  const posByStatusChartData = getPOsByStatusChartData();
  const sortedStagesDue = getSortedStagesDue();

  // Chart.js options for doughnut charts
  const doughnutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "60%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        backgroundColor: "#1e293b",
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            return `${context.label}: ${context.parsed}`;
          },
        },
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#1e293b",
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "#f1f5f9",
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="h-full w-full overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 font-medium">
                    Loading dashboard...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-sm text-red-600 mb-4 font-medium">
                    {error}
                  </p>
                  <button
                    onClick={() => {
                      fetchDashboard();
                      fetchLogs();
                    }}
                    className="cursor-pointer btn-primary px-4 py-2 text-sm font-medium rounded-lg"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 md:p-5 xl:p-6 space-y-4">
                {/* Header with Greeting */}
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6 xl:mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-bold text-slate-800">
                          {getGreeting()}
                        </h1>
                        <h1 className="text-3xl md:text-4xl xl:text-5xl font-bold text-slate-800">
                          {employeeData && (
                            <span className="text-secondary">
                              {employeeData.first_name}
                              {employeeData.last_name &&
                                ` ${employeeData.last_name}`}
                            </span>
                          )}
                        </h1>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      {/* <Calendar className="w-5 h-5" /> */}
                      <p className="text-sm md:text-base font-medium">
                        {formatDateTime()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 xl:gap-3 xl:justify-end">
                    <div className="w-full md:w-auto">
                      <SearchBar />
                    </div>
                    {/* Storage Usage - Compact Display */}
                    {storageLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                        <span>Loading storage...</span>
                      </div>
                    ) : storageUsage ? (
                      <div className="relative dashboard-storage-dropdown-container">
                        <button
                          onClick={() =>
                            setStorageDropdownOpen(!storageDropdownOpen)
                          }
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                          title={`Last updated: ${formatTimestampAdelaide(storageUsage.timestamp)} (Adelaide time)`}
                        >
                          <Database className="w-4 h-4 text-blue-600" />
                          <span>Storage</span>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {storageDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg z-10 shadow-lg p-2">
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50">
                              <span className="text-xs font-medium text-slate-600">
                                DB
                              </span>
                              <span className="text-xs font-semibold text-slate-700">
                                {formatStorageSize(
                                  storageUsage.database?.size_mb || 0,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-50">
                              <span className="text-xs font-medium text-slate-600">
                                Files
                              </span>
                              <span className="text-xs font-semibold text-slate-700">
                                {formatStorageSize(
                                  storageUsage.uploads?.size_mb || 0,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-slate-50 mt-1">
                              <span className="text-xs font-semibold text-slate-700">
                                Total
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {formatStorageSize(
                                  (storageUsage.database?.size_mb || 0) +
                                    (storageUsage.uploads?.size_mb || 0),
                                )}
                              </span>
                            </div>
                            <div className="px-2 pt-2 text-[10px] text-slate-400">
                              Updated{" "}
                              {formatTimestampAdelaide(storageUsage.timestamp)}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                    {/* Reset Filters Button - Only show when filters are applied */}
                    {(dashboardYearFilter !== "all" ||
                      dashboardMonthFilter !== "all") && (
                      <button
                        onClick={() => {
                          setDashboardYearFilter("all");
                          setDashboardMonthFilter("all");
                          setDashboardYearDropdownOpen(false);
                          setDashboardMonthDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        title="Reset filters to default"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                      </button>
                    )}
                    {/* Year Filter Dropdown */}
                    <div className="relative dashboard-year-dropdown-container">
                      <button
                        onClick={() =>
                          setDashboardYearDropdownOpen(
                            !dashboardYearDropdownOpen,
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {dashboardYearFilter === "all"
                          ? "All Years"
                          : dashboardYearFilter}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {dashboardYearDropdownOpen && (
                        <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg z-10">
                          <button
                            onClick={() => {
                              setDashboardYearFilter("all");
                              setDashboardYearDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                              dashboardYearFilter === "all"
                                ? "text-secondary font-medium"
                                : "text-slate-600"
                            }`}
                          >
                            All Years
                          </button>
                          {getAllDashboardYears().map((year) => (
                            <button
                              key={year}
                              onClick={() => {
                                setDashboardYearFilter(year);
                                setDashboardYearDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                                dashboardYearFilter === year
                                  ? "text-secondary font-medium"
                                  : "text-slate-600"
                              }`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Month Filter Dropdown */}
                    <div className="relative dashboard-month-dropdown-container">
                      <button
                        onClick={() => {
                          if (dashboardYearFilter !== "all") {
                            setDashboardMonthDropdownOpen(
                              !dashboardMonthDropdownOpen,
                            );
                          }
                        }}
                        disabled={dashboardYearFilter === "all"}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          dashboardYearFilter === "all"
                            ? "text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed"
                            : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        }`}
                      >
                        {dashboardMonthFilter === "all"
                          ? "All Months"
                          : formatMonthName(dashboardMonthFilter)}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {dashboardMonthDropdownOpen &&
                        dashboardYearFilter !== "all" && (
                          <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg z-10">
                            <button
                              onClick={() => {
                                setDashboardMonthFilter("all");
                                setDashboardMonthDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                                dashboardMonthFilter === "all"
                                  ? "text-secondary font-medium"
                                  : "text-slate-600"
                              }`}
                            >
                              All Months
                            </button>
                            {getAvailableMonthsForYear().map((month) => (
                              <button
                                key={month}
                                onClick={() => {
                                  setDashboardMonthFilter(month.toString());
                                  setDashboardMonthDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                                  dashboardMonthFilter === month.toString()
                                    ? "text-secondary font-medium"
                                    : "text-slate-600"
                                }`}
                              >
                                {formatMonthName(month)}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    <button
                      onClick={() => {
                        fetchDashboard();
                        fetchLogs();
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="flex flex-col xl:flex-row gap-4">
                  <div className="xl:flex-3 min-w-0 space-y-4">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 xl:gap-3">
                      <KPICard
                        title="Active Projects"
                        value={dashboardData?.activeProjects || 0}
                        icon={FolderKanban}
                        color="bg-linear-to-br from-blue-500 to-blue-600"
                        subtitle="Currently in progress"
                        onClick={() => router.push("/admin/projects")}
                      />
                      <KPICard
                        title="Active Lots"
                        value={dashboardData?.activeLots || 0}
                        icon={Layers}
                        color="bg-linear-to-br from-emerald-500 to-emerald-600"
                        subtitle="Across all projects"
                      />
                      <KPICard
                        title="Active MTOs"
                        value={dashboardData?.activeMTOs || 0}
                        icon={ClipboardList}
                        color="bg-linear-to-br from-violet-500 to-violet-600"
                        subtitle="Materials to order"
                        onClick={() =>
                          router.push("/admin/suppliers/materialstoorder")
                        }
                      />
                      <KPICard
                        title="Purchase Orders"
                        value={dashboardData?.activePurchaseOrders || 0}
                        icon={ShoppingCart}
                        color="bg-linear-to-br from-amber-500 to-amber-600"
                        subtitle="Active orders"
                        onClick={() =>
                          router.push("/admin/suppliers/purchaseorder")
                        }
                      />
                      <KPICard
                        title="Projects Completed"
                        value={dashboardData?.projectsCompletedThisMonth || 0}
                        icon={Target}
                        color="bg-linear-to-br from-green-500 to-green-600"
                        subtitle="This month"
                      />
                      {/* <KPICard
                        title="Avg Project Duration"
                        value={
                          dashboardData?.averageProjectDuration > 0
                            ? dashboardData.averageProjectDuration
                            : 0
                        }
                        icon={Clock}
                        color="bg-linear-to-br from-rose-500 to-rose-600"
                        subtitle={
                          dashboardData?.averageProjectDuration > 0
                            ? `${dashboardData.averageProjectDuration} days`
                            : "No completed projects"
                        }
                      /> */}
                    </div>

                    {/* Stages Due */}
                    <ChartCard title="Upcoming Stage Deadlines">
                      {sortedStagesDue.length > 0 ? (
                        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                          <table className="w-full">
                            <thead className="sticky top-0 bg-white">
                              <tr className="border-b border-slate-100">
                                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  Stage
                                </th>
                                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  Project / Lot
                                </th>
                                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  Status
                                </th>
                                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  Due Date
                                </th>
                                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  Time Left
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedStagesDue.map((stage) => {
                                const daysLeft = getDaysLeft(stage.endDate);
                                const badge = getDaysLeftBadge(daysLeft);
                                return (
                                  <tr
                                    key={stage.stage_id}
                                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                                  >
                                    <td className="py-3 px-3">
                                      <span className="inline-flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-medium text-slate-700 capitalize">
                                          {stage.name}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-sm text-slate-600">
                                      {stage.lot?.project?.name ? (
                                        <span>
                                          <span className="font-medium">
                                            {stage.lot.project.name}
                                          </span>
                                          <span className="text-slate-400 mx-1">
                                            /
                                          </span>
                                          <span>{stage.lot_id}</span>
                                        </span>
                                      ) : (
                                        stage.lot_id
                                      )}
                                    </td>
                                    <td className="py-3 px-3">
                                      <span
                                        className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase ${getStatusColor(
                                          stage.status,
                                        )}`}
                                      >
                                        {stage.status?.replace(/_/g, " ")}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-sm text-slate-600">
                                      {stage.endDate &&
                                      new Date(stage.endDate).getFullYear() >
                                        2000
                                        ? new Date(
                                            stage.endDate,
                                          ).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })
                                        : "-"}
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                      <span
                                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${badge.color}`}
                                      >
                                        <Clock className="w-3 h-3" />
                                        {badge.text}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-400 text-sm">
                          No upcoming stage deadlines
                        </div>
                      )}
                    </ChartCard>
                  </div>
                  <div className="xl:flex-1 min-w-0">
                    {/* Upcoming Meetings */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">
                          Upcoming Meetings
                        </h3>
                        <Calendar className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
                        {dashboardData?.upcomingMeetings &&
                        dashboardData.upcomingMeetings.length > 0 ? (
                          dashboardData.upcomingMeetings.map((meeting) => (
                            <div
                              key={meeting.id}
                              className="p-4 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="shrink-0 w-10 text-center bg-slate-100 rounded-lg p-1">
                                  <span className="block text-[10px] font-bold text-slate-500 uppercase">
                                    {new Date(
                                      meeting.date_time,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                    })}
                                  </span>
                                  <span className="block text-sm font-bold text-slate-800">
                                    {new Date(meeting.date_time).getDate()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">
                                    {meeting.title}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    {new Date(
                                      meeting.date_time,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                  {meeting.lots && meeting.lots.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
                                      {meeting.lots.slice(0, 2).map((l) => (
                                        <span
                                          key={l.lot_id}
                                          className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 truncate max-w-20"
                                        >
                                          {l.lot_id}
                                        </span>
                                      ))}
                                      {meeting.lots.length > 2 && (
                                        <span className="text-[9px] text-slate-400">
                                          +{meeting.lots.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {meeting.participants &&
                                    meeting.participants.length > 0 && (
                                      <div className="flex items-center gap-1 mt-2">
                                        <div className="flex -space-x-2">
                                          {meeting.participants
                                            .slice(0, 3)
                                            .map((participant) => (
                                              <div
                                                key={participant.id}
                                                className="relative group"
                                                title={`${participant.employee?.first_name || ""} ${participant.employee?.last_name || participant.username}`}
                                              >
                                                {participant.employee?.image ? (
                                                  <img
                                                    src={
                                                      participant.employee.image
                                                    }
                                                    alt={`${participant.employee.first_name} ${participant.employee.last_name}`}
                                                    className="w-6 h-6 rounded-full border-2 border-white object-cover"
                                                  />
                                                ) : (
                                                  <div className="w-6 h-6 rounded-full border-2 border-white bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                                    <span className="text-[10px] font-bold text-white">
                                                      {participant.employee
                                                        ?.first_name?.[0] ||
                                                        participant
                                                          .username?.[0] ||
                                                        "?"}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                        </div>
                                        {meeting.participants.length > 3 && (
                                          <span className="text-[9px] text-slate-400 ml-1">
                                            +{meeting.participants.length - 3}
                                          </span>
                                        )}
                                        <span className="text-[9px] text-slate-500 ml-1">
                                          {meeting.participants
                                            .slice(0, 2)
                                            .map((p, idx) => (
                                              <span key={p.id}>
                                                {idx > 0 && ", "}
                                                {p.employee?.first_name ||
                                                  p.username}
                                              </span>
                                            ))}
                                          {meeting.participants.length > 2 &&
                                            "..."}
                                        </span>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <p className="text-xs text-slate-500">
                              No upcoming meetings
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <button
                          onClick={() => router.push("/admin/calendar")}
                          className="cursor-pointer w-full py-2 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition-all text-center"
                        >
                          View All Meetings
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming Meetings & Status Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Lots by Stage */}
                  <ChartCard title="Lots by Stage">
                    {lotsByStageChartData ? (
                      <div style={{ height: "250px" }}>
                        <Bar
                          data={lotsByStageChartData}
                          options={barChartOptions}
                        />
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
                        No lot data available
                      </div>
                    )}
                  </ChartCard>

                  {/* MTOs by Status */}
                  <ChartCard title="Material to Order by Status">
                    {mtosByStatusChartData ? (
                      <div style={{ height: "250px" }}>
                        <Doughnut
                          data={mtosByStatusChartData}
                          options={doughnutChartOptions}
                        />
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
                        No MTO data available
                      </div>
                    )}
                  </ChartCard>

                  {/* Purchase Orders by Status */}
                  <ChartCard title="Purchase Orders by Status">
                    {posByStatusChartData ? (
                      <div style={{ height: "250px" }}>
                        <Doughnut
                          data={posByStatusChartData}
                          options={doughnutChartOptions}
                        />
                      </div>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
                        No purchase order data available
                      </div>
                    )}
                  </ChartCard>
                </div>

                {/* Top Items and Logs - Side by Side */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Top 10 Items */}
                  <ChartCard title="Top 10 Items">
                    {dashboardData?.top10items?.length > 0 ? (
                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-white">
                            <tr className="border-b border-slate-100">
                              <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide w-10">
                                #
                              </th>
                              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Category
                              </th>
                              <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Details
                              </th>
                              <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                Qty
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {dashboardData.top10items.map((item, index) => (
                              <tr
                                key={item.item_id}
                                className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                              >
                                <td className="py-3 px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-linear-to-br from-slate-600 to-slate-700 rounded-full">
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="inline-flex items-center gap-2">
                                    <Package className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-medium text-slate-700">
                                      {item.category}
                                    </span>
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-xs text-slate-600">
                                  {item.sheet && (
                                    <span className="bg-slate-100 px-2 py-1 rounded-full">
                                      {item.sheet.brand} - {item.sheet.color}
                                    </span>
                                  )}
                                  {item.handle && (
                                    <span className="bg-slate-100 px-2 py-1 rounded-full">
                                      {item.handle.brand} - {item.handle.color}
                                    </span>
                                  )}
                                  {item.hardware && (
                                    <span className="bg-slate-100 px-2 py-1 rounded-full">
                                      {item.hardware.brand} -{" "}
                                      {item.hardware.name}
                                    </span>
                                  )}
                                  {item.accessory && (
                                    <span className="bg-slate-100 px-2 py-1 rounded-full">
                                      {item.accessory.name}
                                    </span>
                                  )}
                                  {item.edging_tape && (
                                    <span className="bg-slate-100 px-2 py-1 rounded-full">
                                      {item.edging_tape.brand} -{" "}
                                      {item.edging_tape.color}
                                    </span>
                                  )}
                                  {!item.sheet &&
                                    !item.handle &&
                                    !item.hardware &&
                                    !item.accessory &&
                                    !item.edging_tape &&
                                    (item.description || "-")}
                                </td>
                                <td className="py-3 px-3 text-xs text-slate-700 text-right font-medium">
                                  {item.quantity}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-slate-400 text-sm">
                        No items data available
                      </div>
                    )}
                  </ChartCard>

                  {/* Recent Logs */}
                  <ChartCard title="Recent Activity">
                    {logsLoading ? (
                      <div className="h-[400px] flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
                      </div>
                    ) : logsData.length > 0 ? (
                      <div className="max-h-[400px] overflow-y-auto space-y-3">
                        {logsData.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100"
                          >
                            <div className="p-2 bg-slate-100 rounded-full">
                              <History className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${getActionColor(
                                    log.action,
                                  )}`}
                                >
                                  {log.action}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {formatTimeAgo(log.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 truncate">
                                {log.description ||
                                  `${log.action} on ${log.entity_type}`}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] text-slate-400">
                                  {log.user?.username || "System"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[400px] flex items-center justify-center text-slate-400 text-sm">
                        No recent activity
                      </div>
                    )}
                  </ChartCard>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
