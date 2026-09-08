export type ChatMessage = { role: "user" | "assistant"; content: string };

export type StoredChat = {
  id: string;
  title: string;
  created_at: string;
  messages: ChatMessage[];
};

const CHATS_KEY = "forecastalo.chats.v1";
export const SIDEBAR_KEY = "forecastalo.sidebar.collapsed";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeChats(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadChats(): StoredChat[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is StoredChat =>
          !!item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          Array.isArray(item.messages),
      )
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  } catch {
    return [];
  }
}

function writeChats(list: StoredChat[]) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CHATS_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* storage unavailable — chats simply are not persisted */
  }
  emit();
}

export function saveChat(chat: StoredChat) {
  const list = loadChats().filter((item) => item.id !== chat.id);
  writeChats([chat, ...list]);
}

export function deleteChat(id: string) {
  writeChats(loadChats().filter((item) => item.id !== id));
}

export function getChat(id: string): StoredChat | null {
  return loadChats().find((item) => item.id === id) ?? null;
}

export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 44) return clean || "New chat";
  return `${clean.slice(0, 44)}…`;
}

export function newChatId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadSidebarCollapsed(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSidebarCollapsed(value: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SIDEBAR_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
