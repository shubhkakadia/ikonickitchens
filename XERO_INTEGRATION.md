# Xero Integration Plan

This document outlines the strategy for integrating Xero accounting software into the Ikoniq Kitchen and Cabinet application.

**Generated:** 2025-11-12

---

## 1. Architecture & Strategy

The integration will connect the application to the Xero API using OAuth 2.0 for authentication. The primary goal is to synchronize key financial entities between the local database and Xero.

- **Authentication**: An OAuth 2.0 flow will be implemented to authorize the application to access a Xero organization's data. Access tokens, refresh tokens, and the tenant ID will be stored securely in the new `XeroConnection` table.
- **Data Sync**: The integration will focus on a two-way reference system. Local records (clients, suppliers, purchase orders) will store the corresponding Xero record ID. This allows for updates and reconciliation.
- **Synchronization Points**:
    - **Contacts**: `Clients` and `Suppliers` in the local DB will be synced with `Contacts` in Xero.
    - **Bills**: `PurchaseOrder` records will be synced as `Bills` (a type of invoice) in Xero.
    - **Sales Invoices**: A new `Invoice` model will be created to represent sales invoices sent to clients, which will be synced with `Invoices` in Xero.
    - **Bank Transactions**: Bank transactions will be fetched from Xero and stored locally to power financial dashboards and reconciliation views.

---

## 2. Admin Finance Module Structure

The existing `/admin/finance` page should be redesigned to become the central hub for all Xero-related activities. It should feature a tabbed or sectioned layout.

### Proposed Structure for `/admin/finance`

1.  **Dashboard/Overview Tab:**
    *   **Connection Status:** Display whether the app is connected to Xero, the organization name, and a "Disconnect" button. If not connected, this area should show a "Connect to Xero" button to initiate the OAuth flow.
    *   **Key Metrics:** Show high-level metrics fetched from Xero:
        *   Bank Balances (from reconciled bank transactions).
        *   Total Accounts Receivable (from open sales invoices).
        *   Total Accounts Payable (from open bills/purchase orders).
    *   **Sync Status:** A summary of the last sync time and the number of synced/unsynced records.

2.  **Bank Transactions Tab:**
    *   A data table listing all bank transactions fetched from Xero, populated from the new `BankTransaction` model.
    *   Columns: Date, Contact, Reference, Type (Spend/Receive), Total, Status (Reconciled/Unreconciled).
    *   Features:
        *   "Sync with Xero" button to fetch the latest transactions.
        *   Filtering by date range, status, and type.
        *   Search functionality.

3.  **Sales Invoices Tab:**
    *   A data table listing all sales invoices from the new `Invoice` model.
    *   Columns: Invoice #, Client Name, Project, Issue Date, Due Date, Total, Amount Due, Status (Draft, Submitted, Paid).
    *   Features:
        *   "Create New Invoice" button (which also creates it in Xero).
        *   "Sync with Xero" button to update statuses and payments.
        *   Ability to click into an invoice to view details.

4.  **Bills (Purchase Orders) Tab:**
    *   A data table listing all `PurchaseOrder` records.
    *   Columns: PO Number, Supplier, Order Date, Total, Status, Xero Sync Status (Synced/Unsynced/Error).
    *   Features:
        *   A "Sync with Xero" button to push unsynced purchase orders to Xero as Bills.
        *   Indication of which POs are already synced.

5.  **Contacts Sync Tab:**
    *   A utility page to manage the synchronization of contacts.
    *   Two lists:
        *   Local clients/suppliers not linked to a Xero contact.
        *   Xero contacts not linked to a local record.
    *   Features:
        *   "Link" functionality to manually match local records with Xero contacts.
        *   "Push to Xero" button to create a new Xero contact from a local record.
        *   "Import from Xero" button to create a new local client/supplier from a Xero contact.

---

## 3. API Route Recommendations

A new set of API routes under `/api/finance/xero/` should be created to handle the integration logic.

### Authentication Routes

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/api/finance/xero/connect` | Admin | Redirects the user to the Xero OAuth 2.0 authorization URL. |
| GET | `/api/finance/xero/callback` | None | The callback URL that Xero redirects to after authorization. It exchanges the code for tokens and saves them. |
| POST | `/api/finance/xero/disconnect` | Admin | Deletes the stored Xero connection details from the database. |
| GET | `/api/finance/xero/status` | Admin | Checks if a valid, non-expired connection to Xero exists. |

### Data Synchronization Routes

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| POST | `/api/finance/xero/sync/bank-transactions` | Admin | Fetches the latest bank transactions from Xero and updates the local `BankTransaction` table. |
| POST | `/api/finance/xero/sync/invoices` | Admin | Fetches sales invoices from Xero to update local statuses and creates new local records if they don't exist. |
| POST | `/api/finance/xero/sync/bills` | Admin | Fetches bills from Xero to update the status of local `PurchaseOrder` records. |
| POST | `/api/finance/xero/sync/contacts` | Admin | Fetches contacts from Xero to update local records. |

### Entity-Specific Routes

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| POST | `/api/invoices` | Admin | Creates a new local sales invoice and pushes it to Xero. |
| PATCH | `/api/invoices/[id]` | Admin | Updates a local invoice (and potentially syncs the change to Xero). |
| POST | `/api/purchase_order/[id]/sync-to-xero` | Admin | Pushes a specific local purchase order to Xero as a bill. |
| POST | `/api/client/[id]/sync-to-xero` | Admin | Pushes a specific local client to Xero as a contact. |
| POST | `/api/supplier/[id]/sync-to-xero` | Admin | Pushes a specific local supplier to Xero as a contact. |

---

## 4. Required Libraries

You will need to add a Xero API client library to your project to handle the complexities of OAuth2 and API requests.

**Recommended Library:**
- **`xero-node`**: The official Node.js SDK for the Xero API.

You can add it to your project via npm:

```bash
npm install xero-node
```

You will also need to store your Xero App `clientId` and `clientSecret` securely in your environment variables (`.env` file), similar to how you handle other secrets.

```env
XERO_CLIENT_ID="YOUR_XERO_CLIENT_ID"
XERO_CLIENT_SECRET="YOUR_XERO_CLIENT_SECRET"
XERO_REDIRECT_URI="http://localhost:4000/api/finance/xero/callback"
```

---

## 5. Summary of Actions

1.  **Update `prisma/schema.prisma`**: Add the new models (`Invoice`, `BankTransaction`, `XeroConnection`) and extend the existing `Client`, `Supplier`, and `PurchaseOrder` models as detailed above. Run `npx prisma migrate dev` to apply the changes.
2.  **Install `xero-node`**: Add the Xero SDK to your project's dependencies.
3.  **Implement OAuth 2.0 Flow**: Create the API routes for connecting, handling the callback, and disconnecting from Xero.
4.  **Build the Finance UI**: Restructure the `/admin/finance` page with the proposed tabs and functionality.
5.  **Implement Sync Logic**: Create the backend logic for the data synchronization API routes. This will involve fetching data from Xero, comparing it with local data, and performing creates or updates as needed.
6.  **Integrate Sync into UI**: Connect the "Sync" buttons in the UI to the new API endpoints.

This plan provides a robust foundation for a deep and valuable integration with Xero, turning your application's finance section into a powerful command center for your business operations.