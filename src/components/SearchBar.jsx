import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
    const [searchResults, setSearchResults] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const { getToken } = useAuth();
    const router = useRouter();

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

      // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".global-search-container")) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

    // Fetch search results when debounced term changes
    useEffect(() => {
        const runSearch = async () => {
            if (!debouncedSearch) {
                setSearchResults(null);
                return;
            }
            try {
                setSearchLoading(true);
                const token = getToken();
                const response = await axios.post(
                    "/api/search",
                    { search: debouncedSearch },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
                if (response.data?.status) {
                    setSearchResults(response.data.data);
                    setShowSearchDropdown(true);
                } else {
                    setSearchResults(null);
                    setShowSearchDropdown(false);
                }
            } catch (err) {
                console.error("Search API Error:", err);
                setSearchResults(null);
                setShowSearchDropdown(false);
            } finally {
                setSearchLoading(false);
            }
        };
        runSearch();
    }, [debouncedSearch, getToken]);

    const handleSelectResult = (key, item) => {
        let path = null;
        switch (key) {
            case "clients":
                path = item.client_id ? `/admin/clients/${item.client_id}` : null;
                break;
            case "employees":
                path = item.employee_id ? `/admin/employees/${item.employee_id}` : null;
                break;
            case "projects":
                path = item.project_id ? `/admin/projects/${item.project_id}` : null;
                break;
            case "suppliers":
                path = item.supplier_id ? `/admin/suppliers/${item.supplier_id}` : null;
                break;
            case "items":
                path = item.item_id ? `/admin/inventory/${item.item_id}` : null;
                break;
            default:
                break;
        }
        if (path) {
            setShowSearchDropdown(false);
            router.push(path);
        }
    };

    const groups = [
        { key: "clients", label: "Clients", fields: ["client_name", "client_type"] },
        { key: "employees", label: "Employees", fields: ["first_name", "last_name", "role"] },
        { key: "projects", label: "Projects", fields: ["project_name"] },
        { key: "suppliers", label: "Suppliers", fields: ["supplier_name"] },
        { key: "items", label: "Items", fields: ["category", "name", "brand", "color", "type", "sub_category"] },
    ];

    const hasResults =
        searchResults &&
        groups.some((g) => Array.isArray(searchResults[g.key]) && searchResults[g.key].length > 0);

    return (
        <div className="relative min-w-md global-search-container z-50">
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search clients, employees, projects..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
                onFocus={() => searchResults && setShowSearchDropdown(true)}
            />
            {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-slate-300 border-t-secondary rounded-full animate-spin"></div>
                </div>
            )}
            {showSearchDropdown && hasResults && (
                <div className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {groups.map(({ key, label, fields }) => {
                        const list = searchResults?.[key] || [];
                        if (!list.length) return null;
                        return (
                            <div key={key} className="border-b border-slate-100 last:border-b-0">
                                <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 font-semibold bg-slate-50">
                                    {label}
                                </div>
                                <ul className="divide-y divide-slate-100">
                                    {list.map((item) => (
                                        <li key={(item.id || item[`${key}_id`]) ?? JSON.stringify(item)}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectResult(key, item)}
                                                className="cursor-pointer w-full text-left px-3 py-2 hover:bg-slate-50"
                                            >
                                                <div className="text-sm text-slate-800 font-medium truncate">
                                                    {fields
                                                        .map((f) => item[f])
                                                        .filter(Boolean)
                                                        .join(" • ") || "No label"}
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate">
                                                    {key === "items"
                                                        ? [item.brand, item.color, item.type, item.sub_category].filter(Boolean).join(" • ")
                                                        : key === "projects" && typeof item.number_of_lots === "number"
                                                            ? `${item.number_of_lots} lots`
                                                            : null}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
            {showSearchDropdown && !hasResults && debouncedSearch && !searchLoading && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500">
                    No results
                </div>
            )}
        </div>
    );
}
