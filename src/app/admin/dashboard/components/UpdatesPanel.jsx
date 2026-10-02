"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import UpdateItem from "@/components/updates/UpdateItem";
import useUpdates from "@/hooks/useUpdates";
import { COUNT_BADGE } from "../lib/format";

// What other users have done in the areas this user has access to. The list
// reloads whenever the polled unread count changes; clicking an update marks it
// read and opens the page where the change was made.
export default function UpdatesPanel() {
  const router = useRouter();
  const updates = useUpdates({ list: true, pageSize: 8 });
  const { enabled, items, unreadCount, loading, error } = updates;

  if (!enabled) return null;

  const handleOpen = (update) => {
    updates.markRead(update.id);
    router.push(update.url);
  };

  return (
    <SectionCard
      title="Updates"
      subtitle="Changes made by other users"
      icon={Bell}
      bodyClassName="p-0"
      action={
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <>
              <span
                className={COUNT_BADGE}
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
              <button
                type="button"
                onClick={updates.markAllRead}
                aria-label="Mark all updates as read"
                title="Mark all as read"
                className="cursor-pointer p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CheckCheck className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}
          <Link
            href="/admin/updates"
            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View all
          </Link>
        </div>
      }
    >
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-500">
          <Loader2
            className="w-5 h-5 animate-spin"
            aria-label="Loading updates"
          />
        </div>
      ) : error && items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-600">
          {error}{" "}
          <button
            type="button"
            onClick={updates.refresh}
            className="cursor-pointer font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          message="No updates yet. Changes other users make will show up here."
        />
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {items.map((update) => (
            <UpdateItem key={update.id} update={update} onOpen={handleOpen} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
