import { useState } from "react";
import MuPageRenderer from "../components/MuPageRenderer";
import { postBrowse, useNomadPage } from "../hooks/useNomadPage";

export default function NomadBrowser() {
  const [nodeHash, setNodeHash] = useState("");
  const [pagePath, setPagePath] = useState("/index.mu");
  const [polling, setPolling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: pageContent, isPending } = useNomadPage(polling);

  async function handleBrowse() {
    if (!nodeHash.trim()) return;
    setSubmitting(true);
    try {
      await postBrowse(nodeHash.trim(), pagePath.trim() || "/index.mu");
      setPolling(true);
    } finally {
      setSubmitting(false);
    }
  }

  // Show spinner only while waiting for the first response (data is undefined = never fetched yet)
  const showSpinner = polling && isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Browse Nomad Network
        </h2>
        <p className="text-sm text-muted-foreground">
          Enter a node hash and page path to browse a Nomad page.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label
            htmlFor="node-hash"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Node Hash
          </label>
          <input
            id="node-hash"
            data-ocid="nomad.node_hash.input"
            type="text"
            value={nodeHash}
            onChange={(e) => setNodeHash(e.target.value)}
            placeholder="e.g. abc123def456..."
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div>
          <label
            htmlFor="page-path"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Page Path
          </label>
          <input
            id="page-path"
            data-ocid="nomad.page_path.input"
            type="text"
            value={pagePath}
            onChange={(e) => setPagePath(e.target.value)}
            placeholder="/index.mu"
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          data-ocid="nomad.browse_button"
          onClick={handleBrowse}
          disabled={submitting || !nodeHash.trim()}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded transition-colors duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Sending..." : "Browse"}
        </button>
      </div>

      {polling && (
        <div
          className="border border-border rounded bg-card"
          data-ocid="nomad.result.panel"
        >
          {showSpinner ? (
            <div
              className="flex items-center justify-center py-12"
              data-ocid="nomad.loading_state"
            >
              <span className="inline-block w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div
              className="max-h-96 overflow-y-auto p-4"
              data-ocid="nomad.result.content"
            >
              <MuPageRenderer content={pageContent ?? ""} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
