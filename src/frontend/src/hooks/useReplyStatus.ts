import { useCallback, useEffect, useRef } from "react";

const RAW_BASE = "https://h7igb-yiaaa-aaaaa-qg77a-cai.raw.icp0.io";
const POLL_INTERVAL_MS = 5000;

export interface ReplyStatusItem {
  reply_id: number;
  status: string;
  timestamp: string;
  error: string | null;
}

type OnStatusUpdate = (
  replyId: number,
  status: string,
  timestamp: string,
  error: string | null,
) => void;

async function fetchReplyStatuses(): Promise<ReplyStatusItem[]> {
  const res = await fetch(`${RAW_BASE}/api/reply-status`);
  if (!res.ok) return [];
  const data: unknown = await res.json();
  // Backend may return an array or a single object — normalise to array
  if (Array.isArray(data)) {
    return data as ReplyStatusItem[];
  }
  if (data && typeof data === "object") {
    return [data as ReplyStatusItem];
  }
  return [];
}

export function useReplyStatus(onStatusUpdate: OnStatusUpdate) {
  // Keep a stable ref so the interval always has the latest callback
  const callbackRef = useRef<OnStatusUpdate>(onStatusUpdate);
  useEffect(() => {
    callbackRef.current = onStatusUpdate;
  });

  const poll = useCallback(async () => {
    try {
      const statuses = await fetchReplyStatuses();
      for (const item of statuses) {
        callbackRef.current(
          item.reply_id,
          item.status,
          item.timestamp,
          item.error ?? null,
        );
      }
    } catch {
      // Silent — network errors should not crash the UI
    }
  }, []);

  useEffect(() => {
    // Poll immediately on mount, then on interval
    void poll();
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);
}
