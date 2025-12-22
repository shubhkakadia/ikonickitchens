# Admin Review: Repeating Code Candidates

## Scope
- Reviewed routes and files under `src/app/admin`.
- Looked for repeated layout, list views, forms, and modal patterns in admin pages and nearby admin components.

## Admin routes (App Router)
- /admin -> `src/app/admin/page.jsx`
- /admin/login -> `src/app/admin/login/page.jsx`
- /admin/dashboard -> `src/app/admin/dashboard/page.jsx`
- /admin/clients -> `src/app/admin/clients/page.jsx`
- /admin/clients/addclient -> `src/app/admin/clients/addclient/page.jsx`
- /admin/clients/[id] -> `src/app/admin/clients/[id]/page.jsx`
- /admin/employees -> `src/app/admin/employees/page.jsx`
- /admin/employees/addemployee -> `src/app/admin/employees/addemployee/page.jsx`
- /admin/employees/[id] -> `src/app/admin/employees/[id]/page.jsx`
- /admin/projects -> `src/app/admin/projects/page.jsx`
- /admin/projects/addproject -> `src/app/admin/projects/addproject/page.jsx`
- /admin/projects/lotatglance -> `src/app/admin/projects/lotatglance/page.jsx`
- /admin/projects/[id] -> `src/app/admin/projects/[id]/page.jsx`
- /admin/inventory -> `src/app/admin/inventory/page.jsx`
- /admin/inventory/additem -> `src/app/admin/inventory/additem/page.jsx`
- /admin/inventory/usedmaterial -> `src/app/admin/inventory/usedmaterial/page.jsx`
- /admin/inventory/[id] -> `src/app/admin/inventory/[id]/page.jsx`
- /admin/deletefiles -> `src/app/admin/deletefiles/page.jsx`
- /admin/logs -> `src/app/admin/logs/page.jsx`
- /admin/settings -> `src/app/admin/settings/page.jsx`
- /admin/config -> `src/app/admin/config/page.jsx`
- /admin/site_photos -> `src/app/admin/site_photos/page.jsx`
- /admin/suppliers -> `src/app/admin/suppliers/page.jsx`
- /admin/suppliers/addsupplier -> `src/app/admin/suppliers/addsupplier/page.jsx`
- /admin/suppliers/[id] -> `src/app/admin/suppliers/[id]/page.jsx`
- /admin/suppliers/materialstoorder -> `src/app/admin/suppliers/materialstoorder/page.jsx`
- /admin/suppliers/purchaseorder -> `src/app/admin/suppliers/purchaseorder/page.jsx`
- /admin/suppliers/statements -> `src/app/admin/suppliers/statements/page.jsx`

## Repeating patterns with component candidates

### 1) Admin shell layout
- Pattern: `<AdminRoute>` + sidebar + CRM tabs + `flex h-screen bg-tertiary` shell.
- Seen in: `src/app/admin/page.jsx`, `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/deletefiles/page.jsx`, `src/app/admin/settings/page.jsx`, `src/app/admin/config/page.jsx`, plus add/edit pages.
- Candidate: `AdminShell` component or move to `src/app/admin/layout.jsx` and render children inside.

### 2) Loading, error, and empty states
- Pattern: full-height spinner + error block with `AlertTriangle` + retry button; empty state rows in tables.
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/suppliers/page.jsx`, `src/app/admin/deletefiles/page.jsx`, `src/app/admin/suppliers/statements/page.jsx`.
- Candidate: `PageState` components (`LoadingState`, `ErrorState`, `EmptyState`).

### 3) List page header with action
- Pattern: page title + action button (often via `TabsController`).
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/suppliers/page.jsx`.
- Candidate: `ListHeader` component with slots for title and actions.

### 4) List toolbar (search + filters + sort + reset + export)
- Pattern: fixed header section with search input (icon + input), filter dropdowns, sort dropdown, reset button, export button + column picker.
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/suppliers/page.jsx`, `src/app/admin/deletefiles/page.jsx`, `src/app/admin/suppliers/statements/page.jsx`, `src/app/admin/suppliers/purchaseorder/page.jsx`, `src/app/admin/suppliers/materialstoorder/page.jsx`, `src/app/admin/projects/lotatglance/page.jsx`.
- Candidate: `ListToolbar` plus small components:
  - `SearchInput`
  - `MultiSelectFilterDropdown`
  - `SortDropdown`
  - `ResetButton`
  - `ExportButton` + `ColumnPicker`

### 5) Click-outside dropdown handling
- Pattern: `dropdown-container` + `document.addEventListener("mousedown")` to close dropdowns.
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/suppliers/page.jsx`, `src/app/admin/deletefiles/page.jsx`.
- Candidate: `useClickOutside` hook and `Dropdown` wrapper.

