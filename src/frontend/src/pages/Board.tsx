import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { MessageCard } from "../components/MessageCard";
import { ReplyThread } from "../components/ReplyThread";
import { useMessages } from "../hooks/useMessages";
import { useReplyStatus } from "../hooks/useReplyStatus";
import type { Reply } from "../types";

export default function Board() {
  const { data: messages, isLoading } = useMessages();
  const [activeReplyIndex, setActiveReplyIndex] = useState<number | null>(null);
  // Lifted reply state: keyed by message id so replies scope to the correct message
  const [repliesBySender, setRepliesBySender] = useState<
    Record<string, Reply[]>
  >({});

  function addReply(messageId: string, reply: Reply) {
    setRepliesBySender((prev) => {
      const existing = prev[messageId] ?? [];
      if (existing.some((r) => r.reply_id === reply.reply_id)) return prev;
      return { ...prev, [messageId]: [...existing, reply] };
    });
  }

  // Global status updater: finds the message that owns this reply_id
  function onGlobalStatusUpdate(
    replyId: number,
    status: string,
    timestamp: string,
    error: string | null,
  ) {
    setRepliesBySender((prev) => {
      const next = { ...prev };
      for (const msgKey of Object.keys(next)) {
        const replies = next[msgKey];
        if (replies.some((r) => r.reply_id === replyId)) {
          next[msgKey] = replies.map((r) =>
            r.reply_id === replyId
              ? {
                  ...r,
                  status,
                  status_timestamp: timestamp,
                  error: error ?? undefined,
                }
              : r,
          );
        }
      }
      return next;
    });
  }

  useReplyStatus(onGlobalStatusUpdate);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground font-display">
            Public Board
          </h1>
          {messages && (
            <Badge
              variant="secondary"
              className="text-xs font-mono tabular-nums"
            >
              {messages.length}
            </Badge>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-8">
        {/* Messages list */}
        <section data-ocid="messages.section">
          {isLoading ? (
            <div
              data-ocid="messages.loading_state"
              className="flex flex-col gap-3"
            >
              {(["sk-1", "sk-2", "sk-3", "sk-4"] as const).map((id) => (
                <Skeleton key={id} className="h-20 w-full rounded" />
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <ol data-ocid="messages.list" className="flex flex-col gap-3">
              {messages.map((msg, i) => {
                const msgKey = String(msg.id);
                const replies = repliesBySender[msgKey] ?? [];
                return (
                  <li
                    key={`${msg.id.toString()}-${msg.timestamp.toString()}`}
                    className="flex flex-col"
                  >
                    <MessageCard
                      message={msg}
                      index={i + 1}
                      activeReplyIndex={activeReplyIndex}
                      onReplyToggle={setActiveReplyIndex}
                      onReplySent={(reply) => addReply(msgKey, reply)}
                    />
                    {replies.length > 0 && (
                      <ReplyThread replies={replies} cardIndex={i + 1} />
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div
              data-ocid="messages.empty_state"
              className="text-center py-16 flex flex-col items-center gap-2"
            >
              <p className="text-muted-foreground text-sm">No messages yet.</p>
              <p className="text-muted-foreground text-xs">
                Be the first to post something.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted/40 border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors duration-200"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
