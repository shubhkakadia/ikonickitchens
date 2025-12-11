import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Save, Download } from "lucide-react";
import { formData } from "./MaterialSelectionConstants";
import { useAuth } from "@/contexts/AuthContext";
import { getBaseUrl } from "@/lib/baseUrl";
import axios from "axios";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

export default function MaterialSelection({ lot_id, project_id }) {
  const { getToken } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [materialSelectionData, setMaterialSelectionData] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [activeTab, setActiveTab] = useState("Kitchen");
  const [applicableItems, setApplicableItems] = useState({});
  const [notes, setNotes] = useState({});
  const [customItems, setCustomItems] = useState({});
  const [areaNotes, setAreaNotes] = useState({});
  const [heights, setHeights] = useState({
    ceilingHeight: "",
    bulkheadHeight: "",
    kickerHeight: "",
    cabinetryHeight: "",
  });
  // Bed tabs: { bedId: { id, option: 'WIR' | 'BIR' | null } }
  const [bedTabs, setBedTabs] = useState({});
  // Custom areas: { areaId: { id, name: string } }
  const [customAreas, setCustomAreas] = useState({});

  // Check if current version is selected (editable)
  const isCurrentVersion = useMemo(() => {
    if (!materialSelectionData || !selectedVersionId) return false;
    return materialSelectionData.current_version_id === selectedVersionId;
  }, [materialSelectionData, selectedVersionId]);

  // Helper function to create a unique key for items that includes category when it exists
  // This ensures items with the same name in different categories (WIR vs BIR) are distinct
  const getItemKey = (itemName, category = null) => {
    if (category) {
      return `${category}:${itemName}`;
    }
    return itemName;
  };

  const handleApplicableChange = (sectionKey, itemName, checked, category = null) => {
    const itemKey = getItemKey(itemName, category);
    setApplicableItems((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [itemKey]: checked,
      },
    }));
  };

  const handleNotesChange = (sectionKey, itemName, value, category = null) => {
    const itemKey = getItemKey(itemName, category);
    setNotes((prev) => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [itemKey]: value,
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

    // Then update related state using category-aware key
    if (itemToRemove?.name) {
      const itemKey = getItemKey(itemToRemove.name, itemToRemove.category);
      setApplicableItems((prev) => {
        const updated = { ...prev };
        if (updated[sectionKey]?.[itemKey]) {
          delete updated[sectionKey][itemKey];
        }
        return updated;
      });

      setNotes((prev) => {
        const updated = { ...prev };
        if (updated[sectionKey]?.[itemKey]) {
          delete updated[sectionKey][itemKey];
        }
        return updated;
      });
    }
  };

  const handleCustomItemNameChange = (sectionKey, itemId, value) => {
    // Get the current item to find its old name and category
    const currentItem = customItems[sectionKey]?.find(
      (item) => item.id === itemId
    );
    const oldName = currentItem?.name;
    const category = currentItem?.category || null;
    const oldItemKey = oldName ? getItemKey(oldName, category) : null;

    // Update custom items
    setCustomItems((prev) => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] || []).map((item) =>
        item.id === itemId ? { ...item, name: value } : item
      ),
    }));

    // Migrate state from old key to new key if name changed
    if (oldName && oldName !== value && oldItemKey) {
      const newItemKey = getItemKey(value, category);

      // Migrate applicable items
      setApplicableItems((prev) => {
        const updated = { ...prev };
        if (updated[sectionKey]?.[oldItemKey] !== undefined) {
          updated[sectionKey] = {
            ...(updated[sectionKey] || {}),
            [newItemKey]: updated[sectionKey][oldItemKey],
          };
          delete updated[sectionKey][oldItemKey];
        }
        return updated;
      });

      // Migrate notes
      setNotes((prev) => {
        const updated = { ...prev };
        if (updated[sectionKey]?.[oldItemKey] !== undefined) {
          updated[sectionKey] = {
            ...(updated[sectionKey] || {}),
            [newItemKey]: updated[sectionKey][oldItemKey],
          };
          delete updated[sectionKey][oldItemKey];
        }
        return updated;
      });
    }
  };

  // Helper function to get items for a section (handles nested structure)
  // For bed tabs, returns items grouped by category: [{ category: 'Vanity', items: [...] }, ...]
  // For other tabs, returns simple array of items
  // For custom areas, returns empty array (no predefined items)
  // bedOption: optional parameter to override bedTabs state (useful during form population)
  const getSectionItems = (sectionKey, bedOption = null) => {
    // Handle custom areas - return empty array (no predefined items)
    if (customAreas[sectionKey]) {
      return [];
    }

    // Handle bed tabs (Bed, Bed 2, Bed 3, etc.)
    if (sectionKey.startsWith("Bed")) {
      const bedId = sectionKey === "Bed" ? "Bed" : sectionKey;
      // Use provided bedOption or fall back to bedTabs state
      const option =
        bedOption !== null ? bedOption : bedTabs[bedId]?.option || null;
      const bedData = formData.Bed;
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

    const sectionData = formData[sectionKey];
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

  // Get all available tabs (including dynamic bed tabs and custom areas) - memoized for performance
  const allTabs = useMemo(() => {
    const tabs = [];
    Object.keys(formData).forEach((key) => {
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
    // Add custom areas at the end
    Object.keys(customAreas).forEach((areaId) => {
      tabs.push(areaId);
    });
    return tabs;
  }, [bedTabs, customAreas]); // Recompute when bedTabs or customAreas changes

  // Calculate applicable items count for a tab
  const getApplicableCount = (sectionKey) => {
    // Handle custom areas - count only custom items
    if (customAreas[sectionKey]) {
      const customItemsForSection = customItems[sectionKey] || [];
      return customItemsForSection.filter((item) => {
        if (!item.name) return false;
        const itemKey = getItemKey(item.name, null);
        return applicableItems[sectionKey]?.[itemKey] || false;
      }).length;
    }

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
          const itemKey = getItemKey(itemName, group.category);
          if (applicableItems[sectionKey]?.[itemKey]) {
            count++;
          }
        });
      });
      // Count custom items
      const customItemsForSection = customItems[sectionKey] || [];
      customItemsForSection.forEach((customItem) => {
        if (customItem.name) {
          const itemKey = getItemKey(customItem.name, customItem.category);
          if (applicableItems[sectionKey]?.[itemKey]) {
            count++;
          }
        }
      });
    } else if (Array.isArray(sectionItems)) {
      // Regular tabs
      sectionItems.forEach((itemName) => {
        const itemKey = getItemKey(itemName, null);
        if (applicableItems[sectionKey]?.[itemKey]) {
          count++;
        }
      });
      // Count custom items
      const customItemsForSection = customItems[sectionKey] || [];
      customItemsForSection.forEach((customItem) => {
        if (customItem.name) {
          const itemKey = getItemKey(customItem.name, customItem.category);
          if (applicableItems[sectionKey]?.[itemKey]) {
            count++;
          }
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

  // Get the next custom area number
  const getNextCustomAreaNumber = () => {
    const customAreaKeys = Object.keys(customAreas);
    if (customAreaKeys.length === 0) return 1;
    const numbers = customAreaKeys
      .map((key) => {
        const match = key.match(/Custom Area (\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((n) => n > 0);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  };

  // Handle adding a new custom area
  const handleAddCustomArea = () => {
    const nextNumber = getNextCustomAreaNumber();
    const newAreaId = `Custom Area ${nextNumber}`;
    const newCustomArea = {
      id: newAreaId,
      name: newAreaId,
      originalNumber: nextNumber.toString() // Store original number for default value
    };

    setCustomAreas((prev) => ({
      ...prev,
      [newAreaId]: newCustomArea,
    }));

    setActiveTab(newAreaId);
  };

  // Handle renaming a custom area
  const handleRenameCustomArea = (oldAreaId, newAreaName) => {
    if (!newAreaName || newAreaName.trim() === "") {
      return; // Don't allow empty names
    }

    const newAreaId = newAreaName.trim();

    // If the name hasn't changed, do nothing
    if (oldAreaId === newAreaId) {
      return;
    }

    // Check if new name already exists
    if (customAreas[newAreaId] || formData[newAreaId]) {
      toast.error("An area with this name already exists", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Update customAreas state
    setCustomAreas((prev) => {
      const updated = { ...prev };
      if (updated[oldAreaId]) {
        // Preserve originalNumber when renaming
        updated[newAreaId] = {
          ...updated[oldAreaId],
          id: newAreaId,
          name: newAreaId,
          originalNumber: updated[oldAreaId].originalNumber || "1",
        };
        delete updated[oldAreaId];
      }
      return updated;
    });

    // Migrate all related state to new key
    if (applicableItems[oldAreaId]) {
      setApplicableItems((prev) => {
        const updated = { ...prev };
        updated[newAreaId] = updated[oldAreaId];
        delete updated[oldAreaId];
        return updated;
      });
    }

    if (notes[oldAreaId]) {
      setNotes((prev) => {
        const updated = { ...prev };
        updated[newAreaId] = updated[oldAreaId];
        delete updated[oldAreaId];
        return updated;
      });
    }

    if (customItems[oldAreaId]) {
      setCustomItems((prev) => {
        const updated = { ...prev };
        updated[newAreaId] = updated[oldAreaId];
        delete updated[oldAreaId];
        return updated;
      });
    }

    if (areaNotes[oldAreaId] !== undefined) {
      setAreaNotes((prev) => {
        const updated = { ...prev };
        updated[newAreaId] = updated[oldAreaId];
        delete updated[oldAreaId];
        return updated;
      });
    }

    // Update active tab if it was the renamed area
    if (activeTab === oldAreaId) {
      setActiveTab(newAreaId);
    }
  };

  // Handle removing a custom area
  const handleRemoveCustomArea = (areaId) => {
    // If the removed area was active, switch to another tab first
    if (activeTab === areaId) {
      // Find another custom area or default to "Kitchen"
      const remainingCustomAreas = Object.keys(customAreas).filter(
        (id) => id !== areaId
      );
      if (remainingCustomAreas.length > 0) {
        setActiveTab(remainingCustomAreas[0]);
      } else {
        // Find first non-custom area tab from formData
        const nonCustomTabs = Object.keys(formData);
        setActiveTab(nonCustomTabs.length > 0 ? nonCustomTabs[0] : "Kitchen");
      }
    }

    // Remove from customAreas state
    setCustomAreas((prev) => {
      const updated = { ...prev };
      delete updated[areaId];
      return updated;
    });

    // Clean up related state for this custom area
    setApplicableItems((prev) => {
      const updated = { ...prev };
      delete updated[areaId];
      return updated;
    });

    setNotes((prev) => {
      const updated = { ...prev };
      delete updated[areaId];
      return updated;
    });

    setCustomItems((prev) => {
      const updated = { ...prev };
      delete updated[areaId];
      return updated;
    });

    setAreaNotes((prev) => {
      const updated = { ...prev };
      delete updated[areaId];
      return updated;
    });
  };

  // Handle removing a bed tab
  const handleRemoveBedTab = (bedId) => {
    // Don't allow removing the first "Bed" tab
    if (bedId === "Bed") {
      return;
    }

    // If the removed bed tab was active, switch to another tab first
    if (activeTab === bedId) {
      // Find another bed tab or default to "Kitchen"
      const remainingBedTabs = Object.keys(bedTabs).filter(
        (id) => id !== bedId && id.startsWith("Bed")
      );
      if (remainingBedTabs.length > 0) {
        setActiveTab(remainingBedTabs[0]);
      } else {
        // Find first non-bed tab from formData
        const nonBedTabs = Object.keys(formData).filter(
          (key) => key !== "Bed"
        );
        setActiveTab(nonBedTabs.length > 0 ? nonBedTabs[0] : "Kitchen");
      }
    }

    // Remove from bedTabs state
    setBedTabs((prev) => {
      const updated = { ...prev };
      delete updated[bedId];
      return updated;
    });

    // Clean up related state for this bed tab
    setApplicableItems((prev) => {
      const updated = { ...prev };
      delete updated[bedId];
      return updated;
    });

    setNotes((prev) => {
      const updated = { ...prev };
      delete updated[bedId];
      return updated;
    });

    setCustomItems((prev) => {
      const updated = { ...prev };
      delete updated[bedId];
      return updated;
    });

    setAreaNotes((prev) => {
      const updated = { ...prev };
      delete updated[bedId];
      return updated;
    });
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
      setCustomAreas({});
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
    const newCustomAreas = {};

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
        } else if (areaName.startsWith("Custom Area")) {
          // Handle custom areas - extract original number
          const match = areaName.match(/Custom Area (\d+)/);
          const originalNumber = match ? match[1] : "1";
          newCustomAreas[areaName] = {
            id: areaName,
            name: areaName,
            originalNumber: originalNumber,
          };
        } else if (!formData[areaName]) {
          // If area doesn't exist in formData and is not a bed, treat it as custom area
          // Try to extract number if it matches pattern, otherwise use "1"
          const match = areaName.match(/Custom Area (\d+)/);
          const originalNumber = match ? match[1] : "1";
          newCustomAreas[areaName] = {
            id: areaName,
            name: areaName,
            originalNumber: originalNumber,
          };
        }

        // Process items
        if (area.items && Array.isArray(area.items)) {
          area.items.forEach((item) => {
            // Use category-aware key for items
            const itemKey = getItemKey(item.name, item.category || null);

            // Set applicable status
            if (!newApplicableItems[areaName]) {
              newApplicableItems[areaName] = {};
            }
            newApplicableItems[areaName][itemKey] =
              item.is_applicable || false;

            // Set item notes
            if (item.item_notes) {
              if (!newNotes[areaName]) {
                newNotes[areaName] = {};
              }
              newNotes[areaName][itemKey] = item.item_notes;
            }

            // For custom areas, all items are custom items
            if (newCustomAreas[areaName] || (!formData[areaName] && !areaName.startsWith("Bed"))) {
              // It's a custom area, so all items are custom
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
            } else {
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
    setCustomAreas(newCustomAreas);

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
      const isCustomArea = customAreas[sectionKey] !== undefined;
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

      // Helper function to check if item has data (with category support)
      const itemHasData = (itemName, category = null) => {
        const itemKey = getItemKey(itemName, category);
        const isApplicable = applicableItems[sectionKey]?.[itemKey] || false;
        const hasNote =
          notes[sectionKey]?.[itemKey] &&
          typeof notes[sectionKey][itemKey] === "string" &&
          notes[sectionKey][itemKey].trim() !== "";
        return isApplicable || hasNote;
      };

      // Process items based on tab type
      if (isCustomArea) {
        // Custom areas - only process custom items (no predefined items)
        const customAreaItems = (customItems[sectionKey] || []).filter(
          (item) => !item.category && item.name.trim() !== ""
        );

        customAreaItems.forEach((customItem) => {
          // Always include custom items if they have a name, regardless of applicable status or notes
          const itemKey = getItemKey(customItem.name, null);
          const isApplicable =
            applicableItems[sectionKey]?.[itemKey] || false;
          const itemNote =
            notes[sectionKey]?.[itemKey] &&
              typeof notes[sectionKey][itemKey] === "string" &&
              notes[sectionKey][itemKey].trim() !== ""
              ? notes[sectionKey][itemKey].trim()
              : null;

          items.push({
            name: customItem.name,
            category: null,
            is_applicable: isApplicable,
            item_notes: itemNote,
          });
        });
      } else if (
        isBedTab &&
        Array.isArray(sectionItems) &&
        sectionItems[0]?.category
      ) {
        // Bed tabs with grouped items by category
        sectionItems.forEach((group) => {
          // Process predefined items in this category - only include if item has data
          group.items.forEach((itemName) => {
            // Only include item if it has data (is applicable or has notes)
            if (!itemHasData(itemName, group.category)) {
              return;
            }

            const itemKey = getItemKey(itemName, group.category);
            const isApplicable =
              applicableItems[sectionKey]?.[itemKey] || false;
            const itemNote =
              notes[sectionKey]?.[itemKey] &&
                typeof notes[sectionKey][itemKey] === "string" &&
                notes[sectionKey][itemKey].trim() !== ""
                ? notes[sectionKey][itemKey].trim()
                : null;

            items.push({
              name: itemName,
              category: group.category,
              is_applicable: isApplicable,
              item_notes: itemNote,
            });
          });

          // Process custom items for this category - always include if they have a name
          const categoryCustomItems = (customItems[sectionKey] || []).filter(
            (item) =>
              item.category === group.category && item.name.trim() !== ""
          );

          categoryCustomItems.forEach((customItem) => {
            // Always include custom items if they have a name, regardless of applicable status or notes
            const itemKey = getItemKey(customItem.name, customItem.category);
            const isApplicable =
              applicableItems[sectionKey]?.[itemKey] || false;
            const itemNote =
              notes[sectionKey]?.[itemKey] &&
                typeof notes[sectionKey][itemKey] === "string" &&
                notes[sectionKey][itemKey].trim() !== ""
                ? notes[sectionKey][itemKey].trim()
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
            if (!itemHasData(itemName, null)) {
              return;
            }

            const itemKey = getItemKey(itemName, null);
            const isApplicable =
              applicableItems[sectionKey]?.[itemKey] || false;
            const itemNote =
              notes[sectionKey]?.[itemKey] &&
                typeof notes[sectionKey][itemKey] === "string" &&
                notes[sectionKey][itemKey].trim() !== ""
                ? notes[sectionKey][itemKey].trim()
                : null;

            items.push({
              name: itemName,
              category: null,
              is_applicable: isApplicable,
              item_notes: itemNote,
            });
          });
        }

        // Process custom items for regular tabs (without category) - always include if they have a name
        const regularCustomItems = (customItems[sectionKey] || []).filter(
          (item) => !item.category && item.name.trim() !== ""
        );

        regularCustomItems.forEach((customItem) => {
          // Always include custom items if they have a name, regardless of applicable status or notes
          const itemKey = getItemKey(customItem.name, null);
          const isApplicable =
            applicableItems[sectionKey]?.[itemKey] || false;
          const itemNote =
            notes[sectionKey]?.[itemKey] &&
              typeof notes[sectionKey][itemKey] === "string" &&
              notes[sectionKey][itemKey].trim() !== ""
              ? notes[sectionKey][itemKey].trim()
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

  // Get selected version data
  const getSelectedVersionData = async () => {
    if (!materialSelectionData || !selectedVersionId) {
      return null;
    }

    // If it's the current version, use the data we already have
    if (selectedVersionId === materialSelectionData.current_version_id) {
      return materialSelectionData.currentVersion;
    }

    // For past versions, fetch the version data from API
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return null;
      }

      const response = await axios.get(
        `${getBaseUrl()}/api/material_selection/version/${selectedVersionId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status && response.data.data) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error("Error fetching version for export:", error);
      toast.error("Failed to fetch version data for export", {
        position: "top-right",
        autoClose: 3000,
      });
      return null;
    }
  };

  // Export to Excel
  const handleExportToExcel = async () => {
    if (!selectedVersionId) {
      toast.error("Please select a version to export", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      const versionData = await getSelectedVersionData();
      if (!versionData) {
        return;
      }

      // Prepare data for Excel
      const excelData = [];

      // Add header row
      excelData.push([
        "Area Name",
        "Bed Option",
        "Area Notes",
        "Item Name",
        "Category",
        "Applicable",
        "Item Notes",
      ]);

      // Process areas - only include areas with values
      if (versionData.areas && Array.isArray(versionData.areas)) {
        versionData.areas.forEach((area) => {
          // Check if area has any items or notes
          const hasItems = area.items && Array.isArray(area.items) && area.items.length > 0;
          const hasAreaNotes = area.notes && typeof area.notes === "string" && area.notes.trim() !== "";

          if (hasItems || hasAreaNotes) {
            const areaName = area.area_name || "";
            const bedOption = area.bed_option || "";
            const areaNote = area.notes || "";

            // If area has items, add each item as a row
            if (hasItems && area.items.length > 0) {
              area.items.forEach((item) => {
                excelData.push([
                  areaName,
                  bedOption,
                  areaNote,
                  item.name || "",
                  item.category || "",
                  item.is_applicable ? "Yes" : "No",
                  item.item_notes || "",
                ]);
              });
            } else {
              // If area only has notes but no items, add one row with area info
              excelData.push([
                areaName,
                bedOption,
                areaNote,
                "",
                "",
                "",
                "",
              ]);
            }
          }
        });
      }

      // Add heights section if any height values exist
      const hasHeights =
        versionData.ceiling_height ||
        versionData.bulkhead_height ||
        versionData.kicker_height ||
        versionData.cabinetry_height;

      if (hasHeights) {
        excelData.push([]); // Empty row
        excelData.push(["Heights"]); // Header
        excelData.push(["Ceiling Height (mm)", versionData.ceiling_height || ""]);
        excelData.push([
          "Bulkhead Height (mm)",
          versionData.bulkhead_height || "",
        ]);
        excelData.push(["Kicker Height (mm)", versionData.kicker_height || ""]);
        excelData.push([
          "Cabinetry Height (mm)",
          versionData.cabinetry_height || "",
        ]);
      }

      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(excelData);

      // Set column widths
      ws["!cols"] = [
        { wch: 20 }, // Area Name
        { wch: 15 }, // Bed Option
        { wch: 30 }, // Area Notes
        { wch: 25 }, // Item Name
        { wch: 15 }, // Category
        { wch: 12 }, // Applicable
        { wch: 40 }, // Item Notes
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Material Selection");

      // Get version number for filename
      const versionNumber =
        versionsList.find((v) => v.id === selectedVersionId)?.version_number ||
        "1";

      // Generate filename
      const filename = `Material_Selection_V${versionNumber}_${new Date()
        .toISOString()
        .split("T")[0]}.xlsx`;

      // Export file
      XLSX.writeFile(wb, filename);

      toast.success("Material selection exported to Excel successfully!", {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export to Excel. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

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

        {/* Create/Update Button and Export Button */}
        <div className="flex justify-end gap-3">
          {/* Export Button - Show when version is selected */}
          {materialSelectionData && selectedVersionId && (
            <button
              onClick={handleExportToExcel}
              disabled={!selectedVersionId}
              className="cursor-pointer hover:bg-green-600 flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
          )}
          {/* Create/Update Button - Only show for current version or when no material selection exists */}
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
              const isCustomArea = customAreas[sectionKey] !== undefined;
              const bedConfig = isBedTab ? bedTabs[sectionKey] : null;
              // Show plus button only on the last bed tab
              const isLastBedTab =
                isBedTab &&
                (index === array.length - 1 ||
                  !array[index + 1]?.startsWith("Bed"));
              // Allow removing bed tabs except the first "Bed" tab
              const canRemoveBedTab =
                isBedTab &&
                sectionKey !== "Bed" &&
                (isCurrentVersion || !materialSelectionData);
              // Allow removing custom areas
              const canRemoveCustomArea =
                isCustomArea && (isCurrentVersion || !materialSelectionData);
              const applicableCount = getApplicableCount(sectionKey);

              // Get display name for custom areas
              const displayName = isCustomArea
                ? customAreas[sectionKey]?.name || sectionKey
                : sectionKey;

              return (
                <div key={sectionKey} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab(sectionKey)}
                    className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === sectionKey
                      ? "border-secondary text-secondary"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                      }`}
                  >
                    {displayName}
                    {applicableCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-secondary/20 text-secondary rounded-full text-xs font-semibold">
                        {applicableCount}
                      </span>
                    )}
                  </button>
                  {canRemoveBedTab && (
                    <button
                      onClick={() => handleRemoveBedTab(sectionKey)}
                      disabled={!isCurrentVersion && materialSelectionData}
                      className="cursor-pointer p-1 hover:bg-red-100 rounded transition-colors text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove this bed tab"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {canRemoveCustomArea && (
                    <button
                      onClick={() => handleRemoveCustomArea(sectionKey)}
                      disabled={!isCurrentVersion && materialSelectionData}
                      className="cursor-pointer p-1 hover:bg-red-100 rounded transition-colors text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove this custom area"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {isLastBedTab &&
                    (isCurrentVersion || !materialSelectionData) && (
                      <button
                        onClick={handleAddBedTab}
                        disabled={!isCurrentVersion && materialSelectionData}
                        className="cursor-pointer p-1 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Add another bed tab"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                </div>
              );
            })}
            {/* Add Custom Area Button - After all tabs */}
            {(isCurrentVersion || !materialSelectionData) && (
              <button
                onClick={handleAddCustomArea}
                disabled={!isCurrentVersion && materialSelectionData}
                className="cursor-pointer p-1 hover:bg-slate-100 rounded transition-colors text-slate-600 hover:text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                title="Add custom area"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {allTabs.map((sectionKey) => {
          if (activeTab !== sectionKey) return null;

          const sectionItems = getSectionItems(sectionKey);
          const isBedTab = sectionKey.startsWith("Bed");
          const isCustomArea = customAreas[sectionKey] !== undefined;
          const bedConfig = isBedTab ? bedTabs[sectionKey] : null;

          return (
            <div
              key={sectionKey}
              className="border border-slate-200 rounded-lg bg-white mt-4"
            >
              <div className="p-4">
                {/* Custom Area Name Input - Show for custom areas */}
                {isCustomArea && (isCurrentVersion || !materialSelectionData) && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Custom Area Name
                    </label>
                    <input
                      type="text"
                      value={customAreas[sectionKey]?.name ?? ""}
                      onChange={(e) => {
                        // Allow empty string during typing
                        const newName = e.target.value;
                        setCustomAreas((prev) => {
                          if (prev[sectionKey]) {
                            return {
                              ...prev,
                              [sectionKey]: {
                                ...prev[sectionKey],
                                name: newName,
                              },
                            };
                          }
                          return prev;
                        });
                      }}
                      onBlur={(e) => {
                        const newName = e.target.value.trim();

                        if (newName && newName !== sectionKey) {
                          handleRenameCustomArea(sectionKey, newName);
                        } else if (!newName) {
                          // Use originalNumber from customAreas for default value
                          const originalNumber = customAreas[sectionKey]?.originalNumber || "1";
                          const defaultValue = `Custom Area ${originalNumber}`;

                          // Set to default value if empty
                          if (defaultValue !== sectionKey) {
                            handleRenameCustomArea(sectionKey, defaultValue);
                          } else {
                            // Just update the display name if it's already the default
                            setCustomAreas((prev) => {
                              if (prev[sectionKey]) {
                                return {
                                  ...prev,
                                  [sectionKey]: {
                                    ...prev[sectionKey],
                                    name: defaultValue,
                                  },
                                };
                              }
                              return prev;
                            });
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.target.blur();
                        }
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
                      placeholder="Enter custom area name..."
                    />
                  </div>
                )}

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
                        className={`cursor-pointer px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${bedConfig?.option === "WIR"
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
                        className={`cursor-pointer px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${bedConfig?.option === "BIR"
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
                        className={`cursor-pointer px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 hover:text-secondary hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${bedConfig?.option === "Both"
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
                      {isCustomArea ? (
                        // Custom areas - show only custom items (no predefined items)
                        (customItems[sectionKey] || [])
                          .filter((item) => !item.category)
                          .map((customItem) => {
                            const itemKey = getItemKey(customItem.name, null);
                            const isApplicable =
                              applicableItems[sectionKey]?.[itemKey] || false;
                            const noteValue =
                              notes[sectionKey]?.[itemKey] || "";

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
                                      className="cursor-pointer p-2 hover:bg-red-100 text-red-600 rounded-md transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Remove this item"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <label
                                    className={`flex items-center gap-2 ${!isCurrentVersion &&
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
                                          e.target.checked,
                                          null
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
                                        e.target.value,
                                        null
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
                          })
                      ) : sectionKey.startsWith("Bed") &&
                        Array.isArray(sectionItems) &&
                        sectionItems[0]?.category ? (
                        // Bed tabs with grouped items by category
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
                                const itemKey = getItemKey(itemName, group.category);
                                const isApplicable =
                                  applicableItems[sectionKey]?.[itemKey] ||
                                  false;
                                const noteValue =
                                  notes[sectionKey]?.[itemKey] || "";

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
                                        className={`flex items-center gap-2 ${!isCurrentVersion &&
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
                                              e.target.checked,
                                              group.category
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
                                            e.target.value,
                                            group.category
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
                                const itemKey = getItemKey(customItem.name, customItem.category);
                                const isApplicable =
                                  applicableItems[sectionKey]?.[itemKey] || false;
                                const noteValue =
                                  notes[sectionKey]?.[itemKey] || "";

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
                                          className="cursor-pointer p-2 hover:bg-red-100 text-red-600 rounded-md transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                          title="Remove this item"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <label
                                        className={`flex items-center gap-2 ${!isCurrentVersion &&
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
                                              e.target.checked,
                                              customItem.category
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
                                            e.target.value,
                                            customItem.category
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
                      ) : (
                        // Regular tabs with simple array of items
                        Array.isArray(sectionItems) &&
                        sectionItems.map((itemName, index) => {
                          const itemKey = getItemKey(itemName, null);
                          const isApplicable =
                            applicableItems[sectionKey]?.[itemKey] || false;
                          const noteValue =
                            notes[sectionKey]?.[itemKey] || "";

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
                                  className={`flex items-center gap-2 ${!isCurrentVersion && materialSelectionData
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
                                        e.target.checked,
                                        null
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
                                      e.target.value,
                                      null
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
                        })

                      )}
                      {!sectionKey.startsWith("Bed") && !isCustomArea &&
                        customItems[sectionKey]
                          ?.filter((item) => !item.category)
                          .map((customItem) => {
                            const itemKey = getItemKey(customItem.name, null);
                            const isApplicable =
                              applicableItems[sectionKey]?.[itemKey] || false;
                            const noteValue =
                              notes[sectionKey]?.[itemKey] || "";

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
                                      className="cursor-pointer p-2 hover:bg-red-100 text-red-600 rounded-md transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Remove this item"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <label
                                    className={`flex items-center gap-2 ${!isCurrentVersion && materialSelectionData
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
                                          e.target.checked,
                                          null
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
                                        e.target.value,
                                        null
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
