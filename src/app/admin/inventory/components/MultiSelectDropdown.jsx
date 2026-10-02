"use client";
import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown } from "lucide-react";

// Shared menu-row and checkbox recipes (DESIGN.md 9.8, mirrors the clients toolbar menus).
const MENU_ROW =
  "cursor-pointer w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 transition-colors duration-200";
const CHECKBOX =
  "h-4 w-4 shrink-0 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function MultiSelectDropdown({
  label,
  field,
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState("bottom");
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const buttonId = useId();

  const closeDropdown = () => {
    setIsOpen(false);
    setSearchTerm("");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    // Escape closes only this menu. React is mounted on `document`, so a React
    // stopPropagation cannot stop a page-level listener (e.g. a filter dialog
    // closing on Escape); catching it on window in the capture phase can.
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setIsOpen(false);
      setSearchTerm("");
      buttonRef.current?.focus();
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleEscape, true);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("keydown", handleEscape, true);
      };
    }
  }, [isOpen]);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleToggle = (value) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelectionChange(field, newSelection);
  };

  const handleOpen = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // If there's not enough space below (less than 200px) and more space above, position upward
      if (spaceBelow < 200 && spaceAbove > spaceBelow) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
    setIsOpen(true);
  };

  const handleSelectAll = () => {
    if (selectedValues.length === filteredOptions.length) {
      onSelectionChange(field, []);
    } else {
      onSelectionChange(field, filteredOptions);
    }
  };

  // Escape closes the menu and returns focus to the trigger. It must not also
  // close a modal or panel the dropdown sits inside.
  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      closeDropdown();
      buttonRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <label
        htmlFor={buttonId}
        className="block text-sm font-medium text-slate-700 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <button
          id={buttonId}
          ref={buttonRef}
          type="button"
          onClick={isOpen ? closeDropdown : handleOpen}
          aria-haspopup="true"
          aria-expanded={isOpen}
          className="cursor-pointer w-full px-3 py-2 text-left text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`truncate ${
                selectedValues.length > 0 ? "text-slate-800" : "text-slate-500"
              }`}
            >
              {selectedValues.length === 0
                ? placeholder
                : selectedValues.length === 1
                  ? selectedValues[0]
                  : `${selectedValues.length} selected`}
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </div>
        </button>

        {isOpen && (
          <div
            className={`absolute z-40 w-full bg-white border border-slate-300 rounded-lg max-h-60 overflow-hidden ${
              dropdownPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            <div className="p-2 border-b border-slate-200">
              <input
                type="text"
                placeholder="Search..."
                aria-label={`Search ${label}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={handleSelectAll}
                className={`${MENU_ROW} font-medium text-slate-700 border-b border-slate-200`}
              >
                {selectedValues.length === filteredOptions.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
              {filteredOptions.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-500">
                  No matching options
                </p>
              )}
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option);
                return (
                  <label
                    key={option}
                    className={`${MENU_ROW} ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(option)}
                      className={CHECKBOX}
                    />
                    <span className="min-w-0 truncate" title={option}>
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
