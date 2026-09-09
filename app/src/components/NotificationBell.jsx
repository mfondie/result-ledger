import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchNotifications, markNotificationRead } from "../lib/api";

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell({ departmentId, userId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const lastSeenKey = `notif-last-seen:${departmentId}:${userId}`;

  useEffect(() => {
    fetchNotifications(departmentId).then(setItems);

    const channel = supabase
      .channel(`notifications-${departmentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `department_id=eq.${departmentId}` },
        (payload) => setItems((prev) => [payload.new, ...prev])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [departmentId]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const lastSeen = localStorage.getItem(lastSeenKey) || "1970-01-01T00:00:00Z";
  const unreadCount = items.filter((n) => {
    if (n.user_id === userId) return !n.is_read;
    if (n.user_id === null) return n.created_at > lastSeen;
    return false;
  }).length;

  const toggle = () => {
    setOpen((o) => !o);
    if (!open) localStorage.setItem(lastSeenKey, new Date().toISOString());
  };

  const handleClickItem = (n) => {
    if (n.user_id === userId && !n.is_read) {
      markNotificationRead(n.id).then(() =>
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      );
    }
  };

  return (
    <div className="notif-bell-wrap" ref={containerRef}>
      <button className="notif-bell-btn" onClick={toggle} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-title">Notifications</div>
          {items.length === 0 && <div className="notif-empty">Nothing yet.</div>}
          {items.slice(0, 20).map((n) => (
            <div
              key={n.id}
              className={`notif-item notif-${n.type}${n.user_id === userId && !n.is_read ? " unread" : ""}`}
              onClick={() => handleClickItem(n)}
            >
              <div className="notif-item-title">{n.title}</div>
              <div className="notif-item-message">{n.message}</div>
              <div className="notif-item-time">{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
