"use client";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
  Edit,
  Mail,
  Phone,
  Link2,
  NotebookText,
  X,
  MapPin,
  Trash2,
  Plus,
  Eye,
  AlertTriangle,
  User,
  Package,
  FileText,
  PackagePlus,
  Search,
  Receipt,
  BarChart3,
  Boxes,
  Copy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ContactPopup from "@/components/contactpopup";
import { CiMenuKebab } from "react-icons/ci";
import MaterialsToOrder from "../components/MaterialsToOrder";
import PurchaseOrder from "../components/PurchaseOrder";
import Statement from "../components/Statement";

export default function page() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({});
  const [showDeleteSupplierModal, setShowDeleteSupplierModal] = useState(false);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [contactPendingDelete, setContactPendingDelete] = useState(null);
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState("materials-to-order");
  // moved to MaterialsToOrder component
  const [mtoCount, setMtoCount] = useState(0);
  const [poCount, setPoCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsCategoryTab, setItemsCategoryTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchSupplier();
  }, [id]);

  useEffect(() => {
    if (activeTab === "items") {
      fetchItems();
    }
  }, [activeTab, id]);

  // PO fetching moved into PurchaseOrder component

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".dropdown-container")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.get(`/api/supplier/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setSupplier(response.data.data);
        setContacts(response.data.data.contacts || []);
      } else {
        setError(response.data.message || "Failed to fetch supplier data");
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
          "An error occurred while fetching supplier data"
      );
    } finally {
      setLoading(false);
    }
  };

  // moved to MaterialsToOrder component

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        return;
      }

      const response = await axios.get(`/api/item/by-supplier/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setItems(response.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
      toast.error(err.response?.data?.message || "Failed to fetch items", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setLoadingItems(false);
    }
  };

  // fetchPurchaseOrders moved into PurchaseOrder component

  const handleEdit = () => {
    if (supplier) {
      setEditData({
        name: supplier.name || "",
        address: supplier.address || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        website: supplier.website || "",
        notes: supplier.notes || "",
        abn_number: supplier.abn_number || "",
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.patch(`/api/supplier/${id}`, editData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        setSupplier(response.data.data);
        toast.success("Supplier updated successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setIsEditing(false);
      } else {
        toast.error(response.data.message || "Failed to update supplier", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (error) {
      console.error("Error updating supplier:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to update supplier. Please try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openContactModal = (contact) => {
    setSelectedContact(contact);
    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsContactModalOpen(false);
    setSelectedContact(null);
  };

  const saveEditContact = async (contactData, contactId) => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      const payload = {
        ...contactData,
        supplier_id:
          selectedContact?.supplier_id || supplier?.supplier_id || "",
      };
      const response = await axios.patch(`/api/contact/${contactId}`, payload, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response?.data?.status) {
        toast.error(response?.data?.message || "Failed to update contact");
        return;
      }
      const updated = response.data.data;
      setContacts((prev) =>
        prev.map((c) => (c.contact_id === updated.contact_id ? updated : c))
      );
      setSelectedContact(updated);
      toast.success("Contact updated successfully");
    } catch (err) {
      console.error("Update contact failed", err);
      toast.error(err?.response?.data?.message || "An error occurred");
      throw err;
    }
  };

  const formatValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "null"
    ) {
      return "-";
    }
    if (typeof value === "string" && value.trim() === "") {
      return "-";
    }
    return value;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
    return `${parts[0][0] || ""}${
      parts[parts.length - 1][0] || ""
    }`.toUpperCase();
  };

  const handleDeleteContact = (contactId) => {
    // open confirmation modal without input
    const contact = contacts.find((c) => c.contact_id === contactId);
    setContactPendingDelete(contact || null);
    setShowDeleteContactModal(true);
  };

  const handleDeleteContactCancel = () => {
    setShowDeleteContactModal(false);
    setContactPendingDelete(null);
  };

  const handleDeleteContactConfirm = async () => {
    if (!contactPendingDelete) return;
    try {
      setIsDeletingContact(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      const contactId = contactPendingDelete.contact_id;
      const response = await axios.delete(`/api/contact/${contactId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response?.data?.status) {
        toast.error(response?.data?.message || "Failed to delete contact");
        return;
      }
      setContacts((prev) => prev.filter((c) => c.contact_id !== contactId));
      toast.success("Contact deleted successfully");
      setShowDeleteContactModal(false);
      setContactPendingDelete(null);
    } catch (err) {
      console.error("Delete contact failed", err);
      toast.error(err?.response?.data?.message || "An error occurred");
    } finally {
      setIsDeletingContact(false);
    }
  };

  const handleDeleteSupplierConfirm = async () => {
    try {
      setIsDeletingSupplier(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      const response = await axios.delete(
        `/api/supplier/${supplier.supplier_id}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      if (!response?.data?.status) {
        toast.error(response?.data?.message || "Failed to delete supplier");
        return;
      }
      toast.success("Supplier deleted successfully");
      setShowDeleteSupplierModal(false);
      // Navigate back to suppliers list
      window.location.href = "/admin/suppliers";
    } catch (err) {
      console.error("Delete supplier failed", err);
      toast.error(err?.response?.data?.message || "An error occurred");
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  const handleCreateContact = async (contactData) => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const payload = {
        ...contactData,
        supplier_id: supplier?.supplier_id || "",
      };

      const response = await axios.post("/api/contact/create", payload, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!response?.data?.status) {
        toast.error(response?.data?.message || "Failed to create contact");
        throw new Error(response?.data?.message || "Failed to create contact");
      }

      const created = response.data.data;
      setContacts((prev) => [created, ...prev]);
      toast.success("Contact created successfully");
      setIsContactModalOpen(false);
      setSelectedContact(null);
    } catch (err) {
      console.error("Create contact failed", err);
      toast.error(err?.response?.data?.message || "An error occurred");
      throw err;
    }
  };

  const openAddContactModal = () => {
    setSelectedContact(null);
    setIsContactModalOpen(true);
  };

  return (
    <div className="flex h-screen bg-tertiary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <CRMLayout />
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                <p className="text-slate-600">Loading supplier details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : !supplier ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">Supplier not found</p>
              </div>
            </div>
          ) : (
            <div className="p-3">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <TabsController href="/admin/suppliers" title="Suppliers">
                  <div className="cursor-pointer p-2 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronLeft className="w-6 h-6 text-slate-600" />
                  </div>
                </TabsController>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-slate-600">
                    {supplier.name}
                  </h1>
                </div>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <div className="relative dropdown-container">
                      <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <CiMenuKebab className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-600">More Actions</span>
                      </button>

                      {showDropdown && (
                        <div className="absolute right-0 mt-2 w-50 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                handleEdit();
                                setShowDropdown(false);
                              }}
                              className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                            >
                              <Edit className="w-4 h-4" />
                              Edit Supplier Details
                            </button>
                            <button
                              onClick={() => {
                                setShowDeleteSupplierModal(true);
                                setShowDropdown(false);
                              }}
                              className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Supplier
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Edit className="w-4 h-4" />
                        {isUpdating ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Basic Information and Contacts Section */}
                <div className="grid grid-cols-10 gap-4">
                  {/* Basic Information - 70% width */}
                  <div className="col-span-7">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center text-white text-lg font-bold">
                          {getInitials(supplier.name)}
                        </div>
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={editData.name || ""}
                                onChange={(e) =>
                                  handleInputChange("name", e.target.value)
                                }
                                placeholder={supplier.name}
                                className="text-xl font-bold text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                              />
                              <p className="text-sm text-slate-500">
                                Supplier ID: {supplier.supplier_id}
                              </p>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="email"
                                    value={editData.email || ""}
                                    onChange={(e) =>
                                      handleInputChange("email", e.target.value)
                                    }
                                    placeholder={supplier.email || "Email"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="tel"
                                    value={editData.phone || ""}
                                    onChange={(e) =>
                                      handleInputChange("phone", e.target.value)
                                    }
                                    placeholder={supplier.phone || "Phone"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Link2 className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="url"
                                    value={editData.website || ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        "website",
                                        e.target.value
                                      )
                                    }
                                    placeholder={supplier.website || "Website"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-slate-600">ABN</p>
                                  <input
                                    type="text"
                                    value={editData.abn_number || ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        "abn_number",
                                        e.target.value
                                      )
                                    }
                                    placeholder={
                                      supplier.abn_number || "ABN Number"
                                    }
                                    className="text-sm text-slate-600 font-mono px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="text"
                                    value={editData.address || ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        "address",
                                        e.target.value
                                      )
                                    }
                                    placeholder={supplier.address || "Address"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-start gap-2">
                                  <NotebookText className="w-4 h-4 text-slate-600 mt-1" />
                                  <textarea
                                    value={editData.notes || ""}
                                    onChange={(e) =>
                                      handleInputChange("notes", e.target.value)
                                    }
                                    placeholder={formatValue(supplier.notes)}
                                    rows={3}
                                    className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-lg font-bold text-slate-800">
                                  {supplier.name}
                                </h2>
                              </div>
                              <p className="text-xs text-slate-500 mb-3">
                                ID: {supplier.supplier_id}
                              </p>
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-3 text-sm">
                                  <a href={`mailto:${supplier.email}`}>
                                    <div className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800">
                                      <Mail className="w-3.5 h-3.5" />
                                      {formatValue(supplier.email)}
                                    </div>
                                  </a>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Phone className="w-3.5 h-3.5" />
                                    {formatValue(supplier.phone)}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Link2 className="w-3.5 h-3.5" />
                                    {supplier.website ? (
                                      <a
                                        className="text-primary hover:underline"
                                        href={supplier.website}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {supplier.website}
                                      </a>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600 font-mono">
                                    ABN: {formatValue(supplier.abn_number)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                  <MapPin className="w-3.5 h-3.5" />
                                  {formatValue(supplier.address)}
                                </div>
                                <div className="flex items-start gap-1.5 text-slate-600">
                                  <NotebookText className="w-3.5 h-3.5 mt-0.5" />
                                  <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                                    {formatValue(supplier.notes)}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contacts - 30% width */}
                  <div className="col-span-3">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full">
                      <div className="flex items-center justify-between p-3 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          Contacts
                        </h3>
                        <span className="text-xs text-slate-500">
                          {contacts?.length || 0}
                        </span>
                      </div>

                      <div className="p-3">
                        {!contacts || contacts.length === 0 ? (
                          <div className="text-center py-6 text-slate-500">
                            <User className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                            <p className="text-sm">No contacts</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {contacts.map((contact) => (
                              <div
                                key={contact.contact_id}
                                onClick={() => openContactModal(contact)}
                                className="cursor-pointer group text-left border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors rounded px-2 py-1.5 flex items-center gap-2 justify-between"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className="shrink-0 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200">
                                    <User className="w-2.5 h-2.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-700 truncate text-xs">
                                      {contact.first_name} {contact.last_name}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                      {contact.email}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openContactModal(contact);
                                    }}
                                    className="cursor-pointer p-2 rounded hover:bg-slate-100"
                                    title="View"
                                  >
                                    <Eye className="w-3 h-3 text-slate-600" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteContact(contact.contact_id);
                                    }}
                                    className="cursor-pointer p-2 rounded hover:bg-slate-100"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={openAddContactModal}
                          className="cursor-pointer flex items-center text-sm hover:text-secondary mt-4 text-left"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Contact
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Tab Section */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                  {/* Main Tab Navigation */}
                  <div className="border-b border-slate-200">
                    <nav className="flex space-x-8 px-4">
                      <button
                        onClick={() => setActiveTab("materials-to-order")}
                        className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === "materials-to-order"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Materials to Order
                          {mtoCount > 0 && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {mtoCount}
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab("purchase-order")}
                        className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === "purchase-order"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PackagePlus className="w-4 h-4" />
                          Purchase Order
                          {poCount > 0 && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {poCount}
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab("statements")}
                        className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === "statements"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          Statements
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab("cost-sheet")}
                        className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === "cost-sheet"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Cost Sheet
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab("items")}
                        className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm ${
                          activeTab === "items"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Items
                        </div>
                      </button>
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4">
                    {/* Materials to Order Tab */}
                    {activeTab === "materials-to-order" && (
                      <MaterialsToOrder
                        supplier={supplier}
                        supplierId={id}
                        onCountChange={setMtoCount}
                      />
                    )}

                    {/* Purchase Order Tab */}
                    {activeTab === "purchase-order" && (
                      <PurchaseOrder
                        supplierId={id}
                        onCountChange={setPoCount}
                      />
                    )}

                    {/* Statements Tab */}
                    {activeTab === "statements" && (
                      <Statement supplierId={id} />
                    )}

                    {/* Cost Sheet Tab */}
                    {activeTab === "cost-sheet" && (
                      <div className="text-center py-8 text-slate-500">
                        <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm">
                          No cost sheet found for this supplier
                        </p>
                      </div>
                    )}

                    {/* Items Tab */}
                    {activeTab === "items" && (
                      <div>
                        {/* Search Bar */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 w-[350px] relative">
                            <Search className="h-4 w-4 absolute left-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search items..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full text-slate-800 p-2 pl-8 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                            />
                          </div>
                        </div>

                        {/* Category Sub-tabs */}
                        <div className="border-b border-slate-200 mb-4">
                          <nav className="flex space-x-6">
                            {/* Always show "All" tab */}
                            <button
                              onClick={() => setItemsCategoryTab("all")}
                              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                itemsCategoryTab === "all"
                                  ? "border-primary text-primary"
                                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                              }`}
                            >
                              All
                            </button>
                            {/* Show category tabs only if items exist in that category */}
                            {items.some(
                              (item) => item.category === "SHEET"
                            ) && (
                              <button
                                onClick={() => setItemsCategoryTab("SHEET")}
                                className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                  itemsCategoryTab === "SHEET"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                Sheet
                              </button>
                            )}
                            {items.some(
                              (item) => item.category === "HANDLE"
                            ) && (
                              <button
                                onClick={() => setItemsCategoryTab("HANDLE")}
                                className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                  itemsCategoryTab === "HANDLE"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                Handle
                              </button>
                            )}
                            {items.some(
                              (item) => item.category === "HARDWARE"
                            ) && (
                              <button
                                onClick={() => setItemsCategoryTab("HARDWARE")}
                                className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                  itemsCategoryTab === "HARDWARE"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                Hardware
                              </button>
                            )}
                            {items.some(
                              (item) => item.category === "ACCESSORY"
                            ) && (
                              <button
                                onClick={() => setItemsCategoryTab("ACCESSORY")}
                                className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                  itemsCategoryTab === "ACCESSORY"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                Accessory
                              </button>
                            )}
                            {items.some(
                              (item) => item.category === "EDGING_TAPE"
                            ) && (
                              <button
                                onClick={() =>
                                  setItemsCategoryTab("EDGING_TAPE")
                                }
                                className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                  itemsCategoryTab === "EDGING_TAPE"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                Edging Tape
                              </button>
                            )}
                          </nav>
                        </div>

                        {/* Items Table */}
                        {loadingItems ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
                          </div>
                        ) : items.length === 0 ? (
                          <div className="text-center py-8 text-slate-500">
                            <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                            <p className="text-sm">
                              No items found for this supplier
                            </p>
                          </div>
                        ) : (
                          (() => {
                            // Filter items by category and search
                            const filteredItems = items.filter((item) => {
                              // Category filter
                              if (
                                itemsCategoryTab !== "all" &&
                                item.category !== itemsCategoryTab
                              ) {
                                return false;
                              }
                              // Search filter
                              if (searchQuery) {
                                const query = searchQuery.toLowerCase();
                                return (
                                  item.category
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.description
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.handle?.color
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.handle?.type
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.sheet?.color
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.hardware?.name
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.accessory?.name
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.edging_tape?.brand
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.edging_tape?.color
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.edging_tape?.finish
                                    ?.toLowerCase()
                                    .includes(query) ||
                                  item.edging_tape?.dimensions
                                    ?.toLowerCase()
                                    .includes(query)
                                );
                              }
                              return true;
                            });

                            return filteredItems.length === 0 ? (
                              <div className="text-center py-8 text-slate-500">
                                <Search className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                <p className="text-sm">
                                  No items match your search criteria
                                </p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Image
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Category
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Description
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Details
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Price
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        Quantity
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-slate-200">
                                    {filteredItems.map((item) => (
                                      <tr
                                        key={item.item_id}
                                        className="hover:bg-slate-50 transition-colors"
                                      >
                                        {/* Image Column */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <div className="flex items-center">
                                            {item.image?.url ? (
                                              <img
                                                src={`/${item.image.url}`}
                                                alt={item.item_id}
                                                className="w-12 h-12 object-cover rounded border border-slate-200"
                                                onError={(e) => {
                                                  e.target.style.display =
                                                    "none";
                                                  e.target.nextSibling.style.display =
                                                    "flex";
                                                }}
                                              />
                                            ) : null}
                                            <div
                                              className={`w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center ${
                                                item.image?.url
                                                  ? "hidden"
                                                  : "flex"
                                              }`}
                                            >
                                              <Package className="w-6 h-6 text-slate-400" />
                                            </div>
                                          </div>
                                        </td>

                                        {/* Category Column */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                            {item.category}
                                          </span>
                                        </td>

                                        {/* Description Column */}
                                        <td className="px-4 py-2">
                                          <p className="text-xs text-slate-600">
                                            {item.description || "-"}
                                          </p>
                                        </td>

                                        {/* Details Column */}
                                        <td className="px-4 py-2">
                                          <div className="text-xs text-slate-600 space-y-1">
                                            {item.sheet && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.sheet.brand}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Color:
                                                  </span>{" "}
                                                  {item.sheet.color}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Finish:
                                                  </span>{" "}
                                                  {item.sheet.finish}
                                                </div>
                                                {item.sheet.face && (
                                                  <div>
                                                    <span className="font-medium">
                                                      Face:
                                                    </span>{" "}
                                                    {item.sheet.face}
                                                  </div>
                                                )}
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {item.sheet.dimensions}
                                                </div>
                                              </>
                                            )}
                                            {item.handle && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.handle.brand}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Color:
                                                  </span>{" "}
                                                  {item.handle.color}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Type:
                                                  </span>{" "}
                                                  {item.handle.type}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {item.handle.dimensions}
                                                </div>
                                                {item.handle.material && (
                                                  <div>
                                                    <span className="font-medium">
                                                      Material:
                                                    </span>{" "}
                                                    {item.handle.material}
                                                  </div>
                                                )}
                                                {item.handle.brand && (
                                                  <div>
                                                    <span className="font-medium">
                                                      Brand:
                                                    </span>{" "}
                                                    {item.handle.brand}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                            {item.hardware && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Name:
                                                  </span>{" "}
                                                  {item.hardware.name}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Type:
                                                  </span>{" "}
                                                  {item.hardware.type}
                                                </div>
                                                {item.hardware.dimensions && (
                                                  <div>
                                                    <span className="font-medium">
                                                      Dimensions:
                                                    </span>{" "}
                                                    {item.hardware.dimensions}
                                                  </div>
                                                )}
                                                {item.hardware.sub_category && (
                                                  <div>
                                                    <span className="font-medium">
                                                      Sub Category:
                                                    </span>{" "}
                                                    {item.hardware.sub_category}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                            {item.accessory && (
                                              <div>
                                                <span className="font-medium">
                                                  Name:
                                                </span>{" "}
                                                {item.accessory.name}
                                              </div>
                                            )}
                                            {item.edging_tape && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.edging_tape.brand}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Color:
                                                  </span>{" "}
                                                  {item.edging_tape.color}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Finish:
                                                  </span>{" "}
                                                  {item.edging_tape.finish}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {item.edging_tape.dimensions}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </td>

                                        {/* Price Column */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <p className="text-xs text-slate-900">
                                            $
                                            {parseFloat(
                                              item.price || 0
                                            ).toFixed(2)}
                                          </p>
                                        </td>

                                        {/* Quantity Column */}
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <div className="flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-xs text-slate-600">
                                              {item.quantity ?? 0}{" "}
                                              {item.measurement_unit}
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Order modal is now handled inside MaterialsToOrder */}

      {/* Contact Detail Modal */}
      <ContactPopup
        isOpen={isContactModalOpen}
        contact={selectedContact}
        onClose={closeContactModal}
        onSave={saveEditContact}
        onCreate={handleCreateContact}
        parentId={supplier?.supplier_id || ""}
        parentType="supplier"
        parentName={supplier?.name || ""}
      />

      {/* Delete Supplier Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteSupplierModal}
        onClose={() => setShowDeleteSupplierModal(false)}
        onConfirm={handleDeleteSupplierConfirm}
        deleteWithInput={true}
        heading="Supplier"
        message="This will remove the supplier and all associated contacts. This action cannot be undone."
        comparingName={supplier?.name || ""}
        isDeleting={isDeletingSupplier}
      />

      {/* Delete Contact Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteContactModal}
        onClose={handleDeleteContactCancel}
        onConfirm={handleDeleteContactConfirm}
        deleteWithInput={false}
        heading="Contact"
        message={`${contactPendingDelete?.first_name || ""} ${
          contactPendingDelete?.last_name || ""
        } will be removed from this supplier.`}
        isDeleting={isDeletingContact}
      />

      <ToastContainer />
    </div>
  );
}
