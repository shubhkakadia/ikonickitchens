"use client";
import AdminShell from "@/components/AdminShell";
import TabsController from "@/components/tabscontroller";
import CustomDropdown from "@/components/CustomDropdown";
import {
  ChevronLeft,
  Building2,
  User,
  Plus,
  Save,
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  IdCardLanyard,
  NotebookText,
  PhoneCall,
  Trash2,
  Edit,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { validatePhone, formatPhoneToNational } from "@/components/validators";
import useModalFocus from "@/hooks/useModalFocus";

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent";
const inputClass = (hasError, extra = "") =>
  `${INPUT_BASE} ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

// DESIGN.md 9.1 button recipes. Only one primary button per view / modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

const PREFERRED_METHODS = [
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  notes: "",
  abn_number: "",
};

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

// Module-level so inputs keep focus between renders.
function TextField({
  id,
  label,
  icon: Icon,
  required,
  error,
  multiline,
  className = "",
  inputClassName = "",
  ...rest
}) {
  const Control = multiline ? "textarea" : "input";
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5"
      >
        {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
        <span>
          {label}
          {required && (
            <>
              {" "}
              <span className="text-red-600" aria-hidden="true">
                *
              </span>
            </>
          )}
        </span>
      </label>
      <Control
        id={id}
        name={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass(!!error, inputClassName)}
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

function Section({ icon: Icon, title, action, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function page() {
  const router = useRouter();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState(EMPTY_CONTACT);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [editingContactIndex, setEditingContactIndex] = useState(null);
  const contactModalRef = useRef(null);
  useModalFocus(contactModalRef, isContactModalOpen);

  const { getToken } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const validate = () => {
    const errs = {};
    if (!formData.name) {
      errs.name = "Enter a supplier name.";
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = "Enter a valid email address.";
    }
    if (formData.phone && !validatePhone(formData.phone)) {
      errs.phone = "Enter a valid Australian phone number.";
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  // Field order here is also the order focus moves to on a failed submit.
  const fieldOrder = ["name", "email", "phone"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const currentErrors = validate();
    const firstInvalid = fieldOrder.find((key) => currentErrors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setIsLoading(true);

    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.", {
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
              phone: contact.phone
                ? formatPhoneToNational(contact.phone)
                : null,
              role: contact.role || null,
              preferred_contact_method:
                contact.preferred_contact_method || null,
              notes: contact.notes || null,
            }))
          : [];

      const formatPhone = (phone) => {
        return phone ? formatPhoneToNational(phone) : phone;
      };

      const data = {
        name: formData.name,
        email: formData.email,
        phone: formatPhone(formData.phone),
        address: formData.address,
        notes: formData.notes,
        website: formData.website,
        abn_number: formData.abn_number,
        contacts: contactsToSend,
      };

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "/api/v1/supplier/create",
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
          apiMessage ||
          "Couldn't create the supplier. Check the details and try again.";
        toast.error(message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        return;
      }

      // Reset form on success
      setFormData(EMPTY_FORM);
      setContacts([]);
      setSubmitted(false);

      // Show success toast
      toast.success("Supplier created.", {
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
      let errorMessage = "Something went wrong. Try again.";

      if (error.response) {
        // Server responded with error status
        errorMessage =
          error.response.data?.message ||
          "Couldn't create the supplier. Check the details and try again.";
      } else if (error.request) {
        // Request was made but no response received
        errorMessage =
          "Couldn't create the supplier. Check your connection and try again.";
      }

      // Show error toast (form stays open with all values intact)
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ---- Contact modal ----

  const handleCloseContactModal = () => {
    setIsContactModalOpen(false);
    setEditingContactIndex(null);
    setContactDraft(EMPTY_CONTACT);
    setContactSubmitted(false);
  };

  // Modals close on Escape (DESIGN.md 9.4)
  useEffect(() => {
    if (!isContactModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isSavingContact) handleCloseContactModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isContactModalOpen, isSavingContact]);

  const openAddContactModal = () => {
    setContactDraft(EMPTY_CONTACT);
    setEditingContactIndex(null);
    setContactSubmitted(false);
    setIsContactModalOpen(true);
  };

  const handleEditContact = (index) => {
    setContactDraft(contactToDraft(contacts[index]));
    setEditingContactIndex(index);
    setContactSubmitted(false);
    setIsContactModalOpen(true);
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactDraft((previous) => ({ ...previous, [name]: value }));
  };

  const validateContact = () => {
    const errs = {};
    if (!contactDraft.first_name) {
      errs.first_name = "Enter a first name.";
    }
    if (!contactDraft.last_name) {
      errs.last_name = "Enter a last name.";
    }
    if (contactDraft.phone && !validatePhone(contactDraft.phone)) {
      errs.phone = "Enter a valid Australian phone number.";
    }
    return errs;
  };

  const contactErrors = contactSubmitted ? validateContact() : {};

  const contactBaseline =
    editingContactIndex !== null && contacts[editingContactIndex]
      ? contactToDraft(contacts[editingContactIndex])
      : EMPTY_CONTACT;
  const isContactDirty =
    JSON.stringify(contactDraft) !== JSON.stringify(contactBaseline);

  const handleSaveContact = (e) => {
    e.preventDefault();
    setContactSubmitted(true);

    const currentErrors = validateContact();
    const firstInvalid = ["first_name", "last_name", "phone"].find(
      (key) => currentErrors[key],
    );
    if (firstInvalid) {
      document.getElementById(`contact-${firstInvalid}`)?.focus();
      return;
    }

    setIsSavingContact(true);
    try {
      // Format phone number before saving
      const formattedContact = {
        ...contactDraft,
        phone: contactDraft.phone
          ? formatPhoneToNational(contactDraft.phone)
          : contactDraft.phone,
      };

      if (editingContactIndex !== null) {
        // Update existing contact
        const updatedContacts = [...contacts];
        updatedContacts[editingContactIndex] = {
          ...formattedContact,
          id: contacts[editingContactIndex].id, // Keep the same ID
        };
        setContacts(updatedContacts);
        handleCloseContactModal();
        toast.success("Contact updated.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      } else {
        // Add new contact
        const newContact = {
          ...formattedContact,
          id: `temp-${Date.now()}`, // Temporary ID for display
        };
        setContacts([...contacts, newContact]);
        handleCloseContactModal();
        toast.success("Contact added.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (err) {
      console.error("Save contact failed", err);
      toast.error(
        editingContactIndex !== null
          ? "Couldn't update the contact. Try again."
          : "Couldn't add the contact. Try again.",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        },
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleRemoveContact = (index) => {
    const updatedContacts = contacts.filter((_, i) => i !== index);
    setContacts(updatedContacts);
    toast.success("Contact removed.", {
      position: "top-right",
      autoClose: 2000,
      hideProgressBar: false,
    });
  };

  return (
    <AdminShell>
      <main className="h-full w-full overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TabsController back={true}>
              <span className="cursor-pointer inline-flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </span>
            </TabsController>
            <h1 className="text-xl font-semibold text-slate-800">
              Add supplier
            </h1>
          </div>

          {/* form */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {/* Supplier information section */}
              <Section icon={Building2} title="Supplier information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    id="name"
                    label="Supplier name"
                    required
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Polytec Australia"
                    error={errors.name}
                  />
                  <TextField
                    id="email"
                    label="Email address"
                    icon={Mail}
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. contact@polytec.com.au"
                    error={errors.email}
                  />
                  <TextField
                    id="address"
                    label="Address"
                    icon={MapPin}
                    multiline
                    rows={3}
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="e.g. 12 Industrial Rd, Adelaide, SA 5000"
                    className="md:col-span-2"
                  />
                </div>
              </Section>

              {/* Contact information section */}
              <Section icon={Phone} title="Contact information">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TextField
                    id="phone"
                    label="Phone number"
                    icon={Phone}
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. 0400 123 456 or +61 400 123 456"
                    error={errors.phone}
                  />
                  <TextField
                    id="website"
                    label="Website"
                    icon={Globe}
                    type="url"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="e.g. https://www.polytec.com.au"
                  />
                  <TextField
                    id="abn_number"
                    label="ABN"
                    type="text"
                    inputClassName="font-mono"
                    value={formData.abn_number}
                    onChange={handleInputChange}
                    placeholder="e.g. 12345678901"
                  />
                </div>
              </Section>

              {/* Notes section */}
              <Section icon={NotebookText} title="Additional notes">
                <TextField
                  id="notes"
                  label="Notes"
                  multiline
                  rows={4}
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="e.g. Orders over $500 ship free"
                />
              </Section>

              {/* Contacts section */}
              <Section
                icon={IdCardLanyard}
                title="Contacts"
                action={
                  contacts.length > 0 && (
                    <button
                      type="button"
                      onClick={openAddContactModal}
                      className={BTN_SECONDARY}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add contact
                    </button>
                  )
                }
              >
                {/* Empty state - no contacts */}
                {contacts.length === 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 flex flex-col items-center text-center">
                    <User
                      className="w-8 h-8 text-slate-300 mb-3"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600 mb-4">
                      No contacts added yet.
                    </p>
                    <button
                      type="button"
                      onClick={openAddContactModal}
                      className={BTN_SECONDARY}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add contact
                    </button>
                  </div>
                )}

                {/* Contact cards */}
                {contacts.length > 0 && (
                  <ul className="space-y-3">
                    {contacts.map((contact, index) => {
                      const fullName =
                        `${contact.first_name} ${contact.last_name}`.trim();
                      return (
                        <li
                          key={contact.id || index}
                          className="bg-slate-50 border border-slate-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <User
                                  className="w-4 h-4 text-slate-600"
                                  aria-hidden="true"
                                />
                                <h3 className="text-sm font-semibold text-slate-800">
                                  {fullName}
                                </h3>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                {contact.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail
                                      className="w-4 h-4 text-slate-500"
                                      aria-hidden="true"
                                    />
                                    <span className="text-slate-700">
                                      {contact.email}
                                    </span>
                                  </div>
                                )}
                                {contact.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone
                                      className="w-4 h-4 text-slate-500"
                                      aria-hidden="true"
                                    />
                                    <span className="text-slate-700">
                                      {contact.phone}
                                    </span>
                                  </div>
                                )}
                                {contact.role && (
                                  <div className="flex items-center gap-2">
                                    <IdCardLanyard
                                      className="w-4 h-4 text-slate-500"
                                      aria-hidden="true"
                                    />
                                    <span className="text-slate-700">
                                      {contact.role}
                                    </span>
                                  </div>
                                )}
                                {contact.preferred_contact_method && (
                                  <div className="flex items-center gap-2">
                                    <PhoneCall
                                      className="w-4 h-4 text-slate-500"
                                      aria-hidden="true"
                                    />
                                    <span className="text-slate-700 capitalize">
                                      {contact.preferred_contact_method}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {contact.notes && (
                                <div className="mt-2 flex items-start gap-2">
                                  <NotebookText
                                    className="w-4 h-4 text-slate-500 mt-0.5"
                                    aria-hidden="true"
                                  />
                                  <p className="text-sm text-slate-700">
                                    {contact.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditContact(index)}
                                className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                                aria-label={`Edit contact ${fullName}`}
                                title="Edit contact"
                              >
                                <Edit className="w-4 h-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveContact(index)}
                                className="cursor-pointer p-1.5 text-red-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                                aria-label={`Remove contact ${fullName}`}
                                title="Remove contact"
                              >
                                <Trash2
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={isLoading}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={BTN_PRIMARY}
                >
                  {isLoading ? (
                    <span className={SPINNER} aria-hidden="true" />
                  ) : (
                    <Save className="w-4 h-4" aria-hidden="true" />
                  )}
                  Create supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Contact modal */}
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                  <User className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h2
                    id="contact-modal-title"
                    className="text-lg font-semibold text-slate-800"
                  >
                    {editingContactIndex !== null
                      ? "Edit contact"
                      : "Add contact"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Supplier: {formData.name || "New supplier"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseContactModal}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <form
              noValidate
              onSubmit={handleSaveContact}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    required
                    type="text"
                    value={contactDraft.last_name}
                    onChange={handleContactChange}
                    placeholder="e.g. Evans"
                    error={contactErrors.last_name}
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
                  type="submit"
                  disabled={isSavingContact}
                  className={BTN_PRIMARY}
                >
                  {isSavingContact ? (
                    <span className={SPINNER} aria-hidden="true" />
                  ) : editingContactIndex !== null ? (
                    <Save className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  )}
                  {editingContactIndex !== null
                    ? "Update contact"
                    : "Add contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
