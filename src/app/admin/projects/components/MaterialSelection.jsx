import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Save } from "lucide-react";
import { fromData } from "./MaterialSelectionConstants";
import { useAuth } from "@/contexts/AuthContext";
import { getBaseUrl } from "@/lib/baseUrl";
import axios from "axios";
import { toast } from "react-toastify";

export default function MaterialSelection({ lot_id, project_id }) {
  const { getToken } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [materialSelectionData, setMaterialSelectionData] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [activeTab, setActiveTab] = useState("Kitchen"); // Default tab is Kitchen
  const [applicableItems, setApplicableItems] = useState({}); // Store applicable status: { sectionKey: { itemName: true/false } }
  const [notes, setNotes] = useState({}); // Store notes: { sectionKey: { itemName: "note text" } }
  const [customItems, setCustomItems] = useState({}); // Store custom items: { sectionKey: [{ id, name }] }
  const [areaNotes, setAreaNotes] = useState({}); // Store area notes: { sectionKey: "area note text" }
  const [heights, setHeights] = useState({
    ceilingHeight: "",
    bulkheadHeight: "",
    kickerHeight: "",
    cabinetryHeight: "",
  });
  // Bed tabs: { bedId: { id, option: 'WIR' | 'BIR' | null } }
  const [bedTabs, setBedTabs] = useState({});

  // Check if current version is selected (editable)
  const isCurrentVersion = useMemo(() => {
    if (!materialSelectionData || !selectedVersionId) return false;
    return materialSelectionData.current_version_id === selectedVersionId;
  }, [materialSelectionData, selectedVersionId]);

  const handleApplicableChange = (sectionKey, itemName, checked) => {
    setApplicableItems((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [itemName]: checked,
      },
    }));
  };

  const handleNotesChange = (sectionKey, itemName, value) => {
    setNotes((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [itemName]: value,
      },
    }));
  };

  const handleAreaNotesChange = (sectionKey, value) => {
    setAreaNotes((prev) => ({
      ...prev,
      [sectionKey]: value,
    }));
  };

  const handleHeightChange = (heightKey, value) => {
    setHeights((prev) => ({
      ...prev,
      [heightKey]: value,
    }));
  };

  const handleAddCustomItem = (sectionKey, category = null) => {
    const newItem = {
      id: Date.now(),
      name: "",
      category: category, // Store category for bed tabs
    };
    setCustomItems((prev) => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] || []), newItem],
    }));
  };

  const handleRemoveCustomItem = (sectionKey, itemId) => {
    // Get the custom item to remove from current state
    const itemToRemove = customItems[sectionKey]?.find(
      (item) => item.id === itemId
    );

    // First update customItems
    setCustomItems((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).filter(
        (item) => item.id !== itemId
      ),
    }));

    // Then update related state
    if (itemToRemove?.name) {
      setApplicableItems((prev) => {
        const updated = { ...prev };
        if (updated[sectionKey]?.[itemToRemove.name]) {
          delete updated[sectionKey][itemToRemove.name];
        }
        return updated;
      });

      setNotes((prev) => {
        const updated = { ...prev };
        if (updated[sectionKey]?.[itemToRemove.name]) {
          delete updated[sectionKey][itemToRemove.name];
        }
        return updated;
      });
    }
  };

  const handleCustomItemNameChange = (sectionKey, itemId, value) => {
    setCustomItems((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).map((item) =>
        item.id === itemId ? { ...item, name: value } : item
      ),
    }));
  };

  // Helper function to get items for a section (handles nested structure)
  // For bed tabs, returns items grouped by category: [{ category: 'Vanity', items: [...] }, ...]
  // For other tabs, returns simple array of items
  // bedOption: optional parameter to override bedTabs state (useful during form population)
  const getSectionItems = (sectionKey, bedOption = null) => {
    // Handle bed tabs (Bed, Bed 2, Bed 3, etc.)
    if (sectionKey.startsWith("Bed")) {
      const bedId = sectionKey === "Bed" ? "Bed" : sectionKey;
      // Use provided bedOption or fall back to bedTabs state
      const option =
        bedOption !== null ? bedOption : bedTabs[bedId]?.option || null;
      const bedData = fromData.Bed;
      const groupedItems = [];

      // Always include Vanity items
      if (bedData && bedData.Vanity && Array.isArray(bedData.Vanity)) {
        groupedItems.push({
          category: "Vanity",
          items: bedData.Vanity,
        });
      }

      // Include items based on selected option
      if (option && bedData && bedData.option) {
        if (option === "Both") {
          // Show both WIR and BIR when "Both" is selected
          if (bedData.option.WIR && Array.isArray(bedData.option.WIR)) {
            groupedItems.push({
              category: "WIR",
              items: bedData.option.WIR,
            });
          }
          if (bedData.option.BIR && Array.isArray(bedData.option.BIR)) {
            groupedItems.push({
              category: "BIR",
              items: bedData.option.BIR,
            });
          }
        } else if (
          option === "WIR" &&
          bedData.option.WIR &&
          Array.isArray(bedData.option.WIR)
        ) {
          groupedItems.push({
            category: "WIR",
            items: bedData.option.WIR,
          });
        } else if (
          option === "BIR" &&
          bedData.option.BIR &&
          Array.isArray(bedData.option.BIR)
        ) {
          groupedItems.push({
            category: "BIR",
            items: bedData.option.BIR,
          });
        }
      }

      return groupedItems;
    }

    const sectionData = fromData[sectionKey];
    if (Array.isArray(sectionData)) {
      return sectionData;
    }
    // Handle nested structure (other than Bed)
    if (sectionData && typeof sectionData === "object") {
      const allItems = [];
      if (sectionData.Vanity && Array.isArray(sectionData.Vanity)) {
        allItems.push(...sectionData.Vanity);
      }
      if (sectionData.option) {
        if (sectionData.option.WIR && Array.isArray(sectionData.option.WIR)) {
          allItems.push(...sectionData.option.WIR);
        }
        if (sectionData.option.BIR && Array.isArray(sectionData.option.BIR)) {
          allItems.push(...sectionData.option.BIR);
        }
      }
      return allItems;
    }
    return [];
  };

  // Get all available tabs (including dynamic bed tabs) - memoized for performance
  const allTabs = useMemo(() => {
    const tabs = [];
    Object.keys(fromData).forEach((key) => {
      if (key === "Bed") {
        // Add the first Bed tab
        tabs.push("Bed");
        // Add additional bed tabs
        Object.keys(bedTabs).forEach((bedId) => {
          if (bedId !== "Bed") {
            tabs.push(bedId);
          }
        });
      } else {
        tabs.push(key);
      }
    });
    return tabs;
  }, [bedTabs]); // Only recompute when bedTabs changes

  // Calculate applicable items count for a tab
  const getApplicableCount = (sectionKey) => {
    const sectionItems = getSectionItems(sectionKey);
    let count = 0;

    if (
      sectionKey.startsWith("Bed") &&
      Array.isArray(sectionItems) &&
      sectionItems[0]?.category
    ) {
      // Bed tabs with grouped items
      sectionItems.forEach((group) => {
        group.items.forEach((itemName) => {
          if (applicableItems[sectionKey]?.[itemName]) {
            count++;
          }
        });
      });
      // Count custom items
      const customItemsForSection = customItems[sectionKey] || [];
      customItemsForSection.forEach((customItem) => {
        if (customItem.name && applicableItems[sectionKey]?.[customItem.name]) {
          count++;
        }
      });
    } else if (Array.isArray(sectionItems)) {
      // Regular tabs
      sectionItems.forEach((itemName) => {
        if (applicableItems[sectionKey]?.[itemName]) {
          count++;
        }
      });
      // Count custom items
      const customItemsForSection = customItems[sectionKey] || [];
      customItemsForSection.forEach((customItem) => {
        if (customItem.name && applicableItems[sectionKey]?.[customItem.name]) {
          count++;
        }
      });
    }

    return count;
  };

  // Get the next bed tab number
  const getNextBedTabNumber = () => {
    const bedTabKeys = Object.keys(bedTabs);
    if (bedTabKeys.length === 0) return 2;
    const numbers = bedTabKeys
      .map((key) => {
        if (key === "Bed") return 1;
        const match = key.match(/Bed (\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n) => n > 0);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 2;
  };

  // Handle adding a new bed tab
  const handleAddBedTab = () => {
    const nextNumber = getNextBedTabNumber();
    const newBedId = `Bed ${nextNumber}`;
    const newBedTab = { id: newBedId, option: null };

    setBedTabs((prev) => ({
      ...prev,
      [newBedId]: newBedTab,
    }));

    setActiveTab(newBedId);
  };

  // Handle selecting option for existing bed tab
  const handleSelectBedOptionForTab = (bedId, option) => {
    setBedTabs((prev) => ({
      ...prev,
      [bedId]: {
        ...(prev[bedId] || { id: bedId }),
        option: option,
      },
    }));
  };

  // Fetch material selection data
  const fetchMaterialSelection = async () => {
    if (!lot_id) return;

    try {
      setIsLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.get(
        `${getBaseUrl()}/api/material_selection/lot/${lot_id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status && response.data.data) {
        const data = response.data.data;
        setMaterialSelectionData(data);

        // Set current version as selected by default
        if (data.current_version_id) {
          setSelectedVersionId(data.current_version_id);
          populateFormFromVersion(data.currentVersion);
        }
      } else {
        // No material selection exists yet - form is empty and ready for creation
        setMaterialSelectionData(null);
        setSelectedVersionId(null);
      }
    } catch (error) {
      console.error("Error fetching material selection:", error);
      if (error.response?.status !== 404) {
        toast.error(
          error.response?.data?.message ||
            "Failed to fetch material selection. Please try again.",
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Populate form from version data
  const populateFormFromVersion = (version) => {
    if (!version) {
      // Reset form
      setHeights({
        ceilingHeight: "",
        bulkheadHeight: "",
        kickerHeight: "",
        cabinetryHeight: "",
      });
      setApplicableItems({});
      setNotes({});
      setCustomItems({});
      setAreaNotes({});
      setBedTabs({});
      setActiveTab("Kitchen");
      return;
    }

    // Populate heights
    setHeights({
      ceilingHeight: version.ceiling_height
        ? String(version.ceiling_height)
        : "",
      bulkheadHeight: version.bulkhead_height
        ? String(version.bulkhead_height)
        : "",
      kickerHeight: version.kicker_height ? String(version.kicker_height) : "",
      cabinetryHeight: version.cabinetry_height
        ? String(version.cabinetry_height)
        : "",
    });

    // Reset state
    const newApplicableItems = {};
    const newNotes = {};
    const newCustomItems = {};
    const newAreaNotes = {};
    const newBedTabs = {};

    // Process areas
    if (version.areas && Array.isArray(version.areas)) {
      version.areas.forEach((area) => {
        const areaName = area.area_name;

        // Set area notes
        if (area.notes) {
          newAreaNotes[areaName] = area.notes;
        }

        // Handle bed tabs
        if (areaName.startsWith("Bed")) {
          if (area.bed_option) {
            newBedTabs[areaName] = {
              id: areaName,
              option: area.bed_option,
            };
          }
        }

        // Process items
        if (area.items && Array.isArray(area.items)) {
          area.items.forEach((item) => {
            // Set applicable status
            if (!newApplicableItems[areaName]) {
              newApplicableItems[areaName] = {};
            }
            newApplicableItems[areaName][item.name] =
              item.is_applicable || false;

            // Set item notes
            if (item.item_notes) {
              if (!newNotes[areaName]) {
                newNotes[areaName] = {};
              }
              newNotes[areaName][item.name] = item.item_notes;
            }

            // Check if item is custom (not in predefined list)
            // For bed tabs, pass the bed_option directly so getSectionItems knows which items to include
            const bedOptionForCheck = areaName.startsWith("Bed")
              ? area.bed_option
              : null;
            const sectionItems = getSectionItems(areaName, bedOptionForCheck);
            const isPredefined = checkIfItemIsPredefined(
              areaName,
              item.name,
              sectionItems
            );

            if (!isPredefined) {
              // It's a custom item
              if (!newCustomItems[areaName]) {
                newCustomItems[areaName] = [];
              }
              // Check if custom item already exists
              const exists = newCustomItems[areaName].some(
                (ci) => ci.name === item.name && ci.category === item.category
              );
              if (!exists) {
                newCustomItems[areaName].push({
                  id: Date.now() + Math.random(), // Generate unique ID
                  name: item.name,
                  category: item.category || null,
                });
              }
            }
          });
        }
      });
    }

    setApplicableItems(newApplicableItems);
    setNotes(newNotes);
    setCustomItems(newCustomItems);
    setAreaNotes(newAreaNotes);
    setBedTabs(newBedTabs);

    // Set active tab to first area if available
    if (version.areas && version.areas.length > 0) {
      setActiveTab(version.areas[0].area_name);
    }
  };

  // Helper function to check if item is predefined
  const checkIfItemIsPredefined = (areaName, itemName, sectionItems) => {
    if (!sectionItems || sectionItems.length === 0) return false;

    // Check if it's a bed tab with categories
    if (
      areaName.startsWith("Bed") &&
      Array.isArray(sectionItems) &&
      sectionItems[0]?.category
    ) {
      return sectionItems.some((group) => group.items.includes(itemName));
    }

    // Check regular tabs
    if (Array.isArray(sectionItems)) {
      return sectionItems.includes(itemName);
    }

    return false;
  };

  // Handle version change
  const handleVersionChange = async (versionId) => {
    if (!materialSelectionData) return;

    setSelectedVersionId(versionId);

    // If it's the current version, use the data we already have
    if (versionId === materialSelectionData.current_version_id) {
      populateFormFromVersion(materialSelectionData.currentVersion);
      return;
    }

    // For past versions, fetch the version data from API
    try {
      setIsLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.get(
        `${getBaseUrl()}/api/material_selection/version/${versionId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status && response.data.data) {
        populateFormFromVersion(response.data.data);
        toast.success("Version data loaded successfully", {
          position: "top-right",
          autoClose: 2000,
        });
      } else {
        toast.error(response.data.message || "Failed to fetch version data", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error fetching version:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to fetch version data. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount and when lot_id changes
  useEffect(() => {
    if (lot_id) {
      fetchMaterialSelection();
    }
  }, [lot_id]);

  // Collect all data and format for API
  const collectFormData = () => {
    const areasData = [];

    // Process all tabs (areas)
    allTabs.forEach((sectionKey) => {
      const sectionItems = getSectionItems(sectionKey);
      const isBedTab = sectionKey.startsWith("Bed");
      const bedConfig = isBedTab ? bedTabs[sectionKey] : null;

      // Get area notes (convert empty strings to null)
      const areaNote =
        areaNotes[sectionKey] &&
        typeof areaNotes[sectionKey] === "string" &&
        areaNotes[sectionKey].trim() !== ""
          ? areaNotes[sectionKey].trim()
          : null;

      // Get bed option if it's a bed tab
      const bedOption = isBedTab && bedConfig?.option ? bedConfig.option : null;

      // Collect items for this area - only items with data (is_applicable or has notes)
      const items = [];

      // Helper function to check if item has data
      const itemHasData = (itemName) => {
        const isApplicable = applicableItems[sectionKey]?.[itemName] || false;
        const hasNote =
          notes[sectionKey]?.[itemName] &&
          typeof notes[sectionKey][itemName] === "string" &&
          notes[sectionKey][itemName].trim() !== "";
        return isApplicable || hasNote;
      };

      // Process items based on tab type
      if (
        isBedTab &&
        Array.isArray(sectionItems) &&
        sectionItems[0]?.category
      ) {
        // Bed tabs with grouped items by category
        sectionItems.forEach((group) => {
          // Process predefined items in this category - only include if item has data
          group.items.forEach((itemName) => {
            // Only include item if it has data (is applicable or has notes)
            if (!itemHasData(itemName)) {
              return;
            }

            const isApplicable =
              applicableItems[sectionKey]?.[itemName] || false;
            const itemNote =
              notes[sectionKey]?.[itemName] &&
              typeof notes[sectionKey][itemName] === "string" &&
              notes[sectionKey][itemName].trim() !== ""
                ? notes[sectionKey][itemName].trim()
                : null;

            items.push({
              name: itemName,
              category: group.category,
              is_applicable: isApplicable,
              item_notes: itemNote,
            });
          });

          // Process custom items for this category - only include if item has data
          const categoryCustomItems = (customItems[sectionKey] || []).filter(
            (item) =>
              item.category === group.category && item.name.trim() !== ""
          );

          categoryCustomItems.forEach((customItem) => {
            // Only include custom item if it has data (is applicable or has notes)
            if (!itemHasData(customItem.name)) {
              return;
            }

            const isApplicable =
              applicableItems[sectionKey]?.[customItem.name] || false;
            const itemNote =
              notes[sectionKey]?.[customItem.name] &&
              typeof notes[sectionKey][customItem.name] === "string" &&
              notes[sectionKey][customItem.name].trim() !== ""
                ? notes[sectionKey][customItem.name].trim()
                : null;

            items.push({
              name: customItem.name,
              category: group.category,
              is_applicable: isApplicable,
              item_notes: itemNote,
            });
          });
        });
      } else {
        // Regular tabs with simple array of items - only include if item has data
        if (Array.isArray(sectionItems)) {
          sectionItems.forEach((itemName) => {
            // Only include item if it has data (is applicable or has notes)
            if (!itemHasData(itemName)) {
              return;
            }

            const isApplicable =
              applicableItems[sectionKey]?.[itemName] || false;
            const itemNote =
              notes[sectionKey]?.[itemName] &&
              typeof notes[sectionKey][itemName] === "string" &&
              notes[sectionKey][itemName].trim() !== ""
                ? notes[sectionKey][itemName].trim()
                : null;

            items.push({
              name: itemName,
              category: null,
              is_applicable: isApplicable,
              item_notes: itemNote,
            });
          });
        }

        // Process custom items for regular tabs (without category) - only include if item has data
        const regularCustomItems = (customItems[sectionKey] || []).filter(
          (item) => !item.category && item.name.trim() !== ""
        );

        regularCustomItems.forEach((customItem) => {
          // Only include custom item if it has data (is applicable or has notes)
          if (!itemHasData(customItem.name)) {
            return;
          }

          const isApplicable =
            applicableItems[sectionKey]?.[customItem.name] || false;
          const itemNote =
            notes[sectionKey]?.[customItem.name] &&
            typeof notes[sectionKey][customItem.name] === "string" &&
            notes[sectionKey][customItem.name].trim() !== ""
              ? notes[sectionKey][customItem.name].trim()
              : null;

          items.push({
            name: customItem.name,
            category: null,
            is_applicable: isApplicable,
            item_notes: itemNote,
          });
        });
      }

      // Only add area if it has items (areas without items are not sent, even if they have area notes)
      if (items.length > 0) {
        areasData.push({
          area_name: sectionKey,
          area_instance_id: 1,
          bed_option: bedOption,
          notes: areaNote,
          items: items, // Only items with data are included
        });
      }
    });

    // Convert empty strings to null for height fields
    const formatHeight = (value) => {
      return value && value.trim() !== "" ? value.trim() : null;
    };

    // Note: user_id is now retrieved from session token in the API, so we don't need to send it
    return {
      lot_id: lot_id,
      project_id: project_id || null,
      quote_id: null,
      ceiling_height: formatHeight(heights.ceilingHeight),
      bulkhead_height: formatHeight(heights.bulkheadHeight),
      kicker_height: formatHeight(heights.kickerHeight),
      cabinetry_height: formatHeight(heights.cabinetryHeight),
      notes: null,
      is_current: true,
      areas: areasData,
    };
  };

  // Handle create material selection
  const handleCreateMaterialSelection = async () => {
    // Validate required fields
    if (!lot_id) {
      toast.error("Lot ID is required", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      setIsCreating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const formData = collectFormData();

      const response = await axios.post(
        `${getBaseUrl()}/api/material_selection/create`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Material selection created successfully!", {
          position: "top-right",
          autoClose: 3000,
        });
        // Refresh data after creation
        await fetchMaterialSelection();
      } else {
        toast.error(
          response.data.message || "Failed to create material selection",
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
      }
    } catch (error) {
      console.error("Error creating material selection:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to create material selection. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Get versions list for dropdown
  const versionsList = useMemo(() => {
    if (!materialSelectionData || !materialSelectionData.versions) return [];
    return materialSelectionData.versions.sort(
      (a, b) => b.version_number - a.version_number
    );
  }, [materialSelectionData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        <span className="ml-3 text-slate-600">
          Loading material selection...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Version Selector and Create Button */}
      <div className="flex justify-between items-center mb-4">
        {/* Version Dropdown */}
        {materialSelectionData && versionsList.length > 0 && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="version-select"
              className="text-sm font-medium text-slate-600"
            >
              Version:
            </label>
            <select
              id="version-select"
              value={selectedVersionId || ""}
              onChange={(e) => handleVersionChange(e.target.value)}
              className="cursor-pointer px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent bg-white text-slate-700 font-medium"
            >
              {versionsList.map((version) => (
                <option key={version.id} value={version.id}>
                  Version {version.version_number}
                  {version.is_current ? " (Current)" : ""}
                  {version.id === selectedVersionId && !version.is_current
                    ? " (Viewing)"
                    : ""}
                </option>
              ))}
            </select>
            {!isCurrentVersion && (
              <span className="text-sm text-amber-600 font-medium">
                (Read-only - Only current version can be edited)
              </span>
            )}
          </div>
        )}

        {/* Create/Update Button - Only show for current version or when no material selection exists */}
        <div className="flex justify-end">
          {(!materialSelectionData || isCurrentVersion) && (
            <button
              onClick={handleCreateMaterialSelection}
              disabled={
                isCreating ||
                !lot_id ||
                (!isCurrentVersion && materialSelectionData)
              }
              className="cursor-pointer hover:bg-primary/90 flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              {isCreating ? (
                <>
                  <div className=" animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {materialSelectionData ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {materialSelectionData
                    ? "Update Material Selection"
                    : "Create Material Selection"}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Height Section */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="ceilingHeight"
            className="text-sm font-medium text-slate-600"
          >
            Ceiling Height (mm)
          </label>
          <input
            placeholder="Enter Ceiling Height (mm)"
            type="text"
            id="ceilingHeight"
            value={heights.ceilingHeight}
            onChange={(e) =>
              handleHeightChange("ceilingHeight", e.target.value)
            }
            disabled={!isCurrentVersion && materialSelectionData}
            className="border border-slate-300 rounded-md p-2 focus:outline-none focus:ring focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="bulkheadHeight"
            className="text-sm font-medium text-slate-600"
          >
            Bulkhead Height (mm)
          </label>
          <input
            placeholder="Enter Bulkhead Height (mm)"
            type="text"
            id="bulkheadHeight"
            value={heights.bulkheadHeight}
            onChange={(e) =>
              handleHeightChange("bulkheadHeight", e.target.value)
            }
            disabled={!isCurrentVersion && materialSelectionData}
            className="border border-slate-300 rounded-md p-2 focus:outline-none focus:ring focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="kickerHeight"
            className="text-sm font-medium text-slate-600"
          >
            Kicker Height (mm)
          </label>
          <input
            placeholder="Enter Kicker Height (mm)"
            type="text"
            id="kickerHeight"
            value={heights.kickerHeight}
            onChange={(e) => handleHeightChange("kickerHeight", e.target.value)}
            disabled={!isCurrentVersion && materialSelectionData}
            className="border border-slate-300 rounded-md p-2 focus:outline-none focus:ring focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="cabinetryHeight"
            className="text-sm font-medium text-slate-600"
          >
            Cabinetry Height (mm)
          </label>
          <input
            placeholder="Enter Cabinetry Height (mm)"
            type="text"
            id="cabinetryHeight"
            value={heights.cabinetryHeight}
            onChange={(e) =>
              handleHeightChange("cabinetryHeight", e.target.value)
            }
            disabled={!isCurrentVersion && materialSelectionData}
            className="border border-slate-300 rounded-md p-2 focus:outline-none focus:ring focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
          />
        </div>
      </div>

      {/* Tabs Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Material Selection by Area
        </h3>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex flex-wrap gap-2 overflow-x-auto items-center">
            {allTabs.map((sectionKey, index, array) => {
              const isBedTab = sectionKey.startsWith("Bed");
              const bedConfig = isBedTab ? bedTabs[sectionKey] : null;
              // Show plus button only on the last bed tab
              const isLastBedTab =
                isBedTab &&
                (index === array.length - 1 ||
                  !array[index + 1]?.startsWith("Bed"));
              const applicableCount = getApplicableCount(sectionKey);

              return (
                <div key={sectionKey} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab(sectionKey)}
                    className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === sectionKey
                        ? "border-secondary text-secondary"
                        : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                    }`}
                  >
                    {sectionKey}
                    {applicableCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-secondary/20 text-secondary rounded-full text-xs font-semibold">
                        {applicableCount}
                      </span>
                    )}
                  </button>
                  {isLastBedTab &&
                    (isCurrentVersion || !materialSelectionData) && (
                      <button
                        onClick={handleAddBedTab}
                        disabled={!isCurrentVersion && materialSelectionData}
                        className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Add another bed tab"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {allTabs.map((sectionKey) => {
          if (activeTab !== sectionKey) return null;

          const sectionItems = getSectionItems(sectionKey);
          const isBedTab = sectionKey.startsWith("Bed");
          const bedConfig = isBedTab ? bedTabs[sectionKey] : null;

          return (
            <div
              key={sectionKey}
              className="border border-slate-200 rounded-lg bg-white mt-4"
            >
              <div className="p-4">
                {/* Bed Option Selection - Always show for bed tabs */}
                {isBedTab && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Robe Option for {sectionKey}
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          handleSelectBedOptionForTab(sectionKey, "WIR")
                        }
                        disabled={!isCurrentVersion && materialSelectionData}
                        className={`cursor-pointer px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          bedConfig?.option === "WIR"
                            ? "bg-secondary text-white border-secondary"
                            : "bg-white"
                        }`}
                      >
                        WIR
                      </button>
                      <button
                        onClick={() =>
                          handleSelectBedOptionForTab(sectionKey, "BIR")
                        }
                        disabled={!isCurrentVersion && materialSelectionData}
                        className={`cursor-pointer px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          bedConfig?.option === "BIR"
                            ? "bg-secondary text-white border-secondary"
                            : "bg-white"
                        }`}
                      >
                        BIR
                      </button>
                      <button
                        onClick={() =>
                          handleSelectBedOptionForTab(sectionKey, "Both")
                        }
                        disabled={!isCurrentVersion && materialSelectionData}
                        className={`cursor-pointer px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 hover:text-secondary hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          bedConfig?.option === "Both"
                            ? "bg-secondary text-white border-secondary"
                            : "bg-white"
                        }`}
                      >
                        Both
                      </button>
                    </div>
                  </div>
                )}

                {/* Disabled overlay message for past versions */}
                {!isCurrentVersion && materialSelectionData && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>Read-only mode:</strong> You are viewing a past
                      version. Only the current version can be edited.
                    </p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 w-1/4">
                          Names
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700 w-1/6">
                          Applicable
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-700">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionKey.startsWith("Bed") &&
                      Array.isArray(sectionItems) &&
                      sectionItems[0]?.category
                        ? // Bed tabs with grouped items by category
                          sectionItems.map((group, groupIndex) => {
                            // Get custom items for this category
                            const categoryCustomItems = (
                              customItems[sectionKey] || []
                            ).filter(
                              (item) => item.category === group.category
                            );

                            return (
                              <React.Fragment key={groupIndex}>
                                {/* Category Header Row */}
                                <tr className="bg-slate-100 border-b-2 border-slate-300">
                                  <td
                                    colSpan={3}
                                    className="py-3 px-4 font-semibold text-slate-800 uppercase text-sm"
                                  >
                                    {group.category}
                                  </td>
                                </tr>
                                {/* Items in this category */}
                                {group.items.map((itemName, itemIndex) => {
                                  const isApplicable =
                                    applicableItems[sectionKey]?.[itemName] ||
                                    false;
                                  const noteValue =
                                    notes[sectionKey]?.[itemName] || "";

                                  return (
                                    <tr
                                      key={`${groupIndex}-${itemIndex}`}
                                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                    >
                                      <td className="py-3 px-4 text-slate-700">
                                        {itemName}
                                      </td>
                                      <td className="py-3 px-4">
                                        <label
                                          className={`flex items-center gap-2 ${
                                            !isCurrentVersion &&
                                            materialSelectionData
                                              ? "cursor-not-allowed"
                                              : "cursor-pointer"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isApplicable}
                                            onChange={(e) =>
                                              handleApplicableChange(
                                                sectionKey,
                                                itemName,
                                                e.target.checked
                                              )
                                            }
                                            disabled={
                                              !isCurrentVersion &&
                                              materialSelectionData
                                            }
                                            className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                          />
                                          <span className="text-sm text-slate-600">
                                            {isApplicable ? "Yes" : "No"}
                                          </span>
                                        </label>
                                      </td>
                                      <td className="py-3 px-4">
                                        <textarea
                                          placeholder="Add notes..."
                                          value={noteValue}
                                          onChange={(e) =>
                                            handleNotesChange(
                                              sectionKey,
                                              itemName,
                                              e.target.value
                                            )
                                          }
                                          disabled={
                                            !isCurrentVersion &&
                                            materialSelectionData
                                          }
                                          rows={2}
                                          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Custom Items for this category */}
                                {categoryCustomItems.map((customItem) => {
                                  const isApplicable =
                                    applicableItems[sectionKey]?.[
                                      customItem.name
                                    ] || false;
                                  const noteValue =
                                    notes[sectionKey]?.[customItem.name] || "";

                                  return (
                                    <tr
                                      key={customItem.id}
                                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-blue-50/30"
                                    >
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            placeholder="Enter custom name..."
                                            value={customItem.name}
                                            onChange={(e) =>
                                              handleCustomItemNameChange(
                                                sectionKey,
                                                customItem.id,
                                                e.target.value
                                              )
                                            }
                                            disabled={
                                              !isCurrentVersion &&
                                              materialSelectionData
                                            }
                                            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                          />
                                          <button
                                            onClick={() =>
                                              handleRemoveCustomItem(
                                                sectionKey,
                                                customItem.id
                                              )
                                            }
                                            disabled={
                                              !isCurrentVersion &&
                                              materialSelectionData
                                            }
                                            className="cursor-pointer p-2 hover:bg-red-100 text-red-600 rounded-md transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Remove this item"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4">
                                        <label
                                          className={`flex items-center gap-2 ${
                                            !isCurrentVersion &&
                                            materialSelectionData
                                              ? "cursor-not-allowed"
                                              : "cursor-pointer"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isApplicable}
                                            onChange={(e) =>
                                              handleApplicableChange(
                                                sectionKey,
                                                customItem.name,
                                                e.target.checked
                                              )
                                            }
                                            disabled={
                                              !isCurrentVersion &&
                                              materialSelectionData
                                            }
                                            className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                          />
                                          <span className="text-sm text-slate-600">
                                            {isApplicable ? "Yes" : "No"}
                                          </span>
                                        </label>
                                      </td>
                                      <td className="py-3 px-4">
                                        <textarea
                                          placeholder="Add notes..."
                                          value={noteValue}
                                          onChange={(e) =>
                                            handleNotesChange(
                                              sectionKey,
                                              customItem.name,
                                              e.target.value
                                            )
                                          }
                                          disabled={
                                            !isCurrentVersion &&
                                            materialSelectionData
                                          }
                                          rows={2}
                                          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Add Custom Button for this category */}
                                {(isCurrentVersion ||
                                  !materialSelectionData) && (
                                  <tr>
                                    <td colSpan={3} className="py-2 px-4">
                                      <button
                                        onClick={() =>
                                          handleAddCustomItem(
                                            sectionKey,
                                            group.category
                                          )
                                        }
                                        disabled={
                                          !isCurrentVersion &&
                                          materialSelectionData
                                        }
                                        className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-secondary hover:text-secondary/80 hover:bg-secondary/10 rounded-md transition-colors border border-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add Custom to {group.category}
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        : // Regular tabs with simple array of items
                          Array.isArray(sectionItems) &&
                          sectionItems.map((itemName, index) => {
                            const isApplicable =
                              applicableItems[sectionKey]?.[itemName] || false;
                            const noteValue =
                              notes[sectionKey]?.[itemName] || "";

                            return (
                              <tr
                                key={index}
                                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                              >
                                <td className="py-3 px-4 text-slate-700">
                                  {itemName}
                                </td>
                                <td className="py-3 px-4">
                                  <label
                                    className={`flex items-center gap-2 ${
                                      !isCurrentVersion && materialSelectionData
                                        ? "cursor-not-allowed"
                                        : "cursor-pointer"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isApplicable}
                                      onChange={(e) =>
                                        handleApplicableChange(
                                          sectionKey,
                                          itemName,
                                          e.target.checked
                                        )
                                      }
                                      disabled={
                                        !isCurrentVersion &&
                                        materialSelectionData
                                      }
                                      className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span className="text-sm text-slate-600">
                                      {isApplicable ? "Yes" : "No"}
                                    </span>
                                  </label>
                                </td>
                                <td className="py-3 px-4">
                                  <textarea
                                    placeholder="Add notes..."
                                    value={noteValue}
                                    onChange={(e) =>
                                      handleNotesChange(
                                        sectionKey,
                                        itemName,
                                        e.target.value
                                      )
                                    }
                                    disabled={
                                      !isCurrentVersion && materialSelectionData
                                    }
                                    rows={2}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      {/* Custom Items (only for regular tabs, bed tabs show custom items in their categories) */}
                      {!sectionKey.startsWith("Bed") &&
                        customItems[sectionKey]
                          ?.filter((item) => !item.category)
                          .map((customItem) => {
                            const isApplicable =
                              applicableItems[sectionKey]?.[customItem.name] ||
                              false;
                            const noteValue =
                              notes[sectionKey]?.[customItem.name] || "";

                            return (
                              <tr
                                key={customItem.id}
                                className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-blue-50/30"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Enter custom name..."
                                      value={customItem.name}
                                      onChange={(e) =>
                                        handleCustomItemNameChange(
                                          sectionKey,
                                          customItem.id,
                                          e.target.value
                                        )
                                      }
                                      disabled={
                                        !isCurrentVersion &&
                                        materialSelectionData
                                      }
                                      className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                    />
                                    <button
                                      onClick={() =>
                                        handleRemoveCustomItem(
                                          sectionKey,
                                          customItem.id
                                        )
                                      }
                                      disabled={
                                        !isCurrentVersion &&
                                        materialSelectionData
                                      }
                                      className="cursor-pointer p-2 hover:bg-red-100 text-red-600 rounded-md transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Remove this item"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <label
                                    className={`flex items-center gap-2 ${
                                      !isCurrentVersion && materialSelectionData
                                        ? "cursor-not-allowed"
                                        : "cursor-pointer"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isApplicable}
                                      onChange={(e) =>
                                        handleApplicableChange(
                                          sectionKey,
                                          customItem.name,
                                          e.target.checked
                                        )
                                      }
                                      disabled={
                                        !isCurrentVersion &&
                                        materialSelectionData
                                      }
                                      className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span className="text-sm text-slate-600">
                                      {isApplicable ? "Yes" : "No"}
                                    </span>
                                  </label>
                                </td>
                                <td className="py-3 px-4">
                                  <textarea
                                    placeholder="Add notes..."
                                    value={noteValue}
                                    onChange={(e) =>
                                      handleNotesChange(
                                        sectionKey,
                                        customItem.name,
                                        e.target.value
                                      )
                                    }
                                    disabled={
                                      !isCurrentVersion && materialSelectionData
                                    }
                                    rows={2}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>

                {/* Add Custom Item Button (only for regular tabs, bed tabs have buttons in each category) */}
                {!sectionKey.startsWith("Bed") &&
                  (isCurrentVersion || !materialSelectionData) && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleAddCustomItem(sectionKey)}
                        disabled={!isCurrentVersion && materialSelectionData}
                        className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-secondary hover:text-secondary/80 hover:bg-secondary/10 rounded-md transition-colors border border-secondary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        Add Custom
                      </button>
                    </div>
                  )}

                {/* Area Notes Section */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label
                    htmlFor={`area-notes-${sectionKey}`}
                    className="block text-sm font-medium text-slate-700 mb-2"
                  >
                    Area Notes
                  </label>
                  <textarea
                    id={`area-notes-${sectionKey}`}
                    value={areaNotes[sectionKey] || ""}
                    onChange={(e) =>
                      handleAreaNotesChange(sectionKey, e.target.value)
                    }
                    disabled={!isCurrentVersion && materialSelectionData}
                    placeholder="Add notes for this area..."
                    rows={3}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
