import { useMutation } from "@tanstack/react-query";

const RAW_BASE = "https://h7igb-yiaaa-aaaaa-qg77a-cai.raw.icp0.io";

interface ReplyPayload {
  reply_to: string;
  content: string;
  message_id: number;
}

interface ReplyResponse {
  success: boolean;
  reply_id: number;
}

async function postReply(payload: ReplyPayload): Promise<ReplyResponse> {
  const res = await fetch(`${RAW_BASE}/api/message/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Reply failed: ${res.status}`);
  }
  return res.json() as Promise<ReplyResponse>;
}

export function useReply() {
  return useMutation({
    mutationFn: postReply,
  });
}
