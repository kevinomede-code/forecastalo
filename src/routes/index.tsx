import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SendHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askQuestion } from "@/lib/ask.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AppSidebar from "@/components/AppSidebar";
import BreakdownList from "@/components/BreakdownList";
import { colorFor, labelForKind } from "@/lib/kg";
import type { ScoreRow } from "@/lib/score-types";
import {
  getChat,
  newChatId,
  saveChat,
  titleFrom,
  type ChatMessage,
} from "@/lib/chats";

const ScoreMap = lazy(() => import("@/components/ScoreMap"));

type NoteUsed = { slug: string; title: string; kind: string; summary: string | null };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { chat?: string } =>
    typeof search['chat'] === "string" ? { chat: search['chat'] } : {},
  head: () => ({
    meta: [
      { title: "Forecastalo — Ask About Italian Housing & Energy Investment Data" },
      {
        name: "description",
        content:
          "Ask questions about Italian housing and energy investment scores: solar yield, building stock, demographics and day-ahead price spreads.",
      },
      { property: "og:title", content: "Forecastalo — Ask the Data" },
      {
        property: "og:description",
        content:
          "A grounded assistant that answers with the real scores and indicators behind Forecastalo.",
      },
    ],
  }),
  component: ChatPage,
});

const EXAMPLES = [
  "Why does Genova score high despite modest sunshine?",
  "What is missing from the battery score?",
  "Which market zone has the widest forecast spread?",
  "Where does the electricity price data come from?",
];

function ChatPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const ask = useServerFn(askQuestion);

  const [chatId, setChatId] = useState<string | null>(search.chat ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zonesUsed, setZonesUsed] = useState<ScoreRow[]>([]);
  const [notesUsed, setNotesUsed] = useState<NoteUsed[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Load (or reset) the conversation whenever the ?chat= parameter changes.
  useEffect(() => {
    const id = search.chat ?? null;
    setChatId(id);
    setError(null);
    setZonesUsed([]);
    setNotesUsed([]);
    setMessages(id ? getChat(id)?.messages ?? [] : []);
  }, [search.chat]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || pending) return;
    setInput("");
    setError(null);

    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setPending(true);

    let id = chatId;
    if (!id) {
      id = newChatId();
      setChatId(id);
      navigate({ to: "/", search: { chat: id }, replace: true });
    }
    saveChat({
      id,
      title: titleFrom(next[0]!.content),
      created_at: new Date().toISOString(),
      messages: next,
    });

    try {
      const result = await ask({
        data: {
          question,
          play: "housing_energy",
          level: "province",
          history: messages.slice(-6),
        },
      });
      if (result.answer) {
        const final: ChatMessage[] = [...next, { role: "assistant", content: result.answer }];
        setMessages(final);
        setZonesUsed((result.zones_used ?? []) as unknown as ScoreRow[]);
        setNotesUsed((result.notes_used ?? []) as NoteUsed[]);
        saveChat({
          id,
          title: titleFrom(final[0]!.content),
          created_at: new Date().toISOString(),
          messages: final,
        });
      } else {
        setError(result.error ?? "The assistant could not answer right now.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const started = messages.length > 0 || pending;
  const mappable = zonesUsed.filter(
    (row) => row.zones?.latitude != null && row.zones?.longitude != null,
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar activeChatId={chatId} />

      {!started ? (
        <main className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="w-full max-w-xl text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Forecastalo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask about housing and energy investment scores across Italian provinces,
              municipalities and electricity market zones.
            </p>

            <div className="mt-6 flex items-end gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
              <Textarea
                value={input}
                rows={2}
                autoFocus
                placeholder="Ask a question about the data…"
                className="max-h-40 min-h-12 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                size="icon"
                className="rounded-xl"
                disabled={input.trim().length === 0}
                aria-label="Send question"
                onClick={() => void send()}
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void send(example)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground shadow-soft transition-colors hover:border-highlight/40 hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 gap-5 overflow-hidden p-5">
          <section className="flex min-h-0 w-[55%] flex-col rounded-2xl border border-border bg-panel shadow-soft">
            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? "animate-fade-in-up max-w-[85%] whitespace-pre-wrap rounded-2xl bg-highlight-soft px-4 py-2.5 text-sm text-highlight"
                        : "animate-fade-in-up max-w-[85%] rounded-2xl border border-border bg-card px-4 py-2.5 text-sm shadow-soft"
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="space-y-2 leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}

              {pending ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}
            </div>

            <div className="shrink-0 border-t border-border p-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  rows={1}
                  placeholder="Ask a follow-up…"
                  className="max-h-32 min-h-10 resize-none rounded-xl"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="rounded-xl"
                  disabled={pending || input.trim().length === 0}
                  aria-label="Send question"
                  onClick={() => void send()}
                >
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          <section className="min-h-0 w-[45%] overflow-y-auto rounded-2xl border border-border bg-panel p-4 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What this answer is about
            </p>

            {mappable.length === 0 && zonesUsed.length === 0 && notesUsed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing concrete was referenced yet. Mention a province, a municipality or a
                market zone and its scores will appear here.
              </p>
            ) : null}

            {mappable.length > 0 ? (
              <div className="mt-3 h-56">
                <ClientOnly fallback={<PanelFallback />}>
                  <Suspense fallback={<PanelFallback />}>
                    <ScoreMap rows={mappable} focus={null} clustered={false} />
                  </Suspense>
                </ClientOnly>
              </div>
            ) : null}

            {zonesUsed.length > 0 ? (
              <ul className="mt-3 grid gap-3">
                {zonesUsed.map((row) => (
                  <li
                    key={row.zone_id}
                    className="animate-fade-in-up rounded-xl border border-border bg-card p-4 shadow-soft"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {row.zones?.name ?? "Unknown zone"}
                      </span>
                      {row.score_total != null ? (
                        <span className="rounded-full bg-highlight-soft px-2.5 py-1 text-xs font-semibold text-highlight">
                          {Number(row.score_total).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <BreakdownList breakdown={row.breakdown} />
                    {row.recommendation ? (
                      <p className="mt-2 text-sm text-muted-foreground">{row.recommendation}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {notesUsed.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes used
                </p>
                <ul className="mt-2 grid gap-1">
                  {notesUsed.map((note) => (
                    <li key={note.slug}>
                      <Link
                        to="/graph"
                        search={{ node: note.slug }}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                      >
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: colorFor(note.kind) }}
                        />
                        <span>
                          <span className="font-medium">{note.title}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {labelForKind(note.kind)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </main>
      )}
    </div>
  );
}

function PanelFallback() {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-muted shadow-soft">
      <span className="text-sm font-medium text-muted-foreground">Map</span>
    </div>
  );
}
