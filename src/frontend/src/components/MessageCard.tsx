import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useReply } from "../hooks/useReply";
import type { Message, Reply } from "../types";

function formatTime(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncateHash(hash: string, chars = 12): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

interface MessageCardProps {
  message: Message;
  index: number;
  activeReplyIndex: number | null;
  onReplyToggle: (index: number | null) => void;
  onReplySent: (reply: Reply) => void;
}

export function MessageCard({
  message,
  index,
  activeReplyIndex,
  onReplyToggle,
  onReplySent,
}: MessageCardProps) {
  const [replyText, setReplyText] = useState("");
  const {
    mutate: sendReply,
    isPending,
    isSuccess,
    isError,
    reset,
  } = useReply();

  const isOpen = activeReplyIndex === index;

  function handleToggle() {
    if (isOpen) {
      onReplyToggle(null);
      setReplyText("");
      reset();
    } else {
      onReplyToggle(index);
      reset();
    }
  }

  function handleSend() {
    if (!replyText.trim()) return;
    const content = replyText.trim();
    sendReply(
      { reply_to: message.sender, content, message_id: Number(message.id) },
      {
        onSuccess: (data) => {
          onReplySent({
            reply_id: data.reply_id,
            reply_to: message.sender,
            content,
            message_id: message.id,
          });
          setReplyText("");
          setTimeout(() => {
            onReplyToggle(null);
            reset();
          }, 1500);
        },
      },
    );
  }

  function handleCancel() {
    onReplyToggle(null);
    setReplyText("");
    reset();
  }

  return (
    <div
      data-ocid={`messages.item.${index}`}
      className="card-elevation rounded p-4 flex flex-col gap-1.5"
    >
      {/* Header row: sender + timestamp */}
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span
          className="font-medium text-sm text-foreground truncate font-mono"
          title={message.sender}
        >
          {truncateHash(message.sender)}
        </span>
        <time
          dateTime={new Date(
            Number(message.timestamp) / 1_000_000,
          ).toISOString()}
          className="text-xs text-muted-foreground shrink-0 font-mono"
        >
          {formatTime(message.timestamp)}
        </time>
      </div>

      {/* Message content — parent card body only, no replies injected here */}
      <p className="text-sm text-foreground/90 leading-relaxed break-words">
        {message.content}
      </p>

      {/* Reply button */}
      <div className="flex items-center justify-end pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={handleToggle}
          data-ocid={`messages.reply_button.${index}`}
        >
          {isOpen ? "Cancel" : "Reply"}
        </Button>
      </div>

      {/* Inline reply form */}
      {isOpen && (
        <div
          data-ocid={`messages.reply_form.${index}`}
          className="mt-1 flex flex-col gap-2 border-t border-border pt-3"
        >
          <Textarea
            data-ocid={`messages.reply_textarea.${index}`}
            placeholder="Write a reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            disabled={isPending || isSuccess}
          />

          {isSuccess && (
            <p
              data-ocid={`messages.reply_success_state.${index}`}
              className="text-xs text-green-600 dark:text-green-400"
            >
              Reply sent!
            </p>
          )}
          {isError && (
            <p
              data-ocid={`messages.reply_error_state.${index}`}
              className="text-xs text-destructive"
            >
              Failed to send. Please try again.
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-3"
              onClick={handleCancel}
              disabled={isPending}
              data-ocid={`messages.reply_cancel_button.${index}`}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 px-3"
              onClick={handleSend}
              disabled={isPending || isSuccess || !replyText.trim()}
              data-ocid={`messages.reply_submit_button.${index}`}
            >
              {isPending ? "Sending…" : "Send Reply"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
