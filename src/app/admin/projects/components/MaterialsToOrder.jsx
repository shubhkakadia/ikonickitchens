import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Package,
  Trash,
  Download,
  Check,
  X,
  File,
  FileUp,
  FileText,
  ChevronDown,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ViewMedia from "./ViewMedia";

export default function MaterialsToOrder({ project, selectedLot }) {
  const { getToken, userData } = useAuth();

  const [categoryItems, setCategoryItems] = useState({
    sheet: [{}],
    handle: [{}],
    hardware: [{}],
    accessory: [{}],
    edging_tape: [{}],
  });
  const [searchResults, setSearchResults] = useState({
    sheet: [],
    handle: [],
    hardware: [],
    accessory: [],
    edging_tape: [],
  });
  // Use object with keys like "category-rowIndex" instead of arrays
  const [searchTerms, setSearchTerms] = useState({});
  const [showSearchDropdown, setShowSearchDropdown] = useState({
    sheet: {},
    handle: {},
    hardware: {},
    accessory: {},
    edging_tape: {},
  });
  const [itemCache, setItemCache] = useState({});
  const [selectedLots, setSelectedLots] = useState([]);
  const [materialsToOrderData, setMaterialsToOrderData] = useState(null);
  const [notes, setNotes] = useState("");
  const [currentMtoId, setCurrentMtoId] = useState(null); // Track current MTO ID for editing
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null); // {category, rowIndex}
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [deletingMediaId, setDeletingMediaId] = useState(null);
  const fileInputRef = useRef(null);
  const [expandedSections, setExpandedSections] = useState({
    images: false,
    videos: false,
    pdfs: false,
    others: false,
  });
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle', 'saving', 'saved', 'error'
  const autoSaveTimerRef = useRef(null);
  // Snapshot of the last saved/loaded state to compare against for changes
  const dataSnapshotRef = useRef({
    categoryItems: {
      sheet: [{}],
      handle: [{}],
      hardware: [{}],
      accessory: [{}],
      edging_tape: [{}],
    },
    notes: "",
    selectedLots: [],
  });
  // State to track loading and initialization status
  const [loadingState, setLoadingState] = useState({
    isUpdatingFromApi: false,
    isInitialized: false,
  });
  // Track previous materialsToOrderData ID to detect when it changes from API
  const prevMaterialsToOrderDataIdRef = useRef(null);

  // Helper function to create a normalized snapshot from current state
  const createSnapshot = (categoryItemsData, notesData, selectedLotsData) => {
    // Normalize categoryItems - only include items with data, sorted by item_id for comparison
    const normalizedCategoryItems = {};
    Object.keys(categoryItemsData).forEach((category) => {
      normalizedCategoryItems[category] = categoryItemsData[category]
        .filter((row) => row.item && row.quantity)
        .map((row) => ({
          item_id: row.item.item_id || row.item.id,
          quantity: parseInt(row.quantity) || 1,
          notes: row.notes || null,
        }))
        .sort((a, b) => a.item_id - b.item_id);
    });

    // Normalize selectedLots - sort by lot_id for comparison
    const normalizedSelectedLots = (selectedLotsData || [])
      .map((lot) => lot.lot_id)
      .sort();

    return {
      categoryItems: normalizedCategoryItems,
      notes: (notesData || "").trim(),
      selectedLots: normalizedSelectedLots,
    };
  };

  // Helper function to compare two snapshots
  const hasDataChanged = (snapshot1, snapshot2) => {
    // Compare notes
    if (snapshot1.notes !== snapshot2.notes) {
      return true;
    }

    // Compare selectedLots
    if (
      JSON.stringify(snapshot1.selectedLots) !==
      JSON.stringify(snapshot2.selectedLots)
    ) {
      return true;
    }

    // Compare categoryItems
    const categories = [
      "sheet",
      "handle",
      "hardware",
      "accessory",
      "edging_tape",
    ];
    for (const category of categories) {
      const items1 = snapshot1.categoryItems[category] || [];
      const items2 = snapshot2.categoryItems[category] || [];

      if (items1.length !== items2.length) {
        return true;
      }

      // Compare each item
      for (let i = 0; i < items1.length; i++) {
        const item1 = items1[i];
        const item2 = items2[i];

        if (
          item1.item_id !== item2.item_id ||
          item1.quantity !== item2.quantity ||
          (item1.notes || "") !== (item2.notes || "")
        ) {
          return true;
        }
      }
    }

    return false;
  };

  // Memoize: Get all lots that have MTOs created (from all MTOs in the project)
  const lotsWithExistingMto = useMemo(() => {
    if (!project?.materials_to_order) return new Set();

    const allLotsWithMto = new Set();
    project.materials_to_order.forEach((mto) => {
      if (mto.lots) {
        mto.lots.forEach((lot) => {
          allLotsWithMto.add(lot.lot_id);
        });
      }
    });

    return allLotsWithMto;
  }, [project?.materials_to_order]);

  // Memoize: Compute lots available for selection: only those without existing MTO
  const selectableLots = useMemo(() => {
    return (project?.lots || []).filter((lot) => {
      // Allow selection only for lots that do not yet have MTO entries
      return !lotsWithExistingMto.has(lot.lot_id);
    });
  }, [project?.lots, lotsWithExistingMto]);

  // Memoize: Check if selected lots have existing MTO
  const selectedLotHasExistingMto = useMemo(() => {
    return (
      selectedLots &&
      selectedLots.length > 0 &&
      selectedLots.some((lot) => lotsWithExistingMto.has(lot.lot_id))
    );
  }, [selectedLots, lotsWithExistingMto]);

  // Memoize: Get all lots that share the same MTO ID as the current MTO
  const lotsWithSameMtoId = useMemo(() => {
    if (!materialsToOrderData || !project?.materials_to_order) return [];

    const currentMtoId = materialsToOrderData.id;
    const mtoWithSameId = project.materials_to_order.find(
      (mto) => mto.id === currentMtoId
    );

    return mtoWithSameId?.lots || [];
  }, [materialsToOrderData, project?.materials_to_order]);

  // Initialize selected lots when project data is loaded or selectedLot changes
  useEffect(() => {
    if (project?.lots && project.lots.length > 0 && selectedLot) {
      setSelectedLots([selectedLot]);
    }
  }, [project, selectedLot]);

  // Ensure notes shown correspond to the currently selected lot(s)
  useEffect(() => {
    if (!materialsToOrderData) {
      setNotes("");
      return;
    }

    // Check if any selected lot has existing MTO
    const selectedLotIds = new Set(
      (selectedLots || []).map((lot) => lot.lot_id)
    );
    const mtoLotIds = new Set(
      (materialsToOrderData.lots || []).map((lot) => lot.lot_id)
    );

    const anySelectedLotHasMto =
      selectedLotIds.size > 0 &&
      Array.from(selectedLotIds).some((lotId) => mtoLotIds.has(lotId));

    if (anySelectedLotHasMto) {
      setNotes(materialsToOrderData.notes || "");
    } else {
      // Clear notes when selected lot(s) have no existing MTO
      setNotes("");
    }
  }, [materialsToOrderData, selectedLots]);

  // Helper to build category items based on MTO data and selected lots
  const buildCategoryItemsFromMto = (mtoData, lots) => {
    const allowedLotIds = new Set((lots || []).map((l) => l.lot_id));

    const newCategoryItems = {
      sheet: [{}],
      handle: [{}],
      hardware: [{}],
      accessory: [{}],
      edging_tape: [{}],
    };

    if (mtoData?.items && mtoData.items.length > 0) {
      // Check if any of the MTO's lots match the selected lots
      const mtoLotIds = new Set((mtoData.lots || []).map((lot) => lot.lot_id));
      const hasMatchingLots =
        allowedLotIds.size === 0 ||
        Array.from(allowedLotIds).some((lotId) => mtoLotIds.has(lotId));

      if (hasMatchingLots) {
        mtoData.items.forEach((mtoItem) => {
          const category = mtoItem.item?.category?.toLowerCase();
          if (
            category &&
            (category === "sheet" ||
              category === "handle" ||
              category === "hardware" ||
              category === "accessory" ||
              category === "edging_tape")
          ) {
            const currentItems = newCategoryItems[category];
            const emptyRowIndex = currentItems.findIndex((row) => !row.item);

            const itemData = {
              item: mtoItem.item,
              quantity: mtoItem.quantity,
              notes: mtoItem.notes,
              mtoItemId: mtoItem.id,
            };

            if (emptyRowIndex !== -1) {
              newCategoryItems[category][emptyRowIndex] = itemData;
            } else {
              newCategoryItems[category].push(itemData);
            }
          }
        });

        // Always ensure one empty row exists for each category
        Object.keys(newCategoryItems).forEach((category) => {
          if (!newCategoryItems[category].some((row) => !row.item)) {
            newCategoryItems[category].push({});
          }
        });
      }
    }

    return newCategoryItems;
  };

  // Fetch existing materials to order when component loads
  useEffect(() => {
    const fetchMaterialsToOrder = async () => {
      if (
        !project?.materials_to_order ||
        project.materials_to_order.length === 0 ||
        !selectedLots ||
        selectedLots.length === 0
      ) {
        // No MTO exists, initialize snapshot with empty state
        setLoadingState({ isUpdatingFromApi: true, isInitialized: false });
        dataSnapshotRef.current = createSnapshot(
          {
            sheet: [{}],
            handle: [{}],
            hardware: [{}],
            accessory: [{}],
            edging_tape: [{}],
          },
          "",
          selectedLots || []
        );
        // Reset flag after initialization
        setTimeout(() => {
          setLoadingState({ isUpdatingFromApi: false, isInitialized: true });
        }, 100);
        return;
      }

      // Find MTO that contains any of the selected lots
      const selectedLotIds = new Set(selectedLots.map((lot) => lot.lot_id));
      const relevantMto = project.materials_to_order.find(
        (mto) =>
          mto.lots && mto.lots.some((lot) => selectedLotIds.has(lot.lot_id))
      );

      if (!relevantMto) {
        // No MTO found, initialize snapshot with empty state
        setLoadingState({ isUpdatingFromApi: true, isInitialized: false });
        dataSnapshotRef.current = createSnapshot(
          {
            sheet: [{}],
            handle: [{}],
            hardware: [{}],
            accessory: [{}],
            edging_tape: [{}],
          },
          "",
          selectedLots
        );
        // Reset flag after initialization
        setTimeout(() => {
          setLoadingState({ isUpdatingFromApi: false, isInitialized: true });
        }, 100);
        return;
      }

      try {
        const sessionToken = getToken();
        const response = await axios.get(
          `/api/materials_to_order/${relevantMto.id}`,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );

        if (response.data.status) {
          const mtoData = response.data.data;
          const loadedCategoryItems = buildCategoryItemsFromMto(
            mtoData,
            selectedLots
          );

          // Set flag to prevent auto-save during API update
          setLoadingState({ isUpdatingFromApi: true, isInitialized: false });

          // Update snapshot FIRST with loaded data (before state updates)
          dataSnapshotRef.current = createSnapshot(
            loadedCategoryItems,
            mtoData?.notes || "",
            selectedLots
          );

          // Then update state
          setMaterialsToOrderData(mtoData);
          setNotes(mtoData?.notes || "");
          setCategoryItems(loadedCategoryItems);
          setCurrentMtoId(relevantMto.id); // Store the MTO ID for editing
          setMediaFiles(mtoData?.media || []);

          // Reset flag after a brief delay to allow state updates to complete
          setTimeout(() => {
            setLoadingState({ isUpdatingFromApi: false, isInitialized: true });
          }, 100);
        }
      } catch (error) {
        console.error("Error fetching materials to order:", error);
        toast.error("Failed to load existing materials to order");
        setLoadingState((prev) => ({ ...prev, isInitialized: true }));
      }
    };

    fetchMaterialsToOrder();
  }, [project, selectedLots, getToken]);

  // Re-filter displayed items when selected lots change or when MTO data loads
  useEffect(() => {
    // Check if materialsToOrderData ID changed (API load) vs just selectedLots changed (user action)
    const currentDataId = materialsToOrderData?.id || null;
    const isDataLoad = prevMaterialsToOrderDataIdRef.current !== currentDataId;
    prevMaterialsToOrderDataIdRef.current = currentDataId;

    if (materialsToOrderData) {
      // Always filter by selected lots, even for existing MTO
      const filteredCategoryItems = buildCategoryItemsFromMto(
        materialsToOrderData,
        selectedLots
      );

      // Only update snapshot when data is loaded from API (to prevent auto-save)
      // Don't update snapshot when selectedLots changes due to user action
      if (isDataLoad) {
        setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: true }));
        dataSnapshotRef.current = createSnapshot(
          filteredCategoryItems,
          materialsToOrderData?.notes || "",
          selectedLots
        );
      }

      // Update state
      setCategoryItems(filteredCategoryItems);

      // Reset flag after state updates complete (only if it was set)
      if (isDataLoad) {
        setTimeout(() => {
          setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: false }));
        }, 100);
      }
    }
  }, [materialsToOrderData, selectedLots]);

  // Auto-save with debounce when user makes changes
  useEffect(() => {
    // Skip auto-save if:
    // 1. We're currently updating from API
    // 2. Component hasn't been initialized yet
    if (loadingState.isUpdatingFromApi || !loadingState.isInitialized) {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Create current snapshot
    const currentSnapshot = createSnapshot(categoryItems, notes, selectedLots);

    // Compare with saved snapshot to detect user changes
    const dataChanged = hasDataChanged(
      dataSnapshotRef.current,
      currentSnapshot
    );

    // Only auto-save if data has actually changed
    if (!dataChanged) {
      return;
    }

    // Check if there are items to save (for new MTO creation)
    const hasItemsToSave = Object.values(categoryItems).some((rows) =>
      rows.some((row) => row.item && row.quantity)
    );

    // For new MTO, need items and selected lots
    // For existing MTO, just need changes
    if (
      !currentMtoId &&
      (!hasItemsToSave || !selectedLots || selectedLots.length === 0)
    ) {
      return;
    }

    // Set debounce timer (2 seconds)
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveMaterials(true); // Silent auto-save
    }, 2000);

    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [categoryItems, notes, selectedLots, currentMtoId, loadingState]); // Watch for changes in these

  // Materials to Order form functions
  const handleLotToggle = (lot) => {
    setSelectedLots((prev) => {
      const isSelected = prev.some((l) => l.lot_id === lot.lot_id);
      if (isSelected) {
        return prev.filter((l) => l.lot_id !== lot.lot_id);
      } else {
        return [...prev, lot];
      }
    });
  };

  const searchItems = async (category, searchTerm, rowIndex) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setSearchResults((prev) => ({
        ...prev,
        [category]: [],
      }));
      setShowSearchDropdown((prev) => ({
        ...prev,
        [category]: { ...prev[category], [rowIndex]: false },
      }));
      return;
    }

    try {
      const cacheKey = `${category}_${searchTerm.toLowerCase()}`;

      // Check cache first
      if (itemCache[cacheKey]) {
        setSearchResults((prev) => ({
          ...prev,
          [category]: itemCache[cacheKey],
        }));
        setShowSearchDropdown((prev) => ({
          ...prev,
          [category]: { ...prev[category], [rowIndex]: true },
        }));
        return;
      }

      const sessionToken = getToken();
      const response = await axios.get(`/api/item/all/${category}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        let items = response.data.data || [];

        // Filter items based on search term
        const filteredItems = items.filter((item) => {
          const term = searchTerm.toLowerCase();
          return (
            item.description?.toLowerCase().includes(term) ||
            item.sheet?.color?.toLowerCase().includes(term) ||
            item.sheet?.brand?.toLowerCase().includes(term) ||
            item.handle?.color?.toLowerCase().includes(term) ||
            item.handle?.brand?.toLowerCase().includes(term) ||
            item.handle?.type?.toLowerCase().includes(term) ||
            item.hardware?.name?.toLowerCase().includes(term) ||
            item.hardware?.brand?.toLowerCase().includes(term) ||
            item.hardware?.type?.toLowerCase().includes(term) ||
            item.accessory?.name?.toLowerCase().includes(term) ||
            item.edging_tape?.color?.toLowerCase().includes(term) ||
            item.edging_tape?.brand?.toLowerCase().includes(term) ||
            item.edging_tape?.finish?.toLowerCase().includes(term)
          );
        });

        // Update cache
        setItemCache((prev) => ({
          ...prev,
          [cacheKey]: filteredItems,
        }));

        setSearchResults((prev) => ({
          ...prev,
          [category]: filteredItems,
        }));

        setShowSearchDropdown((prev) => ({
          ...prev,
          [category]: { ...prev[category], [rowIndex]: true },
        }));
      }
    } catch (error) {
      console.error("Error searching items:", error);
      setSearchResults((prev) => ({
        ...prev,
        [category]: [],
      }));
    }
  };

  // Helper function to generate search term key
  const getSearchTermKey = (category, rowIndex) => `${category}-${rowIndex}`;

  const handleSearchChange = (category, rowIndex, value) => {
    const key = getSearchTermKey(category, rowIndex);
    setSearchTerms((prev) => ({
      ...prev,
      [key]: value,
    }));
    searchItems(category, value, rowIndex);
  };

  const handleItemSelect = (category, rowIndex, item) => {
    setCategoryItems((prev) => {
      const updatedItems = [...prev[category]];
      updatedItems[rowIndex] = { item, quantity: 1 };

      // Add empty row if none exists
      if (!updatedItems.some((row) => !row.item)) {
        updatedItems.push({});
      }

      return { ...prev, [category]: updatedItems };
    });

    // Clear the search term for the selected row
    const key = getSearchTermKey(category, rowIndex);
    setSearchTerms((prev) => {
      const updated = { ...prev };
      updated[key] = "";
      return updated;
    });

    setShowSearchDropdown((prev) => ({
      ...prev,
      [category]: { ...prev[category], [rowIndex]: false },
    }));
  };

  const handleQuantityChange = (category, rowIndex, quantity) => {
    setCategoryItems((prev) => ({
      ...prev,
      [category]: prev[category].map((row, idx) =>
        idx === rowIndex ? { ...row, quantity: parseInt(quantity) || 1 } : row
      ),
    }));
  };

  const removeItemRow = (category, rowIndex) => {
    // Check if this is the last item across all categories
    const totalItemsWithData = Object.values(categoryItems).reduce(
      (total, rows) => {
        return total + rows.filter((row) => row.item && row.quantity).length;
      },
      0
    );

    // If this is the last item and we have an existing MTO, show confirmation
    if (totalItemsWithData === 1 && currentMtoId) {
      setPendingDeleteRow({ category, rowIndex });
      setShowDeleteConfirm(true);
      return;
    }

    // Otherwise, proceed with normal deletion
    performItemDeletion(category, rowIndex);
  };

  const performItemDeletion = (category, rowIndex) => {
    setCategoryItems((prev) => {
      const updatedItems = prev[category].filter((_, idx) => idx !== rowIndex);

      // Always ensure one empty row exists
      if (!updatedItems.some((row) => !row.item)) {
        updatedItems.push({});
      }

      return {
        ...prev,
        [category]: updatedItems,
      };
    });

    // Remove search term for deleted row and shift subsequent rows
    setSearchTerms((prev) => {
      const updated = { ...prev };
      const deletedKey = getSearchTermKey(category, rowIndex);

      // Remove the deleted row's search term
      delete updated[deletedKey];

      // Shift search terms for rows after the deleted row
      // After deletion, row at index rowIndex+1 becomes rowIndex, etc.
      const currentItemsLength = categoryItems[category].length;
      for (let i = rowIndex + 1; i < currentItemsLength; i++) {
        const oldKey = getSearchTermKey(category, i);
        const newKey = getSearchTermKey(category, i - 1);
        if (updated[oldKey] !== undefined) {
          updated[newKey] = updated[oldKey];
          delete updated[oldKey];
        }
      }

      return updated;
    });

    setShowSearchDropdown((prev) => ({
      ...prev,
      [category]: Object.keys(prev[category]).reduce((acc, key) => {
        if (parseInt(key) !== rowIndex) {
          acc[key] = prev[category][key];
        }
        return acc;
      }, {}),
    }));
  };

  const hasItems = useMemo(
    () =>
      Object.values(categoryItems).some((rows) =>
        rows.some((row) => row.item && row.quantity)
      ),
    [categoryItems]
  );

  const isItemAlreadySelected = (category, item) => {
    return categoryItems[category].some((row) => {
      if (!row.item) return false;
      const storedItem = row.item;
      const itemId = storedItem.id || storedItem.item_id;
      const searchItemId = item.id || item.item_id;
      return itemId === searchItemId;
    });
  };

  const getFilteredSearchResults = useCallback(
    (category) => {
      return searchResults[category].filter(
        (item) => !isItemAlreadySelected(category, item)
      );
    },
    [searchResults, categoryItems]
  ); // Add proper dependencies

  const handleExportToExcel = () => {
    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined || value === "") return "";
      const stringValue = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Create workbook data
    const categories = [
      "sheet",
      "handle",
      "hardware",
      "accessory",
      "edging_tape",
    ];
    const categoryNames = {
      sheet: "Sheet",
      handle: "Handle",
      hardware: "Hardware",
      accessory: "Accessory",
      edging_tape: "Edging Tape",
    };

    let csvContent =
      "Category,Brand,Color,Type,Material,Finish,Name,Sub Category,Dimensions,Unit,Quantity\n";

    categories.forEach((category) => {
      const items = categoryItems[category];
      items.forEach((row) => {
        if (row.item && row.quantity) {
          const item = row.item;
          const fields = [];

          fields.push(escapeCSV(categoryNames[category]));

          // Category-specific fields
          if (category === "sheet" && item.sheet) {
            fields.push(escapeCSV(item.sheet.brand || ""));
            fields.push(escapeCSV(item.sheet.color || ""));
            fields.push(""); // Type (empty for sheet)
            fields.push(""); // Material (empty for sheet)
            fields.push(escapeCSV(item.sheet.finish || ""));
            fields.push(""); // Name (empty for sheet)
            fields.push(""); // Sub Category (empty for sheet)
            fields.push(escapeCSV(item.sheet.dimensions || ""));
          } else if (category === "handle" && item.handle) {
            fields.push(escapeCSV(item.handle.brand || ""));
            fields.push(escapeCSV(item.handle.color || ""));
            fields.push(escapeCSV(item.handle.type || ""));
            fields.push(escapeCSV(item.handle.material || ""));
            fields.push(""); // Finish (empty for handle)
            fields.push(""); // Name (empty for handle)
            fields.push(""); // Sub Category (empty for handle)
            fields.push(escapeCSV(item.handle.dimensions || ""));
          } else if (category === "hardware" && item.hardware) {
            fields.push(escapeCSV(item.hardware.brand || ""));
            fields.push(""); // Color (empty for hardware)
            fields.push(""); // Type (empty for hardware)
            fields.push(""); // Material (empty for hardware)
            fields.push(""); // Finish (empty for hardware)
            fields.push(escapeCSV(item.hardware.name || ""));
            fields.push(escapeCSV(item.hardware.sub_category || ""));
            fields.push(escapeCSV(item.hardware.dimensions || ""));
          } else if (category === "accessory" && item.accessory) {
            fields.push(""); // Brand (empty for accessory)
            fields.push(""); // Color (empty for accessory)
            fields.push(""); // Type (empty for accessory)
            fields.push(""); // Material (empty for accessory)
            fields.push(""); // Finish (empty for accessory)
            fields.push(escapeCSV(item.accessory.name || ""));
            fields.push(""); // Sub Category (empty for accessory)
            fields.push(""); // Dimensions (empty for accessory)
          } else if (category === "edging_tape" && item.edging_tape) {
            fields.push(escapeCSV(item.edging_tape.brand || ""));
            fields.push(escapeCSV(item.edging_tape.color || ""));
            fields.push(""); // Type (empty for edging_tape)
            fields.push(""); // Material (empty for edging_tape)
            fields.push(escapeCSV(item.edging_tape.finish || ""));
            fields.push(""); // Name (empty for edging_tape)
            fields.push(""); // Sub Category (empty for edging_tape)
            fields.push(escapeCSV(item.edging_tape.dimensions || ""));
          } else {
            // Unknown category, add empty fields
            for (let i = 0; i < 8; i++) fields.push("");
          }

          fields.push(escapeCSV(item.measurement_unit || ""));
          fields.push(escapeCSV(row.quantity || ""));

          csvContent += fields.join(",") + "\n";
        }
      });
    });

    // Create blob and download
    try {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `materials_to_order_${Date.now()}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Materials exported successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export materials. Please try again.");
    }
  };

  const handleDeleteMaterials = async () => {
    setIsDeleting(true);
    try {
      if (!currentMtoId) {
        toast.error("No materials to order to delete.");
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }

      // If we have a pending delete row, delete the item first
      if (pendingDeleteRow) {
        performItemDeletion(
          pendingDeleteRow.category,
          pendingDeleteRow.rowIndex
        );
      }

      const sessionToken = getToken();
      const response = await axios.delete(
        `/api/materials_to_order/${currentMtoId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Materials to order deleted successfully!");
        // Reset state
        setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: true }));
        const resetSelectedLots = selectedLot ? [selectedLot] : [];
        setCategoryItems({
          sheet: [{}],
          handle: [{}],
          hardware: [{}],
          accessory: [{}],
          edging_tape: [{}],
        });
        setNotes("");
        setMaterialsToOrderData(null);
        setCurrentMtoId(null);
        setSelectedLots(resetSelectedLots);
        // Update snapshot
        dataSnapshotRef.current = createSnapshot(
          {
            sheet: [{}],
            handle: [{}],
            hardware: [{}],
            accessory: [{}],
            edging_tape: [{}],
          },
          "",
          resetSelectedLots
        );
        setTimeout(() => {
          setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: false }));
        }, 50);
      } else {
        toast.error(
          response.data.message || "Failed to delete materials to order."
        );
      }
    } catch (error) {
      console.error("Error deleting materials:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to delete materials to order. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setPendingDeleteRow(null);
    }
  };

  // Auto-save function (without toast notifications)
  const autoSaveMaterials = async (silent = true) => {
    try {
      // Check if there are items to save
      if (!hasItems) {
        return;
      }

      // Check if project has an ID
      if (!project?.project_id) {
        return;
      }

      // Check if we have selected lots (for new MTO)
      if (!currentMtoId && (!selectedLots || selectedLots.length === 0)) {
        return;
      }

      setSaveStatus("saving");

      // Collect all items from all categories
      const items = [];
      Object.keys(categoryItems).forEach((category) => {
        categoryItems[category].forEach((row) => {
          if (row.item && row.quantity) {
            items.push({
              item_id: row.item.item_id,
              quantity: parseInt(row.quantity) || 1,
              notes: row.notes || null,
            });
          }
        });
      });

      const sessionToken = getToken();

      // Check if we're editing an existing MTO or creating a new one
      if (currentMtoId) {
        // Editing existing MTO - use PATCH
        const requestData = {
          notes: notes || null,
          items: items,
        };

        const response = await axios.patch(
          `/api/materials_to_order/${currentMtoId}`,
          requestData,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status) {
          if (!silent) {
            toast.success("Materials to order updated successfully!");
          }
          // Update the local state with the updated data
          setMaterialsToOrderData(response.data.data);
          setMediaFiles(response.data.data?.media || []);

          // Update snapshot after successful save
          setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: true }));
          dataSnapshotRef.current = createSnapshot(
            categoryItems,
            notes,
            selectedLots
          );
          setTimeout(() => {
            setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: false }));
          }, 50);

          setSaveStatus("saved");

          // Reset to idle after 2 seconds
          setTimeout(() => {
            setSaveStatus("idle");
          }, 2000);
        } else {
          setSaveStatus("error");
          if (!silent) {
            toast.error(
              response.data.message || "Failed to update materials to order."
            );
          }
          setTimeout(() => {
            setSaveStatus("idle");
          }, 3000);
        }
      } else {
        // Creating new MTO - use POST
        const createdBy_id = userData?.user?.id || null;
        const requestData = {
          project_id: project.project_id,
          notes: notes || null,
          createdBy_id: createdBy_id,
          lot_ids: selectedLots.map((lot) => lot.lot_id),
          items: items,
        };

        const response = await axios.post(
          "/api/materials_to_order/create",
          requestData,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status) {
          if (!silent) {
            toast.success("Materials to order created successfully!");
          }
          // Store the new MTO ID for future edits
          setCurrentMtoId(response.data.data.id);
          setMediaFiles(response.data.data?.media || []);

          // Update snapshot after successful save
          setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: true }));
          dataSnapshotRef.current = createSnapshot(
            categoryItems,
            notes,
            selectedLots
          );
          setTimeout(() => {
            setLoadingState((prev) => ({ ...prev, isUpdatingFromApi: false }));
          }, 50);

          setSaveStatus("saved");

          // Reset to idle after 2 seconds
          setTimeout(() => {
            setSaveStatus("idle");
          }, 2000);
        } else {
          setSaveStatus("error");
          if (!silent) {
            toast.error(
              response.data.message || "Failed to create materials to order."
            );
          }
          setTimeout(() => {
            setSaveStatus("idle");
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Error saving materials:", error);
      setSaveStatus("error");
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to save materials to order. Please try again.";
      if (!silent) {
        toast.error(errorMessage);
      }
      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    }
  };

  const handleSaveMaterials = async () => {
    await autoSaveMaterials(false); // Not silent, show toasts
  };

  // Handle file selection - upload immediately
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Upload files immediately
    await handleUploadMedia(files);

    // Reset the input so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove file from selection
  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload media files
  const handleUploadMedia = async (filesToUpload = null) => {
    const files = filesToUpload || selectedFiles;

    if (!currentMtoId) {
      toast.warning(
        "Please save the materials to order first before uploading files."
      );
      return;
    }

    if (!files || files.length === 0) {
      toast.warning("Please select files to upload.");
      return;
    }

    setUploadingMedia(true);
    try {
      const sessionToken = getToken();
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await axios.post(
        `/api/uploads/materials-to-order/${currentMtoId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status) {
        toast.success(response.data.message || "Files uploaded successfully!");
        // Refresh media files
        const mtoResponse = await axios.get(
          `/api/materials_to_order/${currentMtoId}`,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        if (mtoResponse.data.status) {
          setMediaFiles(mtoResponse.data.data?.media || []);
          setMaterialsToOrderData(mtoResponse.data.data);
        }
        setSelectedFiles([]);
      } else {
        toast.error(response.data.message || "Failed to upload files.");
      }
    } catch (error) {
      console.error("Error uploading media:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to upload files. Please try again.";
      toast.error(errorMessage);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Delete media file
  const handleDeleteMedia = async (mediaId) => {
    if (!currentMtoId) {
      toast.error("Cannot delete media. MTO ID is missing.");
      return;
    }

    setDeletingMediaId(mediaId);
    try {
      const sessionToken = getToken();
      const response = await axios.delete(
        `/api/uploads/materials-to-order/${currentMtoId}?mediaId=${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("File deleted successfully!");
        // Remove from local state
        setMediaFiles((prev) => prev.filter((media) => media.id !== mediaId));
        // Refresh MTO data
        const mtoResponse = await axios.get(
          `/api/materials_to_order/${currentMtoId}`,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          }
        );
        if (mtoResponse.data.status) {
          setMaterialsToOrderData(mtoResponse.data.data);
        }
      } else {
        toast.error(response.data.message || "Failed to delete file.");
      }
    } catch (error) {
      console.error("Error deleting media:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to delete file. Please try again.";
      toast.error(errorMessage);
    } finally {
      setDeletingMediaId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // View existing file from server
  const handleViewExistingFile = (file) => {
    const fileUrl = `/${file.url}`;
    setSelectedFile({
      name: file.filename,
      type: file.mime_type,
      size: file.size || 0,
      url: fileUrl,
      isExisting: true,
    });
    setViewFileModal(true);
  };

  return (
    <div>
      {/* Auto-save Status Indicator */}
      {saveStatus !== "idle" && (
        <div
          className={`mb-4 px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-all duration-200 ${
            saveStatus === "saving"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : saveStatus === "saved"
              ? "bg-green-50 text-green-700 border border-green-200"
              : saveStatus === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : ""
          }`}
        >
          {saveStatus === "saving" && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="w-4 h-4" />
              <span>Saved!</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <X className="w-4 h-4" />
              <span>Failed to save. Please try again.</span>
            </>
          )}
        </div>
      )}

      {/* Title and Action Buttons */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          Materials to Order
        </h2>
        <div className="flex gap-3">
          {currentMtoId && (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                <Trash className="w-4 h-4" />
                Delete Materials to Order
              </button>
              <button
                onClick={handleExportToExcel}
                disabled={!hasItems}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lot Selection or Existing MTO Info */}
      {project?.lots && project.lots.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
          {!selectedLotHasExistingMto ? (
            // Show lot selection for new MTO
            <>
              <h3 className="text-md font-semibold text-slate-700 mb-3">
                Select Lots
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectableLots.map((lot) => (
                  <label
                    key={lot.id}
                    className="flex items-center space-x-2 p-2 cursor-pointer hover:bg-slate-100 rounded-md"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLots.some(
                        (l) => l.lot_id === lot.lot_id
                      )}
                      onChange={() => handleLotToggle(lot)}
                      className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-secondary"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700">
                        {lot.lot_id}
                      </span>
                      {lot.name && (
                        <p className="text-xs text-slate-500">{lot.name}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {selectedLots.length} lot(s) selected
              </p>
            </>
          ) : (
            // Show existing MTO info
            <>
              <h3 className="text-md font-semibold text-slate-700 mb-3">
                Materials List Already Created
              </h3>
              <div className="space-y-2">
                <p className="text-sm text-slate-600 mb-3">
                  This materials list is already created for the following lots:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lotsWithSameMtoId.map((lot) => (
                    <div
                      key={lot.lot_id}
                      className="flex items-center space-x-2 p-2 bg-white rounded-md border border-slate-200"
                    >
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <span className="text-sm font-medium text-slate-700">
                          {lot.lot_id}
                        </span>
                        {lot.name && (
                          <p className="text-xs text-slate-500">{lot.name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {lotsWithSameMtoId.length} lot(s) in this materials list
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Category Sections - Non-Collapsible */}
      <div className="space-y-6">
        {/* Sheet Section */}
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">
                Sheet
              </span>
              {categoryItems.sheet.filter((row) => row.item && row.quantity)
                .length > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-secondary bg-secondary/10 rounded-full">
                  {
                    categoryItems.sheet.filter(
                      (row) => row.item && row.quantity
                    ).length
                  }
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {categoryItems.sheet.filter((row) => row.item && row.quantity)
              .length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Image
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Brand
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Color
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Finish
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Dimensions
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Unit
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Quantity
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.sheet.map(
                      (row, rowIndex) =>
                        row.item && (
                          <tr
                            key={rowIndex}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-2 px-3">
                              {row.item.image ? (
                                <div className="relative w-12 h-12 rounded overflow-hidden bg-slate-100">
                                  <Image
                                    src={`/${row.item.image}`}
                                    alt={row.item.item_id}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.sheet?.brand || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.sheet?.color || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.sheet?.finish || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.sheet?.dimensions || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.measurement_unit || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    "sheet",
                                    rowIndex,
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-secondary"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() => removeItemRow("sheet", rowIndex)}
                                className="cursor-pointer text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Search - Always Visible */}
            <div className="mt-4">
              {categoryItems.sheet.map(
                (row, rowIndex) =>
                  !row.item && (
                    <div key={rowIndex} className="relative">
                      <input
                        type="text"
                        value={
                          searchTerms[getSearchTermKey("sheet", rowIndex)] || ""
                        }
                        onChange={(e) =>
                          handleSearchChange("sheet", rowIndex, e.target.value)
                        }
                        onFocus={() =>
                          searchItems(
                            "sheet",
                            searchTerms[getSearchTermKey("sheet", rowIndex)] ||
                              "",
                            rowIndex
                          )
                        }
                        placeholder="Search for sheet items..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      />
                      {showSearchDropdown.sheet?.[rowIndex] && (
                        <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto w-full">
                          {getFilteredSearchResults("sheet").length > 0 ? (
                            getFilteredSearchResults("sheet").map((item) => (
                              <button
                                key={item.item_id}
                                onClick={() =>
                                  handleItemSelect("sheet", rowIndex, item)
                                }
                                className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {item.image ? (
                                    <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                                      <Image
                                        src={`/${item.image}`}
                                        alt={item.item_id}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 flex-shrink-0 rounded-md bg-slate-100 flex items-center justify-center">
                                      <Package className="w-6 h-6 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-800 mb-1">
                                      {item.sheet?.brand || "N/A"} -{" "}
                                      {item.sheet?.color || "N/A"} -{" "}
                                      {item.sheet?.finish || "N/A"} -{" "}
                                      {item.sheet?.dimensions || "N/A"}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-slate-600">
                              <div className="mb-2">No results found</div>
                              <div className="text-xs">
                                Item may have already been added or does not
                                exist. Please add it to inventory first.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>

        {/* Edging Tape Section */}
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">
                Edging Tape
              </span>
              {categoryItems.edging_tape.filter(
                (row) => row.item && row.quantity
              ).length > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-secondary bg-secondary/10 rounded-full">
                  {
                    categoryItems.edging_tape.filter(
                      (row) => row.item && row.quantity
                    ).length
                  }
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {categoryItems.edging_tape.filter((row) => row.item && row.quantity)
              .length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Image
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Brand
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Color
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Finish
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Dimensions
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Unit
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Quantity
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.edging_tape.map(
                      (row, rowIndex) =>
                        row.item && (
                          <tr
                            key={rowIndex}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-2 px-3">
                              {row.item.image ? (
                                <div className="relative w-12 h-12 rounded overflow-hidden bg-slate-100">
                                  <Image
                                    src={`/${row.item.image}`}
                                    alt={row.item.item_id}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.edging_tape?.brand || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.edging_tape?.color || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.edging_tape?.finish || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.edging_tape?.dimensions || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.measurement_unit || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    "edging_tape",
                                    rowIndex,
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-secondary"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() =>
                                  removeItemRow("edging_tape", rowIndex)
                                }
                                className="cursor-pointer text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add New Item Input */}
            <div className="space-y-2">
              {categoryItems.edging_tape.map(
                (row, rowIndex) =>
                  !row.item && (
                    <div key={rowIndex} className="relative">
                      <input
                        type="text"
                        value={
                          searchTerms[
                            getSearchTermKey("edging_tape", rowIndex)
                          ] || ""
                        }
                        onChange={(e) =>
                          handleSearchChange(
                            "edging_tape",
                            rowIndex,
                            e.target.value
                          )
                        }
                        onFocus={() =>
                          searchItems(
                            "edging_tape",
                            searchTerms[
                              getSearchTermKey("edging_tape", rowIndex)
                            ] || "",
                            rowIndex
                          )
                        }
                        placeholder="Search for edging tape items..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      />
                      {showSearchDropdown.edging_tape?.[rowIndex] && (
                        <div className="absolute mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto w-full">
                          {getFilteredSearchResults("edging_tape").length >
                          0 ? (
                            getFilteredSearchResults("edging_tape").map(
                              (item) => (
                                <button
                                  key={item.item_id}
                                  onClick={() =>
                                    handleItemSelect(
                                      "edging_tape",
                                      rowIndex,
                                      item
                                    )
                                  }
                                  className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    {item.image ? (
                                      <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                                        <Image
                                          src={`/${item.image}`}
                                          alt={item.item_id}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 flex-shrink-0 rounded-md bg-slate-100 flex items-center justify-center">
                                        <Package className="w-6 h-6 text-slate-400" />
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <div className="text-sm font-semibold text-slate-800 mb-1">
                                        {item.edging_tape?.brand || "N/A"} -{" "}
                                        {item.edging_tape?.color || "N/A"} -{" "}
                                        {item.edging_tape?.finish || "N/A"} -{" "}
                                        {item.edging_tape?.dimensions || "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              )
                            )
                          ) : (
                            <div className="p-4 text-center text-sm text-slate-600">
                              <div className="mb-2">No results found</div>
                              <div className="text-xs">
                                Item may have already been added or does not
                                exist. Please add it to inventory first.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>

        {/* Handle Section */}
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">
                Handle
              </span>
              {categoryItems.handle.filter((row) => row.item && row.quantity)
                .length > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-secondary bg-secondary/10 rounded-full">
                  {
                    categoryItems.handle.filter(
                      (row) => row.item && row.quantity
                    ).length
                  }
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {categoryItems.handle.filter((row) => row.item && row.quantity)
              .length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Image
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Brand
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Color
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Type
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Material
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Dimensions
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Unit
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Quantity
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.handle.map(
                      (row, rowIndex) =>
                        row.item && (
                          <tr
                            key={rowIndex}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-2 px-3">
                              {row.item.image ? (
                                <div className="relative w-12 h-12 rounded overflow-hidden bg-slate-100">
                                  <Image
                                    src={`/${row.item.image}`}
                                    alt={row.item.item_id}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.handle?.brand || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.handle?.color || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.handle?.type || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.handle?.material || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.handle?.dimensions || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.measurement_unit || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    "handle",
                                    rowIndex,
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-secondary"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() =>
                                  removeItemRow("handle", rowIndex)
                                }
                                className="cursor-pointer text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add New Item Input */}
            <div className="space-y-2">
              {categoryItems.handle.map(
                (row, rowIndex) =>
                  !row.item && (
                    <div key={rowIndex} className="relative">
                      <input
                        type="text"
                        value={
                          searchTerms[getSearchTermKey("handle", rowIndex)] ||
                          ""
                        }
                        onChange={(e) =>
                          handleSearchChange("handle", rowIndex, e.target.value)
                        }
                        onFocus={() =>
                          searchItems(
                            "handle",
                            searchTerms[getSearchTermKey("handle", rowIndex)] ||
                              "",
                            rowIndex
                          )
                        }
                        placeholder="Search for handle items..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      />
                      {showSearchDropdown.handle?.[rowIndex] && (
                        <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto w-full">
                          {getFilteredSearchResults("handle").length > 0 ? (
                            getFilteredSearchResults("handle").map((item) => (
                              <button
                                key={item.item_id}
                                onClick={() =>
                                  handleItemSelect("handle", rowIndex, item)
                                }
                                className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {item.image ? (
                                    <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                                      <Image
                                        src={`/${item.image}`}
                                        alt={item.item_id}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 flex-shrink-0 rounded-md bg-slate-100 flex items-center justify-center">
                                      <Package className="w-6 h-6 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-800 mb-1">
                                      {item.handle?.brand || "N/A"} -{" "}
                                      {item.handle?.color || "N/A"} -{" "}
                                      {item.handle?.type || "N/A"} -{" "}
                                      {item.handle?.dimensions || "N/A"}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-slate-600">
                              <div className="mb-2">No results found</div>
                              <div className="text-xs">
                                Item may have already been added or does not
                                exist. Please add it to inventory first.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>

        {/* Hardware Section */}
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">
                Hardware
              </span>
              {categoryItems.hardware.filter((row) => row.item && row.quantity)
                .length > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-secondary bg-secondary/10 rounded-full">
                  {
                    categoryItems.hardware.filter(
                      (row) => row.item && row.quantity
                    ).length
                  }
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {categoryItems.hardware.filter((row) => row.item && row.quantity)
              .length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Image
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Brand
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Name
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Sub Category
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Dimensions
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Unit
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Quantity
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.hardware.map(
                      (row, rowIndex) =>
                        row.item && (
                          <tr
                            key={rowIndex}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-2 px-3">
                              {row.item.image ? (
                                <div className="relative w-12 h-12 rounded overflow-hidden bg-slate-100">
                                  <Image
                                    src={`/${row.item.image}`}
                                    alt={row.item.item_id}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.hardware?.brand || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.hardware?.name || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.hardware?.sub_category || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.hardware?.dimensions || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.measurement_unit || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    "hardware",
                                    rowIndex,
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-secondary"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() =>
                                  removeItemRow("hardware", rowIndex)
                                }
                                className="cursor-pointer text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add New Item Input */}
            <div className="space-y-2">
              {categoryItems.hardware.map(
                (row, rowIndex) =>
                  !row.item && (
                    <div key={rowIndex} className="relative">
                      <input
                        type="text"
                        value={
                          searchTerms[getSearchTermKey("hardware", rowIndex)] ||
                          ""
                        }
                        onChange={(e) =>
                          handleSearchChange(
                            "hardware",
                            rowIndex,
                            e.target.value
                          )
                        }
                        onFocus={() =>
                          searchItems(
                            "hardware",
                            searchTerms[
                              getSearchTermKey("hardware", rowIndex)
                            ] || "",
                            rowIndex
                          )
                        }
                        placeholder="Search for hardware items..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      />
                      {showSearchDropdown.hardware?.[rowIndex] && (
                        <div className="absolute mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto w-full">
                          {getFilteredSearchResults("hardware").length > 0 ? (
                            getFilteredSearchResults("hardware").map((item) => (
                              <button
                                key={item.item_id}
                                onClick={() =>
                                  handleItemSelect("hardware", rowIndex, item)
                                }
                                className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {item.image ? (
                                    <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                                      <Image
                                        src={`/${item.image}`}
                                        alt={item.item_id}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 flex-shrink-0 rounded-md bg-slate-100 flex items-center justify-center">
                                      <Package className="w-6 h-6 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="text-sm font-semibold text-slate-800 mb-1">
                                      {item.hardware?.brand || "N/A"} -{" "}
                                      {item.hardware?.name || "N/A"} -{" "}
                                      {item.hardware?.sub_category || "N/A"} -{" "}
                                      {item.hardware?.dimensions || "N/A"}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-sm text-slate-600">
                              <div className="mb-2">No results found</div>
                              <div className="text-xs">
                                Item may have already been added or does not
                                exist. Please add it to inventory first.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>

        {/* Accessory Section */}
        <div className="border border-slate-200 rounded-lg bg-white">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-700">
                Accessory
              </span>
              {categoryItems.accessory.filter((row) => row.item && row.quantity)
                .length > 0 && (
                <span className="px-2 py-1 text-xs font-medium text-secondary bg-secondary/10 rounded-full">
                  {
                    categoryItems.accessory.filter(
                      (row) => row.item && row.quantity
                    ).length
                  }
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            {categoryItems.accessory.filter((row) => row.item && row.quantity)
              .length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Image
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Name
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Unit
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Quantity
                      </th>
                      <th className="text-left py-2 px-3 text-slate-600 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryItems.accessory.map(
                      (row, rowIndex) =>
                        row.item && (
                          <tr
                            key={rowIndex}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-2 px-3">
                              {row.item.image ? (
                                <div className="relative w-12 h-12 rounded overflow-hidden bg-slate-100">
                                  <Image
                                    src={`/${row.item.image}`}
                                    alt={row.item.item_id}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.accessory?.name || "-"}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {row.item.measurement_unit || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="1"
                                value={row.quantity || 1}
                                onChange={(e) =>
                                  handleQuantityChange(
                                    "accessory",
                                    rowIndex,
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-secondary"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <button
                                onClick={() =>
                                  removeItemRow("accessory", rowIndex)
                                }
                                className="cursor-pointer text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add New Item Input */}
            <div className="space-y-2">
              {categoryItems.accessory.map(
                (row, rowIndex) =>
                  !row.item && (
                    <div key={rowIndex} className="relative">
                      <input
                        type="text"
                        value={
                          searchTerms[
                            getSearchTermKey("accessory", rowIndex)
                          ] || ""
                        }
                        onChange={(e) =>
                          handleSearchChange(
                            "accessory",
                            rowIndex,
                            e.target.value
                          )
                        }
                        onFocus={() =>
                          searchItems(
                            "accessory",
                            searchTerms[
                              getSearchTermKey("accessory", rowIndex)
                            ] || "",
                            rowIndex
                          )
                        }
                        placeholder="Search for accessory items..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary"
                      />
                      {showSearchDropdown.accessory?.[rowIndex] && (
                        <div className="absolute mt-1 z-10 bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto w-full">
                          {getFilteredSearchResults("accessory").length > 0 ? (
                            getFilteredSearchResults("accessory").map(
                              (item) => (
                                <button
                                  key={item.item_id}
                                  onClick={() =>
                                    handleItemSelect(
                                      "accessory",
                                      rowIndex,
                                      item
                                    )
                                  }
                                  className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    {item.image ? (
                                      <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-slate-100">
                                        <Image
                                          src={`/${item.image}`}
                                          alt={item.item_id}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 flex-shrink-0 rounded-md bg-slate-100 flex items-center justify-center">
                                        <Package className="w-6 h-6 text-slate-400" />
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <div className="text-sm font-semibold text-slate-800 mb-1">
                                        {item.accessory?.name || "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              )
                            )
                          ) : (
                            <div className="p-4 text-center text-sm text-slate-600">
                              <div className="mb-2">No results found</div>
                              <div className="text-xs">
                                Item may have already been added or does not
                                exist. Please add it to inventory first.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Media Upload Section */}
      {currentMtoId && (
        <div className="mt-6">
          {/* Display Existing Files First */}
          {(() => {
            // Categorize files by type
            const categorizeFiles = () => {
              const images = [];
              const videos = [];
              const pdfs = [];
              const others = [];

              mediaFiles.forEach((file) => {
                if (
                  file.mime_type?.includes("image") ||
                  file.file_type === "image"
                ) {
                  images.push(file);
                } else if (
                  file.mime_type?.includes("video") ||
                  file.file_type === "video"
                ) {
                  videos.push(file);
                } else if (
                  file.mime_type?.includes("pdf") ||
                  file.file_type === "pdf" ||
                  file.extension === "pdf"
                ) {
                  pdfs.push(file);
                } else {
                  others.push(file);
                }
              });

              return { images, videos, pdfs, others };
            };

            const { images, videos, pdfs, others } = categorizeFiles();

            const toggleSection = (section) => {
              setExpandedSections((prev) => ({
                ...prev,
                [section]: !prev[section],
              }));
            };

            // File Category Section Component
            const FileCategorySection = ({
              title,
              files,
              isSmall = false,
              sectionKey,
            }) => {
              if (files.length === 0) return null;

              const isExpanded = expandedSections[sectionKey];

              return (
                <div className="mb-4">
                  {/* Category Header with Toggle */}
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-slate-900 transition-colors"
                  >
                    <span>
                      {title} ({files.length})
                    </span>
                    <div
                      className={`transform transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="flex flex-wrap gap-3">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => handleViewExistingFile(file)}
                          title="Click to view file"
                          className={`cursor-pointer relative bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all group ${
                            isSmall ? "w-32" : "w-40"
                          }`}
                        >
                          {/* File Preview */}
                          <div
                            className={`w-full ${
                              isSmall ? "aspect-[4/3]" : "aspect-square"
                            } rounded-lg flex items-center justify-center mb-2 overflow-hidden bg-slate-50`}
                          >
                            {file.mime_type?.includes("image") ||
                            file.file_type === "image" ? (
                              <Image
                                height={100}
                                width={100}
                                src={`/${file.url}`}
                                alt={file.filename}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : file.mime_type?.includes("video") ||
                              file.file_type === "video" ? (
                              <video
                                src={`/${file.url}`}
                                className="w-full h-full object-cover rounded-lg"
                                muted
                                playsInline
                              />
                            ) : (
                              <div
                                className={`w-full h-full flex items-center justify-center rounded-lg ${
                                  file.mime_type?.includes("pdf") ||
                                  file.file_type === "pdf" ||
                                  file.extension === "pdf"
                                    ? "bg-red-50"
                                    : "bg-green-50"
                                }`}
                              >
                                {file.mime_type?.includes("pdf") ||
                                file.file_type === "pdf" ||
                                file.extension === "pdf" ? (
                                  <FileText
                                    className={`${
                                      isSmall ? "w-6 h-6" : "w-8 h-8"
                                    } text-red-600`}
                                  />
                                ) : (
                                  <File
                                    className={`${
                                      isSmall ? "w-6 h-6" : "w-8 h-8"
                                    } text-green-600`}
                                  />
                                )}
                              </div>
                            )}
                          </div>

                          {/* File Info */}
                          <div className="space-y-1">
                            <p
                              className="text-xs font-medium text-slate-700 truncate"
                              title={file.filename}
                            >
                              {file.filename}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatFileSize(file.size || 0)}
                            </p>
                          </div>

                          {/* Delete Button */}
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMedia(file.id);
                              }}
                              disabled={deletingMediaId === file.id}
                              className="p-1.5 cursor-pointer bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                              title="Delete file"
                            >
                              {deletingMediaId === file.id ? (
                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                              ) : (
                                <Trash className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">
                  Uploaded Files
                </h3>

                {mediaFiles.length > 0 ? (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    {/* Images Section */}
                    <FileCategorySection
                      title="Images"
                      files={images}
                      isSmall={false}
                      sectionKey="images"
                    />

                    {/* Videos Section */}
                    <FileCategorySection
                      title="Videos"
                      files={videos}
                      isSmall={false}
                      sectionKey="videos"
                    />

                    {/* PDFs Section - Smaller cards */}
                    <FileCategorySection
                      title="PDFs"
                      files={pdfs}
                      isSmall={true}
                      sectionKey="pdfs"
                    />

                    {/* Other Files Section - Smaller cards */}
                    <FileCategorySection
                      title="Other Files"
                      files={others}
                      isSmall={true}
                      sectionKey="others"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-8 border border-slate-200 text-center">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600">No files uploaded yet</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Upload New Files Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700">
              Upload New Files
            </h3>

            {/* File Upload Area */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Select Files {uploadingMedia && "(Uploading...)"}
              </label>
              <div
                className={`border-2 border-dashed border-slate-300 hover:border-secondary rounded-lg transition-all duration-200 bg-slate-50 hover:bg-slate-100 ${
                  uploadingMedia ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.dwg,.jpg,.jpeg,.png,.mp4,.mov,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={uploadingMedia}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  {uploadingMedia ? (
                    <>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-3"></div>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Uploading files...
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                        <FileUp className="w-6 h-6 text-secondary" />
                      </div>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-slate-500">
                        PDF, DWG, JPG, PNG, MP4, MOV, DOC, or DOCX
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes related to this materials to order..."
          rows="4"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary bg-white"
        />
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPendingDeleteRow(null);
        }}
        onConfirm={handleDeleteMaterials}
        deleteWithInput={true}
        heading="Materials to Order"
        comparingName={project?.project_id || ""}
        isDeleting={isDeleting}
        message={
          <div>
            {pendingDeleteRow ? (
              <>
                <p className="mb-2">
                  This is the last item in the materials list. Removing it will
                  delete the entire materials to order list which is linked with
                  the following lots:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {materialsToOrderData?.lots?.map((lot) => (
                    <li key={lot.lot_id} className="text-sm">
                      {lot.lot_id} {lot.name && `- ${lot.name}`}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Please type the project number to confirm deletion.
                </p>
              </>
            ) : (
              <>
                <p className="mb-2">
                  This materials to order list will be deleted and it's linked
                  with the following lots:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {materialsToOrderData?.lots?.map((lot) => (
                    <li key={lot.lot_id} className="text-sm">
                      {lot.lot_id} {lot.name && `- ${lot.name}`}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Please type the project number to confirm deletion.
                </p>
              </>
            )}
          </div>
        }
      />

      {/* File View Modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
        />
      )}
    </div>
  );
}
