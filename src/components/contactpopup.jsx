"use client";
import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  NotebookText,
  X,
  Copy,
  IdCardLanyard,
  PhoneCall,
} from "lucide-react";
import { toast } from "react-toastify";

export default function ContactPopup({
  isOpen,
  contact,
  onClose,
  onSave,
  onCreate,
  parentId,
  parentType, // "supplier" or "client"
  parentName, // For display in header
}) {
  const isCreateMode = !contact;
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

  useEffect(() => {
    if (isOpen) {
      if (contact) {
        // Edit mode - existing contact
        setIsEditingContact(false);
        setContactDraft({
          first_name: contact.first_name || "",
          last_name: contact.last_name || "",
          email: contact.email || "",
          phone: contact.phone || "",
          preferred_contact_method: contact.preferred_contact_method || "",
          notes: contact.notes || "",
          role: contact.role || "",
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
  }, [contact, isOpen]);

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
    if (!contact) return;
    setIsEditingContact(true);
  };

  const handleSave = async () => {
    if (isCreateMode) {
      // Create new contact
      if (!onCreate || !parentId) return;
      setIsSavingContact(true);
      try {
        await onCreate(contactDraft);
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
      if (!contact || !onSave) return;
      setIsSavingContact(true);
      try {
        await onSave(contactDraft, contact.id);
        setIsEditingContact(false);
      } catch (err) {
        console.error("Save contact failed", err);
        throw err;
      } finally {
        setIsSavingContact(false);
      }
    }
  };

  const handleClose = () => {
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
      <div className="absolute inset-0 bg-slate-900/40" onClick={handleClose} />
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
                    {contact.first_name} {contact.last_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {contact.id}
                  </div>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
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
                  {contact.email ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-primary hover:underline"
                      >
                        {contact.email}
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyEmail(contact.email);
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
                  <p className="text-slate-700">{contact.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IdCardLanyard className="w-5 h-5 text-slate-500 mt-0.5" />
                <div className="w-full">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Role
                  </p>
                  <p className="text-slate-700">{contact.role || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <NotebookText className="w-5 h-5 text-slate-500 mt-0.5" />
                <div className="w-full">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Notes
                  </p>
                  <p className="text-slate-700 whitespace-pre-line">
                    {contact.notes || "No notes"}
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
                    {contact.preferred_contact_method || "-"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            // Edit/Create Mode - Use the same grid layout
            <div className="grid grid-cols-2 gap-2">
              {!isCreateMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contact ID
                  </label>
                  <input
                    type="text"
                    value={contact.id}
                    disabled
                    className="w-full text-sm text-slate-500 px-4 py-3 border border-slate-300 rounded-lg bg-slate-100"
                  />
                </div>
              )}
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
                onClick={handleClose}
                className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={isSavingContact}
                className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
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
  );
}
