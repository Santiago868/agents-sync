import { useEffect, useState } from "react";
import { basename, join } from "node:path";
import { getRepoCachePath } from "../utils/config";
import { fileExists, generateDiff } from "../utils/fs";

interface DiffViewerProps {
  selectedFile: string | null;
}

export function DiffViewer({ selectedFile }: DiffViewerProps) {
  const [diffContent, setDiffContent] = useState<string>("");
  const [status, setStatus] = useState<string>("Select a file from the left pane.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setDiffContent("");
      setStatus("Select a file from the left pane.");
      return;
    }

    async function computeDiff() {
      if (!selectedFile) return;
      setLoading(true);
      setStatus("Computing diff...");
      try {
        const repoCachePath = getRepoCachePath();
        const centralPath = join(repoCachePath, selectedFile);
        const localPath = join(process.cwd(), basename(selectedFile));

        const [centralExists, localExists] = await Promise.all([
          fileExists(centralPath),
          fileExists(localPath),
        ]);

        if (!centralExists && !localExists) {
          setDiffContent("");
          setStatus("Neither file exists.");
        } else if (!centralExists) {
          setDiffContent("");
          setStatus("File only exists locally (not yet pushed to central repo).");
        } else if (!localExists) {
          setDiffContent("");
          setStatus(`File only exists in central repo. Press [P] to pull it.`);
        } else {
          const diff = await generateDiff(centralPath, localPath);
          if (!diff.trim()) {
            setDiffContent("");
            setStatus("Files are identical.");
          } else {
            setDiffContent(diff);
            setStatus("");
          }
        }
      } catch (err) {
        setDiffContent("");
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    }

    computeDiff();
  }, [selectedFile]);

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      style={{ border: true, borderColor: "#313244" }}
      title={selectedFile ? ` Diff: ${selectedFile} ` : " Diff "}
    >
      {loading ? (
        <box padding={1}>
          <text fg="#6c7086">Computing diff...</text>
        </box>
      ) : status ? (
        <box padding={1} flexGrow={1} justifyContent="center" alignItems="center">
          <text fg="#6c7086">{status}</text>
        </box>
      ) : (
        <diff
          diff={diffContent}
          view="split"
          filetype="markdown"
          showLineNumbers={true}
          flexGrow={1}
        />
      )}
    </box>
  );
}
