"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * CustomDropdown Component
 *
 * A styled dropdown that replaces the native <select>, matching the pattern used
 * across the admin forms.
 *
 * @param {Object} props
 * @param {Array<string|Object>} props.options - Options as strings or { value, label, description, disabled }
 * @param {string} props.value - Currently selected value
 * @param {Function} props.onChange - Callback with the selected value
 * @param {string} [props.placeholder] - Text shown when nothing is selected
 * @param {boolean} [props.searchable] - Allow typing to filter the options (default: false)
 * @param {boolean} [props.disabled] - Disable the dropdown
 * @param {boolean} [props.loading] - Show a loading row instead of the options
 * @param {string} [props.loadingText] - Text shown while loading
 * @param {string} [props.emptyText] - Text shown when no options match
 * @param {string} [props.className] - Extra classes for the wrapper
 */
export default function CustomDropdown({
  options = [],
  value = "",
  onChange,
  placeholder = "Select an option",
  searchable = false,
  disabled = false,
  loading = false,
  loadingText = "Loading...",
  emptyText = "No options found",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  const normalizedOptions = useMemo(
    () =>
      (options || []).map((option) =>
        typeof option === "string" ? { value: option, label: option } : option,
      ),
    [options],
  );

  const selectedOption = normalizedOptions.find(
    (option) => option.value === value,
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close the list whenever the dropdown becomes unusable.
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setSearchTerm("");
    }
  }, [disabled]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return normalizedOptions;

    const term = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter((option) =>
      `${option.label} ${option.description || ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [normalizedOptions, searchTerm, searchable]);

  const handleSelect = (option) => {
    if (option.disabled) return;

    onChange?.(option.value);
    setSearchTerm("");
    setIsOpen(false);
  };

  const toggleOpen = () => {
    if (disabled) return;
    setIsOpen((previous) => !previous);
    setSearchTerm("");
  };

  const displayValue = searchable
    ? searchTerm || selectedOption?.label || ""
    : selectedOption?.label || "";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          readOnly={!searchable}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            if (!searchable) return;
            setSearchTerm(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onClick={() => {
            if (disabled) return;
            if (!searchable) toggleOpen();
          }}
          className={`w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${
            disabled
              ? "bg-slate-100 cursor-not-allowed text-slate-500"
              : searchable
                ? ""
                : "cursor-pointer"
          }`}
        />
        <button
          type="button"
          onClick={toggleOpen}
          disabled={disabled}
          tabIndex={-1}
          className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:cursor-not-allowed"
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              {loadingText}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              {emptyText}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={option.disabled}
                className={`w-full text-left px-4 py-3 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  option.disabled
                    ? "text-slate-400 cursor-not-allowed"
                    : "cursor-pointer text-slate-800 hover:bg-slate-100"
                } ${option.value === value ? "bg-slate-50 font-medium" : ""}`}
              >
                {option.label}
                {option.description && (
                  <span className="block text-xs text-slate-500">
                    {option.description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
