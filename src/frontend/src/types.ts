export interface Message {
  id: bigint;
  sender: string;
  content: string;
  timestamp: bigint;
}

export interface Reply {
  reply_id: number;
  reply_to: string;
  content: string;
  message_id: bigint;
  status?: string;
  status_timestamp?: string;
  error?: string;
}
