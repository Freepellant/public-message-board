import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import type { Message } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BackendWithMessages = {
  getMessages: () => Promise<Message[]>;
  addMessage: (sender: string, content: string) => Promise<void>;
};

export function useMessages() {
  const { actor, isFetching } = useActor(createActor);
  const backend = actor as unknown as BackendWithMessages | null;

  return useQuery<Message[]>({
    queryKey: ["messages"],
    queryFn: async () => {
      if (!backend) return [];
      const msgs = await backend.getMessages();
      return [...msgs].sort(
        (a, b) => Number(b.timestamp) - Number(a.timestamp),
      );
    },
    enabled: !!backend && !isFetching,
    refetchInterval: 5000,
  });
}

export function useAddMessage() {
  const { actor } = useActor(createActor);
  const backend = actor as unknown as BackendWithMessages | null;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sender,
      content,
    }: { sender: string; content: string }) => {
      if (!backend) throw new Error("Actor not ready");
      await backend.addMessage(sender, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
