"use client";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import { ChevronLeft, Building2, User, Plus, X, Mail, Phone, IdCardLanyard, NotebookText, PhoneCall, Trash2, Edit } from "lucide-react";
import React, { useState } from "react";
import Sidebar from "@/components/sidebar";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function page() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    notes: "",
    abn_number: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    preferred_contact_method: "",
    notes: "",
    role: "",
  });
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState(null);

  const { getToken } = useAuth();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }
      // Prepare contacts data - map to API format
      const contactsToSend =
        contacts && contacts.length > 0
          ? contacts.map((contact) => ({
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email || null,
            phone: contact.phone || null,
            role: contact.role || null,
            preferred_contact_method: contact.preferred_contact_method || null,
            notes: contact.notes || null,
          }))
          : [];

      const data = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        notes: formData.notes,
        website: formData.website,
        abn_number: formData.abn_number,
        contacts: contactsToSend,
      };

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "/api/supplier/create",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        data: data,
      };

      const response = await axios.request(config);

      // Treat non-success statuses (status !== true) as errors
      const apiStatus = response?.data?.status;
      const apiMessage = response?.data?.message;
      if (apiStatus !== true) {
        const message =
          apiMessage || "An error occurred while creating the supplier";
        toast.error(message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setErrors({ submit: message });
        return;
      }

      // Reset form on success
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
        website: "",
        notes: "",
        abn_number: "",
      });
      setContacts([]);

      // Show success toast
      toast.success("Supplier created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error creating supplier:", error);

      // Handle different types of errors
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.response) {
        // Server responded with error status
        errorMessage =
          error.response.data?.message ||
          "An error occurred while creating the supplier";
      } else if (error.request) {
        // Request was made but no response received
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      // Show error toast
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Also set error in state for form display
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) {
      newErrors.name = "Supplier Name is required";
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const openAddContactModal = () => {
    setContactDraft({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      preferred_contact_method: "",
      notes: "",
      role: "",
    });
    setEditingContactIndex(null);
    setIsContactModalOpen(true);
  };

  const handleEditContact = (index) => {
    const contactToEdit = contacts[index];
    setContactDraft({
      first_name: contactToEdit.first_name || "",
      last_name: contactToEdit.last_name || "",
      email: contactToEdit.email || "",
      phone: contactToEdit.phone || "",
      preferred_contact_method: contactToEdit.preferred_contact_method || "",
      notes: contactToEdit.notes || "",
      role: contactToEdit.role || "",
    });
    setEditingContactIndex(index);
    setIsContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setIsContactModalOpen(false);
    setEditingContactIndex(null);
    setContactDraft({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      preferred_contact_method: "",
      notes: "",
      role: "",
    });
  };

  const handleSaveContact = () => {
    // Validate required fields
    if (!contactDraft.first_name || !contactDraft.last_name) {
      toast.error("First Name and Last Name are required", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    setIsSavingContact(true);
    try {
      if (editingContactIndex !== null) {
        // Update existing contact
        const updatedContacts = [...contacts];
        updatedContacts[editingContactIndex] = {
          ...contactDraft,
          id: contacts[editingContactIndex].id, // Keep the same ID
        };
        setContacts(updatedContacts);
        handleCloseContactModal();
        toast.success("Contact updated successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      } else {
        // Add new contact
        const newContact = {
          ...contactDraft,
          id: `temp-${Date.now()}`, // Temporary ID for display
        };
        setContacts([...contacts, newContact]);
        handleCloseContactModal();
        toast.success("Contact added successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (err) {
      console.error("Save contact failed", err);
      toast.error(editingContactIndex !== null ? "Failed to update contact" : "Failed to add contact", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleRemoveContact = (index) => {
    const updatedContacts = contacts.filter((_, i) => i !== index);
    setContacts(updatedContacts);
    toast.success("Contact removed", {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
    });
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="h-full w-full overflow-y-auto">
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-4">
                <TabsController href="/admin/suppliers" title="Suppliers">
                  <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronLeft className="w-8 h-8 text-slate-600" />
                  </div>
                </TabsController>
                <h1 className="text-2xl font-bold text-slate-600">
                  Add New Supplier
                </h1>
              </div>

              {/* form */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* supplier information section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold text-slate-800">
                        Supplier Information
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Supplier Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${errors.name ? "border-red-500" : "border-slate-300"
                            }`}
                          placeholder="Eg. Polytec Australia"
                          required
                        />
                        {errors.name && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.name}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${errors.email ? "border-red-500" : "border-slate-300"
                            }`}
                          placeholder="Eg. contact@polytec.com.au"
                        />
                        {errors.email && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Address
                      </label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        placeholder="Eg. Adelaide, South Australia"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-800">
                        Contact Information
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. +61 8000 0000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Website
                        </label>
                        <input
                          type="url"
                          name="website"
                          value={formData.website}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. https://www.polytec.com.au"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          ABN Number
                        </label>
                        <input
                          type="text"
                          name="abn_number"
                          value={formData.abn_number}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 font-mono px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. 12345678901"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">
                      Additional Notes
                    </h2>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        placeholder="Any additional notes about the supplier..."
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* Contacts Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-800">
                        Contacts
                      </h2>
                      {contacts.length > 0 && (
                        <button
                          type="button"
                          onClick={openAddContactModal}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-lg transition-all duration-200 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Add Contact
                        </button>
                      )}
                    </div>

                    {/* Empty State - No Contacts */}
                    {contacts.length === 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                        <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 mb-4">
                          No contacts have been added. Click to add a contact.
                        </p>
                        <button
                          type="button"
                          onClick={openAddContactModal}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-lg transition-all duration-200 text-sm font-medium mx-auto"
                        >
                          <Plus className="w-4 h-4" />
                          Add Contact
                        </button>
                      </div>
                    )}

                    {/* Contact Cards */}
                    {contacts.length > 0 && (
                      <div className="space-y-3">
                        {contacts.map((contact, index) => (
                          <div
                            key={contact.id || index}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <User className="w-4 h-4 text-slate-600" />
                                  <h3 className="font-semibold text-slate-800">
                                    {contact.first_name} {contact.last_name}
                                  </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                  {contact.email && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-slate-500" />
                                      <span className="text-slate-700">{contact.email}</span>
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-slate-500" />
                                      <span className="text-slate-700">{contact.phone}</span>
                                    </div>
                                  )}
                                  {contact.role && (
                                    <div className="flex items-center gap-2">
                                      <IdCardLanyard className="w-4 h-4 text-slate-500" />
                                      <span className="text-slate-700">{contact.role}</span>
                                    </div>
                                  )}
                                  {contact.preferred_contact_method && (
                                    <div className="flex items-center gap-2">
                                      <PhoneCall className="w-4 h-4 text-slate-500" />
                                      <span className="text-slate-700 capitalize">
                                        {contact.preferred_contact_method}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {contact.notes && (
                                  <div className="mt-2 flex items-start gap-2">
                                    <NotebookText className="w-4 h-4 text-slate-500 mt-0.5" />
                                    <p className="text-sm text-slate-700">{contact.notes}</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditContact(index)}
                                  className="cursor-pointer p-2 rounded-lg hover:bg-slate-200 transition-colors"
                                  title="Edit contact"
                                >
                                  <Edit className="w-4 h-4 text-blue-600" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveContact(index)}
                                  className="cursor-pointer p-2 rounded-lg hover:bg-slate-200 transition-colors"
                                  title="Remove contact"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-6">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`cursor-pointer px-8 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${isLoading
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-primary/80 hover:bg-primary text-white"
                        }`}
                    >
                      {isLoading ? "Creating Supplier..." : "Create Supplier"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={handleCloseContactModal}
          />
          <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-700">
                    {editingContactIndex !== null ? "Edit Contact" : "Add Contact"}
                  </div>
                  <div className="text-xs text-slate-500">
                    Supplier: {formData.name || "New Supplier"}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseContactModal}
                className="cursor-pointer p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactDraft.first_name}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        first_name: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="e.g. Sophia"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactDraft.last_name}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        last_name: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="e.g. Evans"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={contactDraft.email}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        email: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="e.g. sophia.evans@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={contactDraft.phone}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        phone: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="e.g. +61 434 888 999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Preferred Contact Method
                  </label>
                  <select
                    value={contactDraft.preferred_contact_method}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        preferred_contact_method: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                  >
                    <option value="">Select method</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    value={contactDraft.role}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        role: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="e.g. Manager, Accountant"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={contactDraft.notes}
                    onChange={(e) =>
                      setContactDraft({
                        ...contactDraft,
                        notes: e.target.value,
                      })
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="Add notes"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={handleCloseContactModal}
                disabled={isSavingContact}
                className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContact}
                disabled={isSavingContact}
                className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingContact
                  ? (editingContactIndex !== null ? "Updating..." : "Adding...")
                  : (editingContactIndex !== null ? "Update Contact" : "Add Contact")}
              </button>
            </div>
          </div>
        </div>
      )}

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
