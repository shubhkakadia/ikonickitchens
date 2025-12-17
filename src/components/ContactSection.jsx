"use client";
import React, { useState, useEffect } from "react";
import {
    User,
    Eye,
    Trash2,
    Plus,
    Mail,
    Phone,
    NotebookText,
    X,
    Copy,
    IdCardLanyard,
    PhoneCall,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import DeleteConfirmation from "@/components/DeleteConfirmation";

export default function ContactSection({
    contacts = [],
    onContactsUpdate,
    parentId,
    parentType = "client", // "supplier" or "client"
    parentName = "",
}) {
    const { getToken } = useAuth();
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState(null);
    const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
    const [contactPendingDelete, setContactPendingDelete] = useState(null);
    const [isDeletingContact, setIsDeletingContact] = useState(false);
    const [isEditingContact, setIsEditingContact] = useState(false);
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
                [parentType === "supplier" ? "supplier_id" : "client_id"]:
                    selectedContact?.[parentType === "supplier" ? "supplier_id" : "client_id"] ||
                    parentId ||
                    "",
            };
            const response = await axios.patch(`/api/contact/${contactId}`, payload, {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            if (!response?.data?.status) {
                toast.error(response?.data?.message || "Failed to update contact");
                return;
            }
            const updated = response.data.data;
            const updatedContacts = contacts.map((c) =>
                c.id === updated.id ? updated : c
            );
            onContactsUpdate(updatedContacts);
            setSelectedContact(updated);
            toast.success("Contact updated successfully");
        } catch (err) {
            console.error("Update contact failed", err);
            toast.error(err?.response?.data?.message || "An error occurred");
            throw err;
        }
    };

    const handleDeleteContact = (contactId) => {
        const contact = contacts.find((c) => c.id === contactId);
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
            const contactId = contactPendingDelete.id;
            const response = await axios.delete(`/api/contact/${contactId}`, {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });
            if (!response?.data?.status) {
                toast.error(response?.data?.message || "Failed to delete contact");
                return;
            }
            const updatedContacts = contacts.filter((c) => c.id !== contactId);
            onContactsUpdate(updatedContacts);
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

    const handleCreateContact = async (contactData) => {
        try {
            const sessionToken = getToken();
            if (!sessionToken) {
                toast.error("No valid session found. Please login again.");
                return;
            }

            const payload = {
                ...contactData,
                [parentType === "supplier" ? "supplier_id" : "client_id"]:
                    parentId || "",
            };

            const response = await axios.post("/api/contact/create", payload, {
                headers: { Authorization: `Bearer ${sessionToken}` },
            });

            if (!response?.data?.status) {
                toast.error(response?.data?.message || "Failed to create contact");
                throw new Error(response?.data?.message || "Failed to create contact");
            }

            const created = response.data.data;
            const updatedContacts = [created, ...contacts];
            onContactsUpdate(updatedContacts);
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

    // ContactPopup related functions
    const isCreateMode = !selectedContact;

    useEffect(() => {
        if (isContactModalOpen) {
            if (selectedContact) {
                // Edit mode - existing contact
                setIsEditingContact(false);
                setContactDraft({
                    first_name: selectedContact.first_name || "",
                    last_name: selectedContact.last_name || "",
                    email: selectedContact.email || "",
                    phone: selectedContact.phone || "",
                    preferred_contact_method: selectedContact.preferred_contact_method || "",
                    notes: selectedContact.notes || "",
                    role: selectedContact.role || "",
                });
            } else {
                // Create mode - new contact
                setIsEditingContact(true);
                setContactDraft({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    preferred_contact_method: "",
                    notes: "",
                    role: "",
                });
            }
        }
    }, [selectedContact, isContactModalOpen]);

    const handleCopyEmail = async (email) => {
        if (!email) return;
        try {
            await navigator.clipboard.writeText(email);
            toast.success("Email copied to clipboard", {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
            });
        } catch (err) {
            console.error("Failed to copy email:", err);
            toast.error("Failed to copy email", {
                position: "top-right",
                autoClose: 2000,
                hideProgressBar: false,
            });
        }
    };

    const startEditContact = () => {
        if (!selectedContact) return;
        setIsEditingContact(true);
    };

    const handleSaveContact = async () => {
        if (isCreateMode) {
            // Create new contact
            if (!parentId) return;
            setIsSavingContact(true);
            try {
                await handleCreateContact(contactDraft);
                setContactDraft({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    preferred_contact_method: "",
                    notes: "",
                    role: "",
                });
            } catch (err) {
                console.error("Create contact failed", err);
                throw err;
            } finally {
                setIsSavingContact(false);
            }
        } else {
            // Update existing contact
            if (!selectedContact) return;
            setIsSavingContact(true);
            try {
                await saveEditContact(contactDraft, selectedContact.id);
                setIsEditingContact(false);
            } catch (err) {
                console.error("Save contact failed", err);
                throw err;
            } finally {
                setIsSavingContact(false);
            }
        }
    };

    const handleCloseContactModal = () => {
        setIsEditingContact(false);
        setContactDraft({
            first_name: "",
            last_name: "",
            email: "",
            phone: "",
            preferred_contact_method: "",
            notes: "",
            role: "",
        });
        closeContactModal();
    };

    return (
        <>
            <div className="col-span-3">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 max-h-[200px] flex flex-col">
                    <div className="flex items-center rounded-t-lg justify-between p-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <User className="w-4 h-4" />
                            Contacts
                        </h3>
                        <span className="text-xs text-slate-500">
                            {contacts?.length || 0}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                        {!contacts || contacts.length === 0 ? (
                            <div className="text-center py-6 text-slate-500">
                                <User className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                                <p className="text-sm">No contacts</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {contacts.map((contact) => (
                                    <div
                                        key={contact.id}
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
                                                    handleDeleteContact(contact.id);
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
                    </div>
                    <div className="p-3 rounded-lg border-t border-slate-100 sticky bottom-0 bg-white z-10">
                        <button
                            onClick={openAddContactModal}
                            className="cursor-pointer flex items-center text-sm hover:text-secondary text-left"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Contact
                        </button>
                    </div>
                </div>
            </div>

            {/* Contact Detail Modal */}
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
                                    {isCreateMode ? (
                                        <>
                                            <div className="text-lg font-semibold text-slate-700">
                                                Add Contact
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {parentType === "supplier" ? "Supplier" : "Client"}:{" "}
                                                {parentName}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-lg font-semibold text-slate-700">
                                                {selectedContact.first_name}{" "}
                                                {selectedContact.last_name}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {selectedContact.id}
                                            </div>
                                        </>
                                    )}
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
                            {!isEditingContact && !isCreateMode ? (
                                // View Mode - Keep the original layout with icons
                                <>
                                    <div className="flex items-start gap-3">
                                        <Mail className="w-5 h-5 text-slate-500 mt-0.5" />
                                        <div className="w-full">
                                            <div className="text-xs uppercase tracking-wide text-slate-500">
                                                Email
                                            </div>
                                            {selectedContact.email ? (
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={`mailto:${selectedContact.email}`}
                                                        className="text-primary hover:underline"
                                                    >
                                                        {selectedContact.email}
                                                    </a>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyEmail(selectedContact.email);
                                                        }}
                                                        className="cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors"
                                                        title="Copy email"
                                                    >
                                                        <Copy className="w-4 h-4 text-slate-600" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-slate-700">-</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Phone className="w-5 h-5 text-slate-500 mt-0.5" />
                                        <div className="w-full">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Phone
                                            </p>
                                            <p className="text-slate-700">
                                                {selectedContact.phone || "-"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <IdCardLanyard className="w-5 h-5 text-slate-500 mt-0.5" />
                                        <div className="w-full">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Role
                                            </p>
                                            <p className="text-slate-700">
                                                {selectedContact.role || "-"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <NotebookText className="w-5 h-5 text-slate-500 mt-0.5" />
                                        <div className="w-full">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Notes
                                            </p>
                                            <p className="text-slate-700 whitespace-pre-line">
                                                {selectedContact.notes || "No notes"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <PhoneCall className="w-5 h-5 text-slate-500 mt-0.5" />
                                        <div className="w-full">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Preferred Contact
                                            </p>
                                            <p className="text-slate-700">
                                                {selectedContact.preferred_contact_method || "-"}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // Edit/Create Mode - Use the same grid layout
                                <div className="grid grid-cols-2 gap-2">
                                    {isCreateMode && (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                {parentType === "supplier" ? "Supplier ID" : "Client ID"}
                                            </label>
                                            <input
                                                type="text"
                                                value={parentId || ""}
                                                disabled
                                                className="w-full text-sm text-slate-500 px-4 py-3 border border-slate-300 rounded-lg bg-slate-100"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            First Name
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
                                            Last Name
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
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                            {!isEditingContact && !isCreateMode ? (
                                <>
                                    <button
                                        onClick={startEditContact}
                                        className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                                    >
                                        Edit Contact
                                    </button>
                                    <button
                                        onClick={handleCloseContactModal}
                                        className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                                    >
                                        Close
                                    </button>
                                </>
                            ) : (
                                <>
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
                                            ? isCreateMode
                                                ? "Creating..."
                                                : "Saving..."
                                            : isCreateMode
                                                ? "Create Contact"
                                                : "Save"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Contact Confirmation Modal */}
            <DeleteConfirmation
                isOpen={showDeleteContactModal}
                onClose={handleDeleteContactCancel}
                onConfirm={handleDeleteContactConfirm}
                deleteWithInput={false}
                heading="Contact"
                message={`${contactPendingDelete?.first_name || ""} ${contactPendingDelete?.last_name || ""
                    } will be removed from this ${parentType}.`}
                isDeleting={isDeletingContact}
            />
        </>
    );
}

