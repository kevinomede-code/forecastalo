import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Layers, Menu, MessageSquare, Network, Plus, Settings2, Sun, Trash2 } from "lucide-react";
import {
  deleteChat,
  loadChats,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
  subscribeChats,
  type StoredChat,
} from "@/lib/chats";

const NAV = [
  { to: "/screening", label: "Screening", icon: Layers },
  { to: "/solar", label: "Solar revenue", icon: Sun },
  { to: "/graph", label: "Knowledge", icon: Network },
  { to: "/system", label: "System", icon: Settings2 },
] as const;

export default function AppSidebar({
  activeChatId,
  compactOnMobile = false,
}: {
  activeChatId?: string | null;
  compactOnMobile?: boolean;
}) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>([]);

  useEffect(() => {
    setCollapsed(
      compactOnMobile && window.matchMedia("(max-width: 767px)").matches
        ? true
        : loadSidebarCollapsed(),
    );
    setChats(loadChats());
    const unsubscribe = subscribeChats(() => setChats(loadChats()));
    return () => {
      unsubscribe();
    };
  }, [compactOnMobile]);

  function toggle() {
    setCollapsed((prev) => {
      saveSidebarCollapsed(!prev);
      return !prev;
    });
  }

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-64"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
        </button>
        {!collapsed ? (
          <span className="truncate text-sm font-semibold tracking-tight">Forecastalo</span>
        ) : null}
      </div>

      <div className="px-2">
        <button
          type="button"
          onClick={() => navigate({ to: "/", search: {} as { chat?: string } })}
          title="New chat"
          className={`flex w-full items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2 text-sm text-muted-foreground shadow-soft transition-colors hover:border-highlight/40 hover:text-foreground ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed ? <span className="truncate">New chat</span> : null}
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2">
        {!collapsed && chats.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">No saved chats yet.</p>
        ) : null}
        <ul className="grid gap-0.5">
          {chats.map((chat) => {
            const active = chat.id === activeChatId;
            return (
              <li key={chat.id} className="group relative">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/", search: { chat: chat.id } })}
                  title={chat.title}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed ? <span className="truncate pr-5">{chat.title}</span> : null}
                </button>
                {!collapsed ? (
                  <button
                    type="button"
                    aria-label={`Delete chat ${chat.title}`}
                    title="Delete chat"
                    onClick={() => {
                      deleteChat(chat.id);
                      if (active) navigate({ to: "/", search: {} as { chat?: string } });
                    }}
                    className="absolute right-1 top-1.5 hidden rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive group-hover:block"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <nav className="mt-2 border-t border-border p-2">
        <ul className="grid gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                title={label}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span className="truncate">{label}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
