"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { CheckCheck, Eye, Loader2 } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import UpdateItem from "@/components/updates/UpdateItem";
import { UPDATE_TYPE_LABELS } from "@/components/updates/updateTypeUi";
import useUpdates from "@/hooks/useUpdates";
import { useAuth } from "@/contexts/AuthContext";
import { COUNT_BADGE } from "@/app/admin/dashboard/lib/format";

const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";

const formatReadAt = (value) =>
  new Date(value).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

// Read receipts for one update (admin and master-admin only). Loaded when the
// panel is opened, so the list itself stays light.
function SeenBy({ updateId, readToken }) {
  const [open, setOpen] = useState(false);
  const [readers, setReaders] = useState(null);
  const [error, setError] = useState(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    try {
      const res = await axios.get(`/api/v1/updates/${updateId}/readers`, {
        headers: { Authorization: `Bearer ${readToken()}` },
      });
      if (!res.data.status) throw new Error(res.data.message);
      setReaders(res.data.data.readers);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load readers.");
    }
  };

  const readCount = readers?.filter((reader) => reader.is_read).length ?? 0;

  return (
    <div className="shrink-0 self-center">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="cursor-pointer flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Eye className="h-4 w-4" aria-hidden="true" />
        Seen by
      </button>
      {open && (
        <div className="mt-1 w-64 rounded-lg border border-slate-200 bg-white p-3">
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : !readers ? (
            <Loader2
              className="h-4 w-4 animate-spin text-slate-400"
              aria-hidden="true"
            />
          ) : readers.length === 0 ? (
            <p className="text-xs text-slate-500">Nobody was notified</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium text-slate-500">
                {readCount} of {readers.length} have read this
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {readers.map((reader) => (
                  <li
                    key={reader.user_id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate text-slate-700">
                      {reader.name}
                    </span>
                    <span
                      className={
                        reader.is_read ? "text-green-700" : "text-slate-400"
                      }
                    >
                      {reader.is_read ? formatReadAt(reader.read_at) : "Unread"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function UpdatesPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("all");
  const [type, setType] = useState("");

  const updates = useUpdates({
    list: true,
    unreadOnly: tab === "unread",
    type: type || null,
    pageSize: 25,
  });
  const { items, unreadCount, hasMore, loading, loadingMore, error } = updates;

  const handleOpenUpdate = (update) => {
    updates.markRead(update.id);
    router.push(update.url);
  };

  const tabClass = (key) =>
    `cursor-pointer flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      tab === key
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <h1 className="text-xl font-semibold text-slate-800">Updates</h1>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="p-4 shrink-0 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "all"}
                  onClick={() => setTab("all")}
                  className={tabClass("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "unread"}
                  onClick={() => setTab("unread")}
                  className={tabClass("unread")}
                >
                  Unread
                  {unreadCount > 0 && (
                    <span className={COUNT_BADGE}>{unreadCount}</span>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by update type"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="text-sm text-slate-800 py-2 px-3 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All types</option>
                  {Object.entries(UPDATE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={updates.markAllRead}
                  disabled={unreadCount === 0}
                  className={BTN_SECONDARY}
                >
                  <CheckCheck className="h-4 w-4" aria-hidden="true" />
                  Mark all read
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading updates
                </div>
              ) : error && items.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-red-600">
                  {error}
                </p>
              ) : items.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  {tab === "unread" || type
                    ? "No updates match this filter"
                    : "No updates yet. Changes made by other users will show up here."}
                </p>
              ) : (
                <>
                  {items.map((update) => (
                    <UpdateItem
                      key={update.id}
                      update={update}
                      onOpen={handleOpenUpdate}
                      trailing={
                        isAdmin() ? (
                          <SeenBy
                            updateId={update.id}
                            readToken={updates.readToken}
                          />
                        ) : null
                      }
                    />
                  ))}
                  {hasMore && (
                    <div className="p-4 text-center">
                      <button
                        type="button"
                        onClick={updates.loadMore}
                        disabled={loadingMore}
                        className={`${BTN_SECONDARY} mx-auto`}
                      >
                        {loadingMore && (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        )}
                        Load more
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
