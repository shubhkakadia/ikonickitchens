export const stages = [
  "Quotation",
  "Quote Approval",
  "Purchase Order",
  "Material Appliances Selection",
  "Drafting",
  "Drafting Revision",
  "Final Design Approval",
  "Site Measurements",
  "Final Approval for Production",
  "Machining Out",
  "Material Order",
  "CNC",
  "Assembly",
  "Delivery",
  "Installation",
  "Invoice Sent",
  "Maintenance",
  "Job Completion",
];

export const tabs = [
  { id: "overview", label: "Overview" },
  { id: "architecture_drawings", label: "Architecture Drawings" },
  { id: "appliances_specifications", label: "Appliances and Specifications" },
  { id: "material_selection", label: "Material Selection" },
  { id: "cabinetry_drawings", label: "Cabinetry Drawings" },
  { id: "changes_to_do", label: "Changes to Do" },
  { id: "site_measurements", label: "Site Measurements" },
  { id: "materials_to_order", label: "Materials to Order" },
  { id: "site_photos", label: "Site Photos" },
  { id: "finished_site_photos", label: "Finished Site Photos" },
];

export const hardwareSubCategories = [
  "Legs with plates",
  "Hinges",
  "Hinge Plates",
  "Screws",
  "Hangin Rode",
  "Hanging Rode Support & Ends",
  "Cutlery Tray",
  "Bin",
  "Drawer set (Runners)",
  "Screw Caps (White & Color)",
  "Plastic Wraps",
  "Shelf Support",
  "LED",
];

export const roleOptions = [
  "Administrator",
  "Site Manager",
  "Supervisor",
  "Employee",
  "Contractor",
  "CNC Operator",
  "Installer",
];

export const deletionWarning = {
  users: [
    "module_access",
    "sessions",
    "logs",
    "material_selection",
    "materials_to_order",
    "purchase_order",
  ],

  employees: ["users", "stage_employee", "lot"],

  client: ["contact", "project"],

  project: ["lot", "material_selection", "materials_to_order"],

  lot: ["lot_tab", "stage", "material_selection"],

  stage: ["stage_employee"],

  lot_tab: ["lot_file"],

  lot_file: ["maintenance_checklist"],

  quote: ["material_selection", "material_selection_versions"],

  material_selection: ["material_selection_versions"],

  material_selection_versions: ["material_selection_version_area"],

  material_selection_version_area: ["material_selection_version_area_item"],

  supplier: ["contact", "item", "purchase_order", "supplier_statement"],

  supplier_statement: ["supplier_file"],

  materials_to_order: [
    "lot",
    "materials_to_order_item",
    "media",
    "purchase_order",
    "stock_transaction",
  ],

  materials_to_order_item: ["purchase_order_item"],

  purchase_order: ["purchase_order_item", "stock_transaction"],

  item: [
    "sheet",
    "handle",
    "hardware",
    "accessory",
    "edging_tape",
    "materials_to_order_item",
    "purchase_order_item",
    "stock_transaction",
  ],

  media: ["materials_to_order", "employees", "item"],
};