### 6) Tables with sticky header
- Pattern: sticky `thead`, scrollable body, row hover, row click to detail page.
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/suppliers/page.jsx`, `src/app/admin/suppliers/statements/page.jsx`.
- Candidate: `DataTable` component with `renderRow` and `renderHeader` props.

### 7) Pagination wiring around `PaginationFooter`
- Pattern: `itemsPerPage`/`currentPage` state, slice logic, and `PaginationFooter` props.
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/suppliers/page.jsx`, `src/app/admin/suppliers/statements/page.jsx`.
- Candidate: `usePagination` hook that returns `paginatedItems`, `totalPages`, `pageState` setters.

### 8) Export to Excel
- Pattern: dynamic `xlsx` import, column map, widths, date-based filename, success/error toasts.
- Seen in: `src/app/admin/clients/page.jsx`, `src/app/admin/employees/page.jsx`, `src/app/admin/logs/page.jsx`, `src/app/admin/projects/page.jsx`, `src/app/admin/inventory/page.jsx`, `src/app/admin/suppliers/page.jsx`, `src/app/admin/suppliers/materialstoorder/page.jsx`, `src/app/admin/suppliers/purchaseorder/page.jsx`, `src/app/admin/suppliers/statements/page.jsx`, `src/app/admin/projects/lotatglance/page.jsx`.
- Candidate: `useExcelExport` hook or `ExportToExcelButton` component with column config.

### 9) Searchable select with create-new
- Pattern: search input + dropdown list + create-new modal for missing option.
- Seen in: `src/app/admin/employees/addemployee/page.jsx`, `src/app/admin/employees/[id]/page.jsx`, `src/app/admin/inventory/additem/page.jsx`.
- Candidate: `SearchableSelect` with `allowCreate`, `onCreate`, and `CreateValueModal` reuse.

### 10) File upload widgets
- Pattern A: single image upload with preview, remove, and `useUploadProgress` integration.
- Seen in: `src/app/admin/employees/addemployee/page.jsx`, `src/app/admin/employees/[id]/page.jsx`, `src/app/admin/inventory/additem/page.jsx`, `src/app/admin/inventory/[id]/page.jsx`, `src/app/admin/suppliers/purchaseorder/components/AddItemModal.jsx`.
- Pattern B: multi-file upload sections with "Select Files" area and upload state.
- Seen in: `src/app/admin/projects/components/FileUploadSection.jsx`, `src/app/admin/projects/components/SiteMeasurement.jsx`, `src/app/admin/projects/components/MaterialsToOrder.jsx`, `src/app/admin/suppliers/components/MaterialsToOrder.jsx`, `src/app/admin/suppliers/materialstoorder/page.jsx`, `src/app/admin/site_photos/page.jsx`.
- Candidate: `ImageUploadField` and general `FileUploadSection` component (reused in multiple places).

### 11) Modal shell
- Pattern: fixed overlay + card container + header with title and close button + action footer.
- Seen in: `src/app/admin/employees/addemployee/page.jsx`, `src/app/admin/suppliers/statements/page.jsx`, `src/app/admin/suppliers/purchaseorder/components/CreatePurchaseOrderModal.jsx`, `src/app/admin/suppliers/purchaseorder/components/AddItemModal.jsx`, `src/app/admin/suppliers/materialstoorder/components/CreateMaterialsToOrderModal.jsx`.
- Candidate: `Modal`, `ModalHeader`, and `ModalFooter` components.

### 12) Auth + axios request boilerplate
- Pattern: `getToken()` guard, axios config with Authorization header, toast error handling, loading state.
- Seen in most list and detail pages across `src/app/admin/**/page.jsx`.
- Candidate: `useAuthedRequest` hook or `apiClient` wrapper to centralize headers and error handling.

## Suggested extraction order (low risk to higher risk)
1. Admin shell layout (`src/app/admin/layout.jsx` or `AdminShell` component)
2. `useClickOutside` hook + dropdown wrapper
3. List toolbar components (search, filters, sort, reset)
4. `usePagination` hook
5. Excel export hook
6. Modal shell components
7. Form section + field primitives
8. File upload components
