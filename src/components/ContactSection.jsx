"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Trash2,
  Plus,
  Mail,
  Phone,
  NotebookText,
  X,
  Copy,
  IdCardLanyard,
  PhoneCall,
  Pencil,
  Save,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import CustomDropdown from "@/components/CustomDropdown";
import { validatePhone, formatPhoneToNational } from "@/components/validators";
import useModalFocus from "@/hooks/useModalFocus";
import { titleCase } from "@/app/admin/dashboard/lib/format";

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent";
const inputClass = (hasError) =>
  `${INPUT_BASE} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

// DESIGN.md 9.1 button recipes. Only one primary button per modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

const PREFERRED_METHODS = [
  { value: "", label: "No preference" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

const EMPTY_CONTACT = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  preferred_contact_method: "",
  notes: "",
  role: "",
};

const contactToDraft = (contact) => ({
  first_name: contact.first_name || "",
  last_name: contact.last_name || "",
  email: contact.email || "",
  phone: contact.phone || "",
  preferred_contact_method: contact.preferred_contact_method || "",
  notes: contact.notes || "",
  role: contact.role || "",
});

const contactName = (contact) =>
  [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");

// Module-level so inputs keep focus between renders.
function TextField({
  id,
  label,
  required,
  error,
  multiline,
  className = "",
  ...rest
}) {
  const Control = multiline ? "textarea" : "input";
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 mb-1.5"
      >
        {label}
        {required && (
          <>
            {" "}
            <span className="text-red-600" aria-hidden="true">
              *
            </span>
          </>
        )}
      </label>
      <Control
        id={id}
        name={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(!!error)}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

// One labelled value in the view-mode modal. Empty values render as an em dash.
function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="w-4 h-4 text-slate-500 mt-0.5 shrink-0"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="text-sm text-slate-700 wrap-break-word">{children}</dd>
      </div>
    </div>
  );
}

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
  const [contactDraft, setContactDraft] = useState(EMPTY_CONTACT);
  const [isSavingContact, setIsSavingContact] = useState(false);
  // Validate on submit, then on change: errors only exist once a save was attempted.
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const contactModalRef = useRef(null);
  useModalFocus(contactModalRef, isContactModalOpen);

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
        toast.error("Your session has expired. Sign in again.");
        return false;
      }
      const payload = {
        ...contactData,
        [parentType === "supplier" ? "supplier_id" : "client_id"]:
          selectedContact?.[
            parentType === "supplier" ? "supplier_id" : "client_id"
          ] ||
          parentId ||
          "",
      };
      const response = await axios.patch(
        `/api/v1/contact/${contactId}`,
        payload,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );
      if (!response?.data?.status) {
        toast.error(
          response?.data?.message ||
            "Couldn't update the contact. Check the details and try again.",
        );
        return false;
      }
      const updated = response.data.data;
      const updatedContacts = contacts.map((c) =>
        c.id === updated.id ? updated : c,
      );
      onContactsUpdate(updatedContacts);
      setSelectedContact(updated);
      toast.success("Contact updated.");
      return true;
    } catch (err) {
      console.error("Update contact failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't update the contact. Check your connection and try again.",
      );
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
        toast.error("Your session has expired. Sign in again.");
        return;
      }
      const contactId = contactPendingDelete.id;
      const response = await axios.delete(`/api/v1/contact/${contactId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response?.data?.status) {
        toast.error(
          response?.data?.message || "Couldn't delete the contact. Try again.",
        );
        return;
      }
      const updatedContacts = contacts.filter((c) => c.id !== contactId);
      onContactsUpdate(updatedContacts);
      toast.success("Contact deleted.");
      setShowDeleteContactModal(false);
      setContactPendingDelete(null);
    } catch (err) {
      console.error("Delete contact failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the contact. Check your connection and try again.",
      );
    } finally {
      setIsDeletingContact(false);
    }
  };

  const handleCreateContact = async (contactData) => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        return;
      }

      const payload = {
        ...contactData,
        [parentType === "supplier" ? "supplier_id" : "client_id"]:
          parentId || "",
      };

      const response = await axios.post("/api/v1/contact/create", payload, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (!response?.data?.status) {
        const message =
          response?.data?.message ||
          "Couldn't add the contact. Check the details and try again.";
        toast.error(message);
        throw new Error(message);
      }

      const created = response.data.data;
      const updatedContacts = [created, ...contacts];
      onContactsUpdate(updatedContacts);
      toast.success("Contact added.");
      setIsContactModalOpen(false);
      setSelectedContact(null);
    } catch (err) {
      console.error("Create contact failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't add the contact. Check your connection and try again.",
      );
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
      setContactSubmitted(false);
      if (selectedContact) {
        // Edit mode - existing contact
        setIsEditingContact(false);
        setContactDraft(contactToDraft(selectedContact));
      } else {
        // Create mode - new contact
        setIsEditingContact(true);
        setContactDraft(EMPTY_CONTACT);
      }
    }
  }, [selectedContact, isContactModalOpen]);

  const handleCopyEmail = async (email) => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Email copied.", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
      });
    } catch (err) {
      console.error("Failed to copy email:", err);
      toast.error("Couldn't copy the email. Copy it manually instead.", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
      });
    }
  };

  const startEditContact = () => {
    if (!selectedContact) return;
    setContactSubmitted(false);
    setIsEditingContact(true);
  };

  // Hand focus to the first field when an existing contact switches to edit mode.
  useEffect(() => {
    if (isContactModalOpen && isEditingContact && !isCreateMode) {
      document.getElementById("contact-first_name")?.focus();
    }
  }, [isContactModalOpen, isEditingContact, isCreateMode]);

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactDraft((previous) => ({ ...previous, [name]: value }));
  };

  const validateContact = () => {
    const errs = {};
    if (!contactDraft.first_name.trim()) {
      errs.first_name = "Enter a first name.";
    }
    if (contactDraft.phone && !validatePhone(contactDraft.phone)) {
      errs.phone = "Enter a valid Australian phone number.";
    }
    return errs;
  };

  const contactErrors = contactSubmitted ? validateContact() : {};

  const contactBaseline = selectedContact
    ? contactToDraft(selectedContact)
    : EMPTY_CONTACT;
  const isContactDirty =
    isEditingContact &&
    JSON.stringify(contactDraft) !== JSON.stringify(contactBaseline);

  const handleSaveContact = async (e) => {
    e?.preventDefault?.();
    setContactSubmitted(true);

    // Validate inline; focus moves to the first invalid field.
    const currentErrors = validateContact();
    const firstInvalid = ["first_name", "phone"].find(
      (key) => currentErrors[key],
    );
    if (firstInvalid) {
      document.getElementById(`contact-${firstInvalid}`)?.focus();
      return;
    }

    if (isCreateMode) {
      // Create new contact
      if (!parentId) return;
      setIsSavingContact(true);
      try {
        // Format phone number before saving
        const formattedContact = {
          ...contactDraft,
          phone: contactDraft.phone
            ? formatPhoneToNational(contactDraft.phone)
            : contactDraft.phone,
        };
        await handleCreateContact(formattedContact);
        setContactDraft(EMPTY_CONTACT);
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
        // Format phone number before saving
        const formattedContact = {
          ...contactDraft,
          phone: contactDraft.phone
            ? formatPhoneToNational(contactDraft.phone)
            : contactDraft.phone,
        };
        // Stay in edit mode when the save fails so nothing typed is lost.
        const saved = await saveEditContact(
          formattedContact,
          selectedContact.id,
        );
        if (saved) setIsEditingContact(false);
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
    setContactDraft(EMPTY_CONTACT);
    setContactSubmitted(false);
    closeContactModal();
  };

  // Modals close on Escape (DESIGN.md 9.4)
  useEffect(() => {
    if (!isContactModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isSavingContact) handleCloseContactModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isContactModalOpen, isSavingContact]);

  const parentLabel = parentType === "supplier" ? "Supplier" : "Client";
  const selectedName = contactName(selectedContact);
  const pendingDeleteName = contactName(contactPendingDelete);

  return (
    <>
      <div className="col-span-3">
        <div className="bg-white rounded-lg border border-slate-200 max-h-[200px] flex flex-col">
          <div className="flex items-center rounded-t-lg justify-between px-4 py-3 border-b border-slate-200 bg-white">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4" aria-hidden="true" />
              Contacts
            </h3>
            <span className="text-xs text-slate-500">
              {contacts?.length || 0}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!contacts || contacts.length === 0 ? (
              <div className="text-center py-6">
                <User
                  className="w-8 h-8 mx-auto mb-2 text-slate-300"
                  aria-hidden="true"
                />
                <p className="text-sm text-slate-600">No contacts yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {contacts.map((contact) => {
                  const name = contactName(contact) || "this contact";
                  return (
                    <li
                      key={contact.id}
                      className="group border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors duration-200 rounded-lg flex items-center gap-2 justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => openContactModal(contact)}
                        className="cursor-pointer text-left flex items-center gap-2 min-w-0 flex-1 px-2 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label={`View ${name}`}
                      >
                        <span
                          className="shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-200 transition-colors duration-200"
                          aria-hidden="true"
                        >
                          <User className="w-3 h-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-slate-700 truncate text-sm">
                            {contactName(contact) || "—"}
                          </span>
                          <span className="block text-xs text-slate-500 truncate">
                            {contact.email || "—"}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(contact.id)}
                        className="cursor-pointer shrink-0 p-1.5 mr-1.5 text-red-600 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                        aria-label={`Delete ${name}`}
                        title={`Delete ${name}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="px-4 py-3 border-t border-slate-200 bg-white rounded-b-lg">
            <button
              type="button"
              onClick={openAddContactModal}
              className={BTN_SECONDARY_COMPACT}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add contact
            </button>
          </div>
        </div>
      </div>

      {/* Contact Detail Modal */}
      {isContactModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            if (!isContactDirty && !isSavingContact) handleCloseContactModal();
          }}
        >
          <div
            ref={contactModalRef}
            className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  {isCreateMode ? (
                    <>
                      <h2
                        id="contact-modal-title"
                        className="text-lg font-semibold text-slate-800"
                      >
                        Add contact
                      </h2>
                      <p className="text-xs text-slate-500">
                        {parentLabel}: {parentName || "—"}
                      </p>
                    </>
                  ) : isEditingContact ? (
                    <>
                      <h2
                        id="contact-modal-title"
                        className="text-lg font-semibold text-slate-800"
                      >
                        Edit contact
                      </h2>
                      <p className="text-xs text-slate-500 truncate">
                        {selectedName || "—"}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2
                        id="contact-modal-title"
                        className="text-lg font-semibold text-slate-800 truncate"
                      >
                        {selectedName || "—"}
                      </h2>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        {selectedContact.id}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseContactModal}
                className="cursor-pointer shrink-0 p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {!isEditingContact && !isCreateMode ? (
              // View mode - read-only details
              <div className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 overflow-y-auto p-6">
                  <dl className="space-y-4">
                    <DetailRow icon={Mail} label="Email">
                      {selectedContact.email ? (
                        <span className="flex items-center gap-2">
                          <a
                            href={`mailto:${selectedContact.email}`}
                            className="text-primary hover:underline break-all"
                          >
                            {selectedContact.email}
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyEmail(selectedContact.email);
                            }}
                            className="cursor-pointer shrink-0 p-1.5 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors duration-200"
                            aria-label={`Copy email address for ${selectedName || "this contact"}`}
                            title="Copy email address"
                          >
                            <Copy className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </span>
                      ) : (
                        "—"
                      )}
                    </DetailRow>
                    <DetailRow icon={Phone} label="Phone">
                      {selectedContact.phone || "—"}
                    </DetailRow>
                    <DetailRow icon={IdCardLanyard} label="Role">
                      {selectedContact.role || "—"}
                    </DetailRow>
                    <DetailRow icon={NotebookText} label="Notes">
                      <span className="whitespace-pre-line">
                        {selectedContact.notes || "—"}
                      </span>
                    </DetailRow>
                    <DetailRow
                      icon={PhoneCall}
                      label="Preferred contact method"
                    >
                      {titleCase(selectedContact.preferred_contact_method) ||
                        "—"}
                    </DetailRow>
                  </dl>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCloseContactModal}
                    className={BTN_SECONDARY}
                  >
                    Close
                  </button>
                  <button
                    key="edit-contact"
                    type="button"
                    onClick={startEditContact}
                    className={BTN_PRIMARY}
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    Edit contact
                  </button>
                </div>
              </div>
            ) : (
              // Edit/Create mode
              <form
                noValidate
                onSubmit={(e) => {
                  // Errors are already toasted and logged inside the save path.
                  handleSaveContact(e).catch(() => {});
                }}
                className="flex flex-col min-h-0 flex-1"
              >
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isCreateMode && (
                      <div>
                        <label
                          htmlFor="contact-parent_id"
                          className="block text-sm font-medium text-slate-700 mb-1.5"
                        >
                          {parentLabel} ID
                        </label>
                        <input
                          id="contact-parent_id"
                          type="text"
                          value={parentId || ""}
                          disabled
                          className="w-full text-sm text-slate-600 font-mono px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 cursor-not-allowed"
                        />
                      </div>
                    )}
                    <TextField
                      id="contact-first_name"
                      name="first_name"
                      label="First name"
                      required
                      type="text"
                      data-autofocus
                      value={contactDraft.first_name}
                      onChange={handleContactChange}
                      placeholder="e.g. Sophia"
                      error={contactErrors.first_name}
                    />
                    <TextField
                      id="contact-last_name"
                      name="last_name"
                      label="Last name"
                      type="text"
                      value={contactDraft.last_name}
                      onChange={handleContactChange}
                      placeholder="e.g. Evans"
                    />
                    <TextField
                      id="contact-email"
                      name="email"
                      label="Email"
                      type="email"
                      value={contactDraft.email}
                      onChange={handleContactChange}
                      placeholder="e.g. sophia.evans@example.com"
                    />
                    <TextField
                      id="contact-phone"
                      name="phone"
                      label="Phone"
                      type="tel"
                      value={contactDraft.phone}
                      onChange={handleContactChange}
                      placeholder="e.g. +61 434 888 999"
                      error={contactErrors.phone}
                    />
                    <div>
                      <label
                        htmlFor="contact-preferred_contact_method"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Preferred contact method
                      </label>
                      <CustomDropdown
                        id="contact-preferred_contact_method"
                        options={PREFERRED_METHODS}
                        value={contactDraft.preferred_contact_method}
                        onChange={(value) =>
                          setContactDraft((previous) => ({
                            ...previous,
                            preferred_contact_method: value,
                          }))
                        }
                        placeholder="Select a method"
                      />
                    </div>
                    <TextField
                      id="contact-role"
                      name="role"
                      label="Role"
                      type="text"
                      value={contactDraft.role}
                      onChange={handleContactChange}
                      placeholder="e.g. Manager, Accountant"
                    />
                    <TextField
                      id="contact-notes"
                      name="notes"
                      label="Notes"
                      multiline
                      rows={3}
                      value={contactDraft.notes}
                      onChange={handleContactChange}
                      placeholder="e.g. Available weekday mornings"
                      className="md:col-span-2"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCloseContactModal}
                    disabled={isSavingContact}
                    className={BTN_SECONDARY}
                  >
                    Cancel
                  </button>
                  <button
                    key="save-contact"
                    type="submit"
                    disabled={isSavingContact}
                    className={BTN_PRIMARY}
                  >
                    {isSavingContact ? (
                      <span className={SPINNER} aria-hidden="true" />
                    ) : isCreateMode ? (
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Save className="w-4 h-4" aria-hidden="true" />
                    )}
                    {isCreateMode ? "Add contact" : "Update contact"}
                  </button>
                </div>
              </form>
            )}
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
        title={
          pendingDeleteName ? `Delete ${pendingDeleteName}?` : "Delete contact?"
        }
        warningHeading="This removes the contact"
        message={`${pendingDeleteName || "This contact"} will be removed from this ${parentType}.`}
        confirmButtonText="Delete contact"
        isDeleting={isDeletingContact}
      />
    </>
  );
}
