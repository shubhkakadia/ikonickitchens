"use client";
import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * PaginationFooter Component
 * 
 * A reusable pagination component that handles all pagination calculations and UI.
 * 
 * @param {Object} props
 * @param {number} props.totalItems - Total number of items to paginate
 * @param {number} props.itemsPerPage - Number of items per page (0 means show all)
 * @param {number} props.currentPage - Current active page (1-indexed)
 * @param {Function} props.onPageChange - Callback when page changes (page: number) => void
 * @param {Function} props.onItemsPerPageChange - Callback when items per page changes (items: number) => void
 * @param {Array<number>} props.itemsPerPageOptions - Options for items per page dropdown (default: [25, 50, 100, 0])
 * @param {boolean} props.showItemsPerPage - Whether to show items per page dropdown (default: true)
 * @param {string} props.className - Additional CSS classes for the footer container
 */
export default function PaginationFooter({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [25, 50, 100, 0],
  showItemsPerPage = true,
  className = "",
}) {
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);

  // Pagination calculations
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const startItem = totalItems === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(endIndex, totalItems);

  // Handle page change with validation
  const handlePageChange = (page) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    if (validPage !== currentPage) {
      onPageChange(validPage);
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setShowItemsPerPageDropdown(false);
    onItemsPerPageChange(value);
    // Reset to first page when items per page changes
    onPageChange(1);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".pagination-dropdown-container")) {
        setShowItemsPerPageDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Don't render if there are no items
  if (totalItems === 0) {
    return null;
  }

  return (
    <div
      className={`px-4 py-3 shrink-0 border-t border-slate-200 bg-slate-50 ${className}`}
    >
      <div className="flex items-center justify-between">
        {/* Items per page dropdown and showing indicator */}
        {showItemsPerPage && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 font-medium">
                Showing
              </span>
              <div className="relative pagination-dropdown-container">
                <button
                  onClick={() =>
                    setShowItemsPerPageDropdown(!showItemsPerPageDropdown)
                  }
                  className="cursor-pointer flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors duration-200 bg-white font-medium"
                >
                  <span>
                    {itemsPerPage === 0 ? "All" : itemsPerPage}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showItemsPerPageDropdown && (
                  <div className="absolute bottom-full left-0 mb-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                    <div className="py-1">
                      {itemsPerPageOptions.map((value) => (
                        <button
                          key={value}
                          onClick={() => handleItemsPerPageChange(value)}
                          className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          {value === 0 ? "All" : value}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-sm text-slate-600 font-medium">
                of {totalItems} results
              </span>
            </div>
          </div>
        )}

        {/* Show range indicator if items per page is hidden */}
        {!showItemsPerPage && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 font-medium">
              Showing {startItem} - {endItem} of {totalItems} results
            </span>
          </div>
        )}

        {/* Pagination buttons - only show when not showing all items */}
        {itemsPerPage > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`cursor-pointer px-3 py-1 text-sm rounded-lg transition-colors duration-200 font-medium ${currentPage === pageNum
                          ? "bg-primary text-white shadow-sm"
                          : "text-slate-600 hover:bg-white"
                        }`}
                      aria-label={`Page ${pageNum}`}
                      aria-current={currentPage === pageNum ? "page" : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
