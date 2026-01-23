"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          className="cursor-pointer w-full px-3 py-2 text-left border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
        >
          <div className="flex items-center justify-between">
            <span
              className={
                selectedValues.length > 0 ? "text-slate-900" : "text-slate-500"
              }
            >
              {selectedValues.length === 0
                ? placeholder
                : selectedValues.length === 1
                  ? selectedValues[0]
                  : `${selectedValues.length} selected`}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {isOpen && (
          <div
            className={`absolute z-50 w-full bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-hidden ${
              dropdownPosition === "top" ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            <div className="p-2 border-b border-slate-200">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={handleSelectAll}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 border-b border-slate-100"
              >
                {selectedValues.length === filteredOptions.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
              {filteredOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => handleToggle(option)}
                  className={`cursor-pointer w-full text-left px-3 py-2 text-sm hover:bg-slate-100 flex items-center ${
                    selectedValues.includes(option)
                      ? "bg-primary/10 text-primary"
                      : "text-slate-700"
                  }`}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-4 h-4 border border-slate-300 rounded mr-2 flex items-center justify-center ${
                        selectedValues.includes(option)
                          ? "bg-primary border-primary"
                          : ""
                      }`}
                    >
                      {selectedValues.includes(option) && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    {option}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
