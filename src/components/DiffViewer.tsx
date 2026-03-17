import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import { join } from "node:path";
import { getLocalRelativePath, getRepoCachePath } from "../utils/config";
import { fileExists, generateDiff, readFileText } from "../utils/fs";

type ViewMode = "diff" | "preview" | "status";

interface DiffViewerProps {
  selectedFile: string | null;
  selectedIsDirectory: boolean;
  mappedFolder: string | null;
  focused: boolean;
}

export function DiffViewer({ selectedFile, selectedIsDirectory, mappedFolder, focused }: DiffViewerProps) {
  const [diffContent, setDiffContent] = useState<string>("");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [status, setStatus] = useState<string>("Select a file from the left pane.");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<ViewMode>("status");
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setScrollOffset(0);

    if (!selectedFile) {
      setDiffContent("");
      setPreviewContent("");
      setStatus("Select a file from the left pane.");
      setMode("status");
      return;
    }

    if (selectedIsDirectory) {
      setDiffContent("");
      setPreviewContent("");
      setStatus(`Folder: ${selectedFile}\nPress [U] to push all files in this folder.`);
      setMode("status");
      return;
    }

    async function computeDiff() {
      if (!selectedFile) return;
      setLoading(true);
      setStatus("Computing diff...");
      try {
        const repoCachePath = getRepoCachePath();
        const centralPath = join(repoCachePath, selectedFile);
        const localRelative = getLocalRelativePath(selectedFile, mappedFolder);
        const localPath = join(process.cwd(), localRelative);

        const [centralExists, localExists] = await Promise.all([
          fileExists(centralPath),
          fileExists(localPath),
        ]);

        if (!centralExists && !localExists) {
          setDiffContent("");
          setPreviewContent("");
          setStatus("Neither file exists.");
          setMode("status");
        } else if (!centralExists) {
          // Local only — show preview
          const content = await readFileText(localPath);
          setPreviewContent(content);
          setDiffContent("");
          setStatus("Local only (not yet pushed)");
          setMode("preview");
        } else if (!localExists) {
          // Remote only — show preview
          const content = await readFileText(centralPath);
          setPreviewContent(content);
          setDiffContent("");
          setStatus("Remote only — press [P] to pull");
          setMode("preview");
        } else {
          const diff = await generateDiff(centralPath, localPath);
          if (!diff.trim()) {
            // Identical — show preview
            const content = await readFileText(localPath);
            setPreviewContent(content);
            setDiffContent("");
            setStatus("Files are identical");
            setMode("preview");
          } else {
            setDiffContent(diff);
            setPreviewContent("");
            setStatus("");
            setMode("diff");
          }
        }
      } catch (err) {
        setDiffContent("");
        setPreviewContent("");
        setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
        setMode("status");
      } finally {
        setLoading(false);
      }
    }

    computeDiff();
  }, [selectedFile, selectedIsDirectory, mappedFolder]);

  // Scroll handling when focused
  useKeyboard((key) => {
    if (!focused) return;
    if (mode === "status") return;

    if (key.name === "up" || key.name === "k") {
      setScrollOffset((o) => Math.max(0, o - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setScrollOffset((o) => o + 1);
    }
  });

  const title = selectedFile
    ? mode === "diff"
      ? ` Diff: ${selectedFile} `
      : mode === "preview"
        ? ` Preview: ${selectedFile} `
        : ` ${selectedFile} `
    : " Viewer ";

  const borderColor = focused ? "#89b4fa" : "#313244";

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      style={{ border: true, borderColor }}
      title={title}
    >
      {loading ? (
        <box padding={1}>
          <text fg="#6c7086">Computing diff...</text>
        </box>
      ) : mode === "status" ? (
        <box padding={1} flexGrow={1} justifyContent="center" alignItems="center">
          <text fg="#6c7086">{status}</text>
        </box>
      ) : mode === "preview" ? (
        <box flexDirection="column" flexGrow={1}>
          <box paddingLeft={1} paddingRight={1} height={1}>
            <text fg="#6c7086">{status}</text>
          </box>
          <scrollbox scrollTop={scrollOffset} flexGrow={1}>
            <text fg="#cdd6f4">{previewContent}</text>
          </scrollbox>
        </box>
      ) : (
        <scrollbox scrollTop={scrollOffset} flexGrow={1}>
          <diff
            diff={diffContent}
            view="split"
            filetype="markdown"
            showLineNumbers={true}
            flexGrow={1}
          />
        </scrollbox>
      )}
    </box>
  );
}
