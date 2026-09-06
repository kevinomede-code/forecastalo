import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SendHorizontal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askQuestion } from "@/lib/ask.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "Why does Genova score higher than Torino?",
  "Which provinces have the oldest building stock but weak solar?",
  "What does the solar factor actually measure?",
];

export default function AskPanel({
  play,
  level,
}: {
  play: string;
  level: "province" | "municipality";
}) {
  const ask = useServerFn(askQuestion);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send() {
    const question = input.trim();
    if (!question || pending) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setPending(true);
    try {
      const result = await ask({
        data: { question, play, level, history: messages.slice(-6) },
      });
      if (result.answer) {
        setMessages([...next, { role: "assistant", content: result.answer }]);
      } else {
        setError(result.error ?? "The assistant could not answer right now.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !pending ? (
          <div className="mx-auto mt-6 max-w-sm text-center">
            <p className="text-sm font-medium">Ask about the data</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions are answered using the scores and indicators in the database.
            </p>
            <div className="mt-4 grid gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInput(example)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground shadow-soft transition-colors hover:border-highlight/40 hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
                <div className="space-y-2 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
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
            placeholder="Ask a question about the data…"
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
    </div>
  );
}
