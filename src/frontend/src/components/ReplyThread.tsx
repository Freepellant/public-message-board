import { Badge } from "@/components/ui/badge";
import type { Reply } from "../types";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "bg-muted text-muted-foreground border-muted-foreground/30",
  },
  sent_to_bridge: {
    label: "Sent",
    className:
      "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400",
  },
  delivered_to_lxmf: {
    label: "Delivered to LXMF",
    className:
      "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  },
  received_by_remote: {
    label: "Received",
    className:
      "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-500",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

interface ReplyRowProps {
  reply: Reply;
  cardIndex: number;
  replyIndex: number;
}

function ReplyRow({ reply, cardIndex, replyIndex }: ReplyRowProps) {
  const badge = reply.status ? STATUS_BADGE[reply.status] : undefined;

  return (
    <div
      data-ocid={`messages.reply_item.${cardIndex}.${replyIndex}`}
      className="ml-4 pl-3 border-l-2 border-border/60 flex flex-col gap-1 py-2"
    >
      <p className="text-xs text-foreground/80 break-words">{reply.content}</p>

      {/* Timestamp */}
      {reply.status_timestamp && (
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {reply.status_timestamp}
        </p>
      )}

      {/* Status badge */}
      {badge && (
        <div
          data-ocid={`messages.reply_status.${cardIndex}.${replyIndex}`}
          className="flex items-center gap-2"
        >
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 leading-none ${badge.className}`}
          >
            {badge.label}
          </Badge>
        </div>
      )}

      {/* Error text (only when failed) */}
      {reply.status === "failed" && reply.error && (
        <p className="text-[10px] text-destructive break-words">
          {reply.error}
        </p>
      )}
    </div>
  );
}

interface ReplyThreadProps {
  replies: Reply[];
  cardIndex: number;
  onStatusUpdate?: (
    replyId: number,
    status: string,
    timestamp: string,
    error: string | null,
  ) => void;
}

export function ReplyThread({ replies, cardIndex }: ReplyThreadProps) {
  const uniqueReplies = replies.filter(
    (r, i, arr) => arr.findIndex((x) => x.reply_id === r.reply_id) === i,
  );

  if (uniqueReplies.length === 0) return null;

  return (
    <div
      data-ocid={`messages.reply_thread.${cardIndex}`}
      className="flex flex-col"
    >
      {uniqueReplies.map((reply, ri) => (
        <ReplyRow
          key={reply.reply_id}
          reply={reply}
          cardIndex={cardIndex}
          replyIndex={ri + 1}
        />
      ))}
    </div>
  );
}
