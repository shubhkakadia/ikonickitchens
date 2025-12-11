"use client";
import React, { useEffect, useState } from "react";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertTriangle,
  FolderKanban,
  Layers,
  ClipboardList,
  ShoppingCart,
  TrendingUp,
  Package,
  RefreshCcw,
  History,
  User,
  ChevronDown,
  Calendar,
  Clock,
  RotateCcw,
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
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import Sidebar from "../../../components/sidebar";

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
  Filler
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

// KPI Card Component
const KPICard = ({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  prefix = "",
}) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          {title}
        </p>
        <h3 className="text-2xl font-bold text-slate-800">
          {prefix}
          {typeof value === "number" ? value.toLocaleString() : value}
        </h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <div
        className={`p-3 rounded-xl ${color} transition-transform duration-300 group-hover:scale-110`}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

// Chart Card Wrapper Component
const ChartCard = ({ title, children, className = "" }) => (
  <div
    className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
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
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [logsData, setLogsData] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState("all");
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [dashboardYearFilter, setDashboardYearFilter] = useState("all");
  const [dashboardYearDropdownOpen, setDashboardYearDropdownOpen] = useState(false);
  const [dashboardMonthFilter, setDashboardMonthFilter] = useState("all");
  const [dashboardMonthDropdownOpen, setDashboardMonthDropdownOpen] = useState(false);

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
      const month = dashboardMonthFilter === "all" ? "all" : dashboardMonthFilter;
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
        }
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
        "An error occurred while fetching dashboard data"
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

  useEffect(() => {
    fetchDashboard();
    fetchLogs();
  }, [dashboardYearFilter, dashboardMonthFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".year-dropdown-container")) {
        setYearDropdownOpen(false);
      }
      if (!event.target.closest(".dashboard-year-dropdown-container")) {
        setDashboardYearDropdownOpen(false);
      }
      if (!event.target.closest(".dashboard-month-dropdown-container")) {
        setDashboardMonthDropdownOpen(false);
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

  // Get available years from spending data
  const getAvailableYears = () => {
    if (!dashboardData?.totalSpent) return [];
    const years = new Set();
    dashboardData.totalSpent.forEach((item) => {
      const year = item.month_year.split("-")[0];
      years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  };

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

  // Get filtered totalSpent for charts (respects dashboard filters)
  const getFilteredTotalSpentForCharts = () => {
    if (!dashboardData?.totalSpent) return [];

    let filtered = dashboardData.totalSpent;

    // Filter by dashboard year filter
    if (dashboardYearFilter !== "all") {
      filtered = filtered.filter(item => item.month_year.startsWith(dashboardYearFilter));
    }

    // Filter by dashboard month filter
    if (dashboardMonthFilter !== "all" && dashboardYearFilter !== "all") {
      const monthStr = dashboardMonthFilter.padStart(2, "0");
      filtered = filtered.filter(item => item.month_year === `${dashboardYearFilter}-${monthStr}`);
    }

    return filtered;
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

  // Transform totalSpent data for Chart.js line chart
  const getSupplierLineChartData = () => {
    // Start with dashboard-filtered data
    let filteredData = getFilteredTotalSpentForCharts();

    // Apply chart's own year filter on top of dashboard filters
    if (selectedYear !== "all") {
      filteredData = filteredData.filter((item) =>
        item.month_year.startsWith(selectedYear)
      );
    }

    if (filteredData.length === 0) return null;

    // Get unique months and suppliers
    const monthsSet = new Set();
    const suppliersSet = new Set();

    filteredData.forEach((item) => {
      monthsSet.add(item.month_year);
      suppliersSet.add((item.supplier?.name || "other").toLowerCase());
    });

    const months = Array.from(monthsSet).sort();
    const suppliers = Array.from(suppliersSet);

    // Build datasets for each supplier
    const datasets = suppliers.map((supplier, index) => {
      const data = months.map((month) => {
        const item = filteredData.find(
          (d) =>
            d.month_year === month &&
            (d.supplier?.name || "other").toLowerCase() === supplier
        );
        return item ? parseFloat(item.amount || 0) : 0;
      });

      const color =
        SUPPLIER_COLORS[supplier] || CHART_COLORS[index % CHART_COLORS.length];

      return {
        label: supplier.charAt(0).toUpperCase() + supplier.slice(1),
        data,
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#fff",
        pointBorderColor: color,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      };
    });

    return {
      labels: months.map(formatMonthYear),
      datasets,
    };
  };

  // Transform lotsByStage for Chart.js doughnut chart
  const getLotsByStageChartData = () => {
    if (!dashboardData?.lotsByStage || dashboardData.lotsByStage.length === 0)
      return null;

    return {
      labels: dashboardData.lotsByStage.map(
        (item) => item.name.charAt(0).toUpperCase() + item.name.slice(1)
      ),
      datasets: [
        {
          data: dashboardData.lotsByStage.map((item) => item._count),
          backgroundColor: CHART_COLORS.slice(
            0,
            dashboardData.lotsByStage.length
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
        item.status.replace(/_/g, " ")
      ),
      datasets: [
        {
          data: dashboardData.MTOsByStatus.map((item) => item._count),
          backgroundColor: CHART_COLORS.slice(
            0,
            dashboardData.MTOsByStatus.length
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
        item.status.replace(/_/g, " ")
      ),
      datasets: [
        {
          data: dashboardData.purchaseOrdersByStatus.map((item) => item._count),
          backgroundColor: CHART_COLORS.slice(
            0,
            dashboardData.purchaseOrdersByStatus.length
          ),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    };
  };

  // Get filtered totalSpent based on year/month filters
  const getFilteredTotalSpent = () => {
    if (!dashboardData?.totalSpent) return [];

    let filtered = dashboardData.totalSpent;

    // Filter by year
    if (dashboardYearFilter !== "all") {
      filtered = filtered.filter(item => item.month_year.startsWith(dashboardYearFilter));
    }

    // Filter by month
    if (dashboardMonthFilter !== "all" && dashboardYearFilter !== "all") {
      const monthStr = dashboardMonthFilter.padStart(2, "0");
      filtered = filtered.filter(item => item.month_year === `${dashboardYearFilter}-${monthStr}`);
    }

    return filtered;
  };

  // Calculate total spent based on filters
  const getTotalSpent = () => {
    const filtered = getFilteredTotalSpent();
    return filtered.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  };

  // Get filtered and sorted stages due (by least days left first)
  const getSortedStagesDue = () => {
    if (!dashboardData?.topstagesDue) return [];

    let filtered = [...dashboardData.topstagesDue];

    // Filter by year
    if (dashboardYearFilter !== "all") {
      filtered = filtered.filter((stage) => {
        if (!stage.endDate) return false;
        const date = new Date(stage.endDate);
        if (isNaN(date.getTime())) return false;
        return date.getFullYear().toString() === dashboardYearFilter;
      });
    }

    // Filter by month
    if (dashboardMonthFilter !== "all" && dashboardYearFilter !== "all") {
      filtered = filtered.filter((stage) => {
        if (!stage.endDate) return false;
        const date = new Date(stage.endDate);
        if (isNaN(date.getTime())) return false;
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

  const supplierChartData = getSupplierLineChartData();
  const lotsByStageChartData = getLotsByStageChartData();
  const mtosByStatusChartData = getMTOsByStatusChartData();
  const posByStatusChartData = getPOsByStatusChartData();
  const availableYears = getAvailableYears();
  const sortedStagesDue = getSortedStagesDue();

  // Chart.js options for line chart
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
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
            return `${context.dataset.label
              }: $${context.parsed.y.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#64748b",
          font: { size: 12 },
        },
      },
      y: {
        grid: {
          color: "#e2e8f0",
        },
        ticks: {
          color: "#64748b",
          font: { size: 12 },
          callback: (value) => `$${value}`,
        },
      },
    },
  };

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
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                      Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                      Overview of your business operations
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Reset Filters Button - Only show when filters are applied */}
                    {(dashboardYearFilter !== "all" || dashboardMonthFilter !== "all") && (
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
                        onClick={() => setDashboardYearDropdownOpen(!dashboardYearDropdownOpen)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {dashboardYearFilter === "all" ? "All Years" : dashboardYearFilter}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {dashboardYearDropdownOpen && (
                        <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              setDashboardYearFilter("all");
                              setDashboardYearDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${dashboardYearFilter === "all"
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
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${dashboardYearFilter === year
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
                            setDashboardMonthDropdownOpen(!dashboardMonthDropdownOpen);
                          }
                        }}
                        disabled={dashboardYearFilter === "all"}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${dashboardYearFilter === "all"
                          ? "text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed"
                          : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                          }`}
                      >
                        {dashboardMonthFilter === "all" ? "All Months" : formatMonthName(dashboardMonthFilter)}
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {dashboardMonthDropdownOpen && dashboardYearFilter !== "all" && (
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              setDashboardMonthFilter("all");
                              setDashboardMonthDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${dashboardMonthFilter === "all"
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
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${dashboardMonthFilter === month.toString()
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

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <KPICard
                    title="Active Projects"
                    value={dashboardData?.activeProjects || 0}
                    icon={FolderKanban}
                    color="bg-linear-to-br from-blue-500 to-blue-600"
                    subtitle="Currently in progress"
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
                  />
                  <KPICard
                    title="Purchase Orders"
                    value={dashboardData?.activePurchaseOrders || 0}
                    icon={ShoppingCart}
                    color="bg-linear-to-br from-amber-500 to-amber-600"
                    subtitle="Active orders"
                  />
                  <KPICard
                    title="Total Spent this year"
                    value={getTotalSpent()}
                    icon={TrendingUp}
                    color="bg-linear-to-br from-slate-700 to-slate-800"
                    subtitle="Across all suppliers"
                    prefix="$"
                  />
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
                              Lot
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
                                  {stage.lot_id}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase ${getStatusColor(
                                      stage.status
                                    )}`}
                                  >
                                    {stage.status?.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-sm text-slate-600">
                                  {stage.endDate &&
                                    new Date(stage.endDate).getFullYear() > 2000
                                    ? new Date(
                                      stage.endDate
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

                {/* Status Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Lots by Stage */}
                  <ChartCard title="Lots by Stage">
                    {lotsByStageChartData ? (
                      <div style={{ height: "250px" }}>
                        <Doughnut
                          data={lotsByStageChartData}
                          options={doughnutChartOptions}
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

                {/* Supplier Spending Line Chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Supplier Spending
                    </h3>
                    {/* Year Dropdown */}
                    <div className="relative year-dropdown-container">
                      <button
                        onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {selectedYear === "all" ? "All Years" : selectedYear}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      {yearDropdownOpen && (
                        <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              setSelectedYear("all");
                              setYearDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${selectedYear === "all"
                              ? "text-secondary font-medium"
                              : "text-slate-600"
                              }`}
                          >
                            All Years
                          </button>
                          {availableYears.map((year) => (
                            <button
                              key={year}
                              onClick={() => {
                                setSelectedYear(year);
                                setYearDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${selectedYear === year
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
                  </div>
                  <div className="p-5">
                    {supplierChartData ? (
                      <div style={{ height: "280px" }}>
                        <Line
                          data={supplierChartData}
                          options={lineChartOptions}
                        />
                      </div>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">
                        No spending data available
                        {selectedYear !== "all" && " for " + selectedYear}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Items and Logs - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                                    log.action
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
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AdminRoute>
  );
}
