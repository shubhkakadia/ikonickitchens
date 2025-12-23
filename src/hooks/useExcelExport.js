"use client";
import { useState } from "react";
import { toast } from "react-toastify";

/**
 * Custom hook for exporting data to Excel
 * 
 * @param {Object} config - Configuration object
 * @param {Object} config.columnMap - Map of column names to data extraction functions
 * @param {Object} [config.columnWidths] - Optional map of column names to widths (default: 15 for all columns)
 * @param {number} [config.defaultWidth] - Default width for columns (default: 15)
 * @param {string} config.filenamePrefix - Prefix for the exported filename
 * @param {string} config.sheetName - Name of the Excel sheet (default: "Sheet1")
 * @param {Array<string>} [config.selectedColumns] - Optional array of selected column names to export
 * @returns {Object} Object containing export function and loading state
 */
export const useExcelExport = ({
  columnMap,
  columnWidths = {},
  defaultWidth = 15,
  filenamePrefix,
  sheetName = "Sheet1",
  selectedColumns = null,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Export data to Excel
   * @param {Array} data - Array of data objects to export
   * @param {Object} [options] - Additional options
   * @param {string} [options.customFilename] - Custom filename (overrides default)
   * @param {string} [options.customSheetName] - Custom sheet name (overrides default)
   * @param {Array<string>} [options.customSelectedColumns] - Custom selected columns (overrides default)
   */
  const exportToExcel = async (data, options = {}) => {
    // Validate data
    if (!data || data.length === 0) {
      toast.warning("No data to export. Please adjust your filters or add data.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    // Determine which columns to export
    const columnsToExport = options.customSelectedColumns || selectedColumns;

    // If selectedColumns is provided and empty, show warning
    if (columnsToExport !== null && columnsToExport.length === 0) {
      toast.warning("Please select at least one column to export.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    setIsExporting(true);

    try {
      // Dynamic import of xlsx to avoid SSR issues
      const XLSX = await import("xlsx");

      // Prepare data for export
      let exportData;

      if (columnsToExport && columnsToExport.length > 0) {
        // Only include selected columns
        exportData = data.map((item) => {
          const row = {};
          columnsToExport.forEach((column) => {
            if (columnMap[column]) {
              row[column] = columnMap[column](item);
            }
          });
          return row;
        });
      } else {
        // Include all columns from columnMap
        exportData = data.map((item) => {
          const row = {};
          Object.keys(columnMap).forEach((column) => {
            row[column] = columnMap[column](item);
          });
          return row;
        });
      }

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      const columnsForWidths = columnsToExport || Object.keys(columnMap);
      const colWidths = columnsForWidths.map((column) => ({
        wch: columnWidths[column] || defaultWidth,
      }));
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      const finalSheetName = options.customSheetName || sheetName;
      XLSX.utils.book_append_sheet(wb, ws, finalSheetName);

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = options.customFilename || `${filenamePrefix}_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} ${filenamePrefix} to ${filename}`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        }
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export data to Excel. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportToExcel,
    isExporting,
  };
};

