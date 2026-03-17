import { useKeyboard } from "@opentui/react";
import { useEffect, useState } from "react";
import type { FileEntry } from "../utils/config";
import { getRepoCachePath, saveLocalConfig } from "../utils/config";
import { getFilesInDir, getLocalFiles, getRepoFileTree } from "../utils/git";

interface ExplorerProps {
  mappedFolder: string | null;
  selectedFile: string | null;
  focused: boolean;
  onSelectFile: (path: string | null, source?: "local" | "remote" | "both", isDirectory?: boolean) => void;
  onMappingRequired: (folders: string[]) => void;
  onMapped: (folder: string) => void;
  refreshKey: number;
}

export function Explorer({
  mappedFolder,
  selectedFile,
  focused,
  onSelectFile,
  onMappingRequired,
  onMapped,
  refreshKey,
}: ExplorerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(mappedFolder ?? "");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const repoCachePath = getRepoCachePath();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let remoteItems: FileEntry[];
        const basePath = currentPath || "";
        if (basePath) {
          remoteItems = await getFilesInDir(repoCachePath, basePath);
        } else {
          remoteItems = await getRepoFileTree(repoCachePath);
        }

        // If no mapping yet and we're at root, detect folders and prompt
        if (!mappedFolder && !currentPath) {
          const folders = remoteItems
            .filter((e) => e.isDirectory)
            .map((e) => e.name);
          if (folders.length > 0) {
            onMappingRequired(folders);
          }
        }

        // Merge with local files if we have a mapping
        let items: FileEntry[];
        if (mappedFolder) {
          const localItems = await getLocalFiles(
            process.cwd(),
            mappedFolder,
            basePath || mappedFolder
          );

          const merged = new Map<string, FileEntry>();
          for (const entry of remoteItems) {
            merged.set(entry.path, entry);
          }
          for (const localEntry of localItems) {
            const existing = merged.get(localEntry.path);
            if (existing) {
              existing.source = "both";
            } else {
              merged.set(localEntry.path, localEntry);
            }
          }
          items = Array.from(merged.values());
        } else {
          items = remoteItems;
        }

        // Add ".." nav entry when inside a subdirectory
        if (currentPath) {
          items = [
            { name: "..", isDirectory: true, path: "..", source: "both" },
            ...items,
          ];
        }

        setEntries(items);
        setSelectedIndex(0);
        onSelectFile(null);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentPath, mappedFolder, refreshKey]);

  useEffect(() => {
    if (entries.length === 0) return;
    const entry = entries[selectedIndex];
    if (!entry) return;
    if (entry.name !== "..") {
      onSelectFile(entry.path, entry.source, entry.isDirectory);
    }
  }, [selectedIndex, entries]);

  useKeyboard((key) => {
    if (!focused) return;

    if (key.name === "up" || key.name === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setSelectedIndex((i) => Math.min(entries.length - 1, i + 1));
    }
    if (key.name === "return") {
      const entry = entries[selectedIndex];
      if (!entry) return;
      if (entry.name === "..") {
        const parts = currentPath.split("/");
        parts.pop();
        setCurrentPath(parts.join("/"));
      } else if (entry.isDirectory) {
        setCurrentPath(entry.path);
      }
    }
  });

  if (loading) {
    return (
      <box
        flexDirection="column"
        style={{ border: true, borderColor: "#313244" }}
        title=" Files "
        width="40%"
        flexGrow={0}
        padding={1}
      >
        <text fg="#6c7086">Loading...</text>
      </box>
    );
  }

  return (
    <box
      flexDirection="column"
      style={{ border: true, borderColor: focused ? "#89b4fa" : "#313244" }}
      title=" Files "
      width="40%"
      flexGrow={0}
    >
      {currentPath ? (
        <text fg="#6c7086" padding={1}>
          /{currentPath}
        </text>
      ) : null}
      {entries.length === 0 ? (
        <box padding={1}>
          <text fg="#6c7086">No files found.</text>
        </box>
      ) : (
        entries.map((entry, i) => (
          <box
            key={entry.path + i}
            paddingLeft={1}
            paddingRight={1}
            style={{
              backgroundColor: i === selectedIndex ? "#313244" : undefined,
            }}
          >
            <text
              fg={
                entry.name === ".."
                  ? "#6c7086"
                  : entry.isDirectory
                    ? "#89b4fa"
                    : i === selectedIndex
                      ? "#cdd6f4"
                      : "#a6adc8"
              }
            >
              {entry.isDirectory && entry.name !== ".." ? "📁 " : "  "}
              {entry.name}
            </text>
            {entry.source === "local" && entry.name !== ".." && (
              <text fg="#a6e3a1"> L</text>
            )}
            {entry.source === "remote" && entry.name !== ".." && (
              <text fg="#f38ba8"> R</text>
            )}
          </box>
        ))
      )}
    </box>
  );
}
