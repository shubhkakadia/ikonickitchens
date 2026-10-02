"use client";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  Trash2,
  X,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import SearchBar from "@/components/SearchBar";
import useModalFocus from "@/hooks/useModalFocus";

const EMPTY = "—";
const SESSION_ERROR = "Your session has expired. Sign in again.";
const TABLE_COLUMNS = 3;

// Each tab is one config category. `noun` is the sentence-case name used in
// buttons, placeholders and messages (DESIGN.md 15.7).
const TABS = [
  { id: "role", label: "Role", noun: "role", example: "e.g. Installer" },
  {
    id: "hardware",
    label: "Hardware",
    noun: "hardware",
    example: "e.g. Hinges",
  },
  {
    id: "measuring_unit",
    label: "Measuring unit",
    noun: "measuring unit",
    example: "e.g. each",
  },
  { id: "finish", label: "Finish", noun: "finish", example: "e.g. Matt" },
  { id: "brand", label: "Brand", noun: "brand", example: "e.g. Polytec" },
];

// DESIGN.md 9.1 / 9.2 / 9.5 recipes. One primary button per view or modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";
const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const TH =
  "px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider";

// Records show the year, so this is local rather than the compact shared
// formatDate. Australian locale (DESIGN.md 15.7).
const formatCreated = (value) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Modal for adding a config value (DESIGN.md 9.4, 15.3): focus trap, Escape
// closes, Enter submits, inline required error, one primary button.
function ConfigValueModal({
  title,
  noun,
  example,
  value,
  error,
  saving,
  onChange,
  onSubmit,
  onClose,
  returnFocusId,
}) {
  const panelRef = useRef(null);
  useModalFocus(panelRef, true);

  // The empty-state "Add" button unmounts with the list refresh, so hand focus
  // to the always-present header button when the modal goes away.
  useEffect(
    () => () => {
      document.getElementById(returnFocusId)?.focus({ preventScroll: true });
    },
    [returnFocusId],
  );

  // Modals close on Escape (DESIGN.md 9.4), but not while saving.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || saving) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [saving, onClose]);

  const inputId = "config-value-input";
  const errorId = "config-value-error";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    onSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
      onClick={() => {
        // A form with typed input must not close on a stray backdrop click.
        if (!saving && !value) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white w-full max-w-lg rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-value-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="config-value-title"
            className="text-lg font-semibold text-slate-800"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col min-h-0 flex-1"
        >
          <div className="flex-1 overflow-y-auto p-6">
            <label htmlFor={inputId} className={LABEL}>
              Value{" "}
              <span className="text-red-600" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={inputId}
              data-autofocus
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={example}
              aria-required="true"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errorId : undefined}
              className={`w-full text-sm text-slate-800 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                error
                  ? "border-red-500 focus:ring-red-500"
                  : "border-slate-300 focus:ring-primary"
              }`}
            />
            {error && (
              <p id={errorId} className="text-xs text-red-600 mt-1">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>
              {saving ? (
                <span className={SPINNER} aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4" aria-hidden="true" />
              )}
              Add {noun}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("role");
  const activeTabNoun =
    TABS.find((tab) => tab.id === activeTab)?.noun || "value";
  const activeTabExample =
    TABS.find((tab) => tab.id === activeTab)?.example || "";
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ value: "" });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data based on active tab
  const fetchData = async (category) => {
    if (!category) return;
    try {
      setLoading(true);
      setError(null);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        setError(SESSION_ERROR);
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/v1/config/read_all_by_category`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: { category },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        setData(response.data.data);
      } else {
        setError(
          response.data.message ||
            "Couldn't load the list. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching config data:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load the list. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when active tab changes
  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search) return data;
    const searchLower = search.toLowerCase();
    return data.filter(
      (item) =>
        item.value?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower),
    );
  }, [data, search]);

  // Pagination logic
  const totalItems = filteredData.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Reset to the first page when the displayed configuration set changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  // Handle create
  const handleCreate = async () => {
    if (!formData.value || !formData.value.trim()) {
      setFormError("Enter a value.");
      document.getElementById("config-value-input")?.focus();
      return;
    }

    const noun = activeTabNoun;
    try {
      setIsSubmitting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/v1/config/create`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          category: activeTab,
          value: formData.value.trim(),
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success(`${capitalise(noun)} created.`);
        setShowCreateModal(false);
        setFormData({ value: "" });
        setFormError("");
        fetchData(activeTab);
      } else {
        toast.error(
          response.data.message ||
            `Couldn't create the ${noun}. Check your connection and try again.`,
        );
      }
    } catch (error) {
      console.error("Error creating config:", error);
      const errorMessage =
        error.response?.data?.message ||
        `Couldn't create the ${noun}. Check your connection and try again.`;
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit (no edit UI is rendered on this page yet)
  const handleEdit = async () => {
    if (!formData.value || !formData.value.trim()) {
      setFormError("Enter a value.");
      return;
    }

    if (!selectedItem || !selectedItem.id) {
      toast.error("Select a value to edit.");
      return;
    }

    try {
      setIsSubmitting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        setIsSubmitting(false);
        return;
      }

      const config = {
        method: "patch",
        maxBodyLength: Infinity,
        url: `/api/v1/config/${selectedItem.id}`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          value: formData.value.trim(),
        },
      };

      const response = await axios.request(config);

      if (response.data.status) {
        toast.success("Value updated.");
        setShowEditModal(false);
        setSelectedItem(null);
        setFormData({ value: "" });
        setFormError("");
        fetchData(activeTab);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update the value. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error updating config:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Couldn't update the value. Check your connection and try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedItem) return;

    const noun = activeTabNoun;
    try {
      setIsDeleting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      const config = {
        method: "delete",
        maxBodyLength: Infinity,
        url: `/api/v1/config/${selectedItem.id}`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success(`${capitalise(noun)} deleted.`);
        setShowDeleteModal(false);
        setSelectedItem(null);
        fetchData(activeTab);
      } else {
        toast.error(
          response.data.message ||
            `Couldn't delete the ${noun}. Check your connection and try again.`,
        );
      }
    } catch (error) {
      console.error("Error deleting config:", error);
      const errorMessage =
        error.response?.data?.message ||
        `Couldn't delete the ${noun}. Check your connection and try again.`;
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open edit modal
  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormData({ value: item.value || "" });
    setFormError("");
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  // Open create modal
  const openCreateModal = () => {
    setFormData({ value: "" });
    setFormError("");
    setShowCreateModal(true);
  };

  // Close modals
  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedItem(null);
    setFormData({ value: "" });
    setFormError("");
  };

  const tabClass = (id) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded-t-sm ${
      activeTab === id
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-800">
              Configuration
            </h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                id="config-add-button"
                onClick={openCreateModal}
                className={BTN_PRIMARY}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add {activeTabNoun}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Tabs section */}
            <div className="px-4 shrink-0 border-b border-slate-200">
              <div
                className="flex space-x-6 overflow-x-auto"
                role="tablist"
                aria-label="Configuration category"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`config-tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls="config-panel"
                    onClick={() => setActiveTab(tab.id)}
                    className={tabClass(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search section */}
            <div className="p-4 shrink-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                  <Search
                    className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label={`Search ${activeTabNoun} values`}
                    placeholder={`Search ${activeTabNoun} values`}
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Table section */}
            <div
              id="config-panel"
              role="tabpanel"
              aria-labelledby={`config-tab-${activeTab}`}
              className="flex-1 overflow-auto"
            >
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={TH}>
                        Value
                      </th>
                      <th scope="col" className={TH}>
                        Created at
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="status"
                          >
                            <span
                              className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              Loading {activeTabNoun} values…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="alert"
                          >
                            <AlertTriangle
                              className="w-8 h-8 text-red-500"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                              type="button"
                              onClick={() => fetchData(activeTab)}
                              className={`${BTN_SECONDARY} py-1.5`}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <ListChecks
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {data.length > 0 && search ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No {activeTabNoun} values match your search
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setSearch("")}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  Clear filters
                                </button>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-slate-600">
                                  No {activeTabNoun} values yet
                                </p>
                                <button
                                  type="button"
                                  onClick={openCreateModal}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <Plus
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Add {activeTabNoun}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 transition-colors duration-200"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">
                            {item.value ? (
                              <span
                                className="block max-w-md truncate"
                                title={item.value}
                              >
                                {item.value}
                              </span>
                            ) : (
                              EMPTY
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                            {formatCreated(item.createdAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteModal(item);
                                }}
                                className="cursor-pointer p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                                aria-label={`Delete ${item.value || activeTabNoun}`}
                                title="Delete"
                              >
                                <Trash2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination footer */}
            {!loading && !error && paginatedData.length > 0 && (
              <PaginationFooter
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemsPerPageOptions={[25, 50, 100, 0]}
                showItemsPerPage={true}
              />
            )}
          </div>
        </div>
      </main>

      {/* Add modal */}
      {showCreateModal && (
        <ConfigValueModal
          title={`Add ${activeTabNoun}`}
          noun={activeTabNoun}
          example={activeTabExample}
          value={formData.value}
          error={formError}
          saving={isSubmitting}
          onChange={(value) => {
            setFormData({ ...formData, value });
            setFormError("");
          }}
          onSubmit={handleCreate}
          onClose={closeModals}
          returnFocusId="config-add-button"
        />
      )}

      {/* Delete confirmation */}
      <DeleteConfirmation
        isOpen={showDeleteModal}
        onClose={closeModals}
        onConfirm={handleDelete}
        heading={activeTabNoun}
        message={`Delete the ${activeTabNoun} "${selectedItem?.value}"? This can't be undone.`}
        isDeleting={isDeleting}
      />
    </AdminShell>
  );
}
