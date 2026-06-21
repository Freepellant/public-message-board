import { useQuery } from "@tanstack/react-query";

const BACKEND_CANISTER_ID = "h7igb-yiaaa-aaaaa-qg77a-cai";
const BASE_URL = `https://${BACKEND_CANISTER_ID}.raw.icp0.io`;

export function useNomadPage(enabled: boolean) {
  return useQuery<string>({
    queryKey: ["nomad-page"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/page`);
      if (!res.ok) return "";
      const data = (await res.json()) as { content?: string };
      return data.content ?? "";
    },
    enabled,
    refetchInterval: enabled ? 3000 : false,
    retry: false,
  });
}

export async function postBrowse(
  nodeHash: string,
  pagePath: string,
): Promise<void> {
  await fetch(`${BASE_URL}/api/browse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_hash: nodeHash, page_path: pagePath }),
  });
}
