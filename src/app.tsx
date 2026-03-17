import { useKeyboard, useRenderer } from "@opentui/react";
import { useEffect, useRef, useState } from "react";
import { basename, join } from "node:path";
import { CommitPrompt } from "./components/CommitPrompt";
import { ConflictModal } from "./components/ConflictModal";
import { DiffViewer } from "./components/DiffViewer";
import { Explorer } from "./components/Explorer";
import { Settings } from "./components/Settings";
import {
  type GlobalConfig,
  type LocalConfig,
  getLocalRelativePath,
  getRepoCachePath,
  loadGlobalConfig,
  loadLocalConfig,
  saveGlobalConfig,
  saveLocalConfig,
} from "./utils/config";
import { copyFile, fileExists } from "./utils/fs";
import { GitAuthError, cloneOrPull, commitAndPush, getLocalFilePaths } from "./utils/git";

type View = "loading" | "settings" | "mapping" | "explorer";
type Modal = "none" | "commit" | "conflict";
type FocusedPane = "explorer" | "viewer";

export function App() {
  const [view, setView] = useState<View>("loading");
  const [modal, setModal] = useState<Modal>("none");
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<LocalConfig | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileSource, setSelectedFileSource] = useState<"local" | "remote" | "both">("both");
  const [selectedIsDirectory, setSelectedIsDirectory] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [mappingFolders, setMappingFolders] = useState<string[]>([]);
  const [mappingIndex, setMappingIndex] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusedPane, setFocusedPane] = useState<FocusedPane>("explorer");
  const [pendingPushFiles, setPendingPushFiles] = useState<string[]>([]);
  const isOperating = useRef(false);
  const renderer = useRenderer();

  const repoCachePath = getRepoCachePath();

  async function initRepo(config: GlobalConfig) {
    setStatusMessage("Syncing central repository...");
    try {
      const result = await cloneOrPull(config.remoteUrl, repoCachePath);
      if (result.cloned) setStatusMessage("Repository cloned.");
      else if (result.pulled) setStatusMessage("Repository updated.");

      if (result.conflicts.length > 0) {
        setConflictFiles(result.conflicts);
        setModal("conflict");
        setStatusMessage("Merge conflicts detected.");
      } else {
        setStatusMessage("Ready.");
      }
    } catch (err) {
      if (err instanceof GitAuthError) {
        setStatusMessage(`Auth failed: ${err.message}`);
        setView("settings");
      } else {
        setStatusMessage(`Git error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  useEffect(() => {
    async function init() {
      const [gc, lc] = await Promise.all([loadGlobalConfig(), loadLocalConfig()]);
      setGlobalConfig(gc);
      setLocalConfig(lc);

      if (!gc) {
        setView("settings");
        setStatusMessage("Configure your team repository to get started.");
        return;
      }

      setView("explorer");
      await initRepo(gc);
    }
    init();
  }, []);

  useKeyboard(async (key) => {
    if (modal !== "none") return;

    // [Esc] Cancel settings — return to explorer if we have a config
    if (view === "settings" && key.name === "escape" && globalConfig) {
      setView("explorer");
      return;
    }

    if (view !== "explorer") return;
    if (isOperating.current) return;

    // [Tab] Switch pane focus
    if (key.name === "tab") {
      setFocusedPane((p) => (p === "explorer" ? "viewer" : "explorer"));
      return;
    }

    // [S] Open settings
    if (key.name === "s") {
      setView("settings");
      return;
    }

    // [Q] / Escape — quit
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy();
      return;
    }

    // [D] Diff — already shown in right pane, just ensure a file is selected
    if (key.name === "d") {
      if (!selectedFile) setStatusMessage("Select a file first.");
      return;
    }

    // [P] Pull file from central repo
    if (key.name === "p") {
      if (!selectedFile) {
        setStatusMessage("Select a file to pull.");
        return;
      }
      if (selectedIsDirectory) {
        setStatusMessage("Cannot pull a folder — select individual files.");
        return;
      }
      if (selectedFileSource === "local") {
        setStatusMessage("File only exists locally — nothing to pull.");
        return;
      }
      isOperating.current = true;
      try {
        const localRelative = getLocalRelativePath(selectedFile, localConfig?.mappedFolder ?? null);
        const centralPath = join(repoCachePath, selectedFile);
        const localPath = join(process.cwd(), localRelative);
        await copyFile(centralPath, localPath);
        setStatusMessage(`Pulled ${localRelative} to local project.`);
      } catch (err) {
        setStatusMessage(`Pull failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        isOperating.current = false;
      }
      return;
    }

    // [U] Update / push to central repo
    if (key.name === "u") {
      if (!selectedFile) {
        setStatusMessage("Select a file or folder to push.");
        return;
      }

      const mappedFolder = localConfig?.mappedFolder ?? null;

      if (selectedIsDirectory) {
        // Folder push — collect all local files in the directory
        if (!mappedFolder) {
          setStatusMessage("No folder mapping configured.");
          return;
        }
        isOperating.current = true;
        try {
          const files = await getLocalFilePaths(process.cwd(), mappedFolder, selectedFile);
          if (files.length === 0) {
            setStatusMessage("No local files found in this folder.");
            isOperating.current = false;
            return;
          }
          setPendingPushFiles(files);
          setModal("commit");
        } catch (err) {
          setStatusMessage(`Error scanning folder: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          isOperating.current = false;
        }
      } else {
        // Single file push
        const localRelative = getLocalRelativePath(selectedFile, mappedFolder);
        const localPath = join(process.cwd(), localRelative);
        if (!(await fileExists(localPath))) {
          setStatusMessage(`No local file found: ${localRelative}`);
          return;
        }
        setPendingPushFiles([selectedFile]);
        setModal("commit");
      }
      return;
    }

    // [R] Refresh
    if (key.name === "r") {
      if (!globalConfig) return;
      isOperating.current = true;
      setStatusMessage("Refreshing...");
      try {
        await initRepo(globalConfig);
        setRefreshKey((k) => k + 1);
      } finally {
        isOperating.current = false;
      }
      return;
    }
  });

  // Mapping selection keyboard
  useKeyboard((key) => {
    if (view !== "mapping") return;
    if (key.name === "up" || key.name === "k") {
      setMappingIndex((i) => Math.max(0, i - 1));
    }
    if (key.name === "down" || key.name === "j") {
      setMappingIndex((i) => Math.min(mappingFolders.length - 1, i + 1));
    }
    if (key.name === "return") {
      const folder = mappingFolders[mappingIndex];
      if (!folder) return;
      const lc: LocalConfig = { mappedFolder: folder };
      saveLocalConfig(lc);
      setLocalConfig(lc);
      setView("explorer");
      setStatusMessage(`Mapped to folder: ${folder}`);
    }
  });

  async function handleSettingsSave(url: string) {
    const config: GlobalConfig = { remoteUrl: url };
    await saveGlobalConfig(config);

    // If remote URL changed, clear stale folder mapping
    if (globalConfig?.remoteUrl && globalConfig.remoteUrl !== url) {
      setLocalConfig(null);
      await saveLocalConfig({ mappedFolder: "" });
    }

    setGlobalConfig(config);
    setView("explorer");
    await initRepo(config);
    setRefreshKey((k) => k + 1);
  }

  async function handleCommit(message: string) {
    if (pendingPushFiles.length === 0) return;
    isOperating.current = true;
    setModal("none");
    setStatusMessage("Pushing changes...");
    try {
      const mappedFolder = localConfig?.mappedFolder ?? null;

      // Copy all files from local to central cache
      for (const file of pendingPushFiles) {
        const localRelative = getLocalRelativePath(file, mappedFolder);
        const localPath = join(process.cwd(), localRelative);
        const centralPath = join(repoCachePath, file);
        await copyFile(localPath, centralPath);
      }

      await cloneOrPull(globalConfig!.remoteUrl, repoCachePath);
      await commitAndPush(repoCachePath, message, pendingPushFiles);

      const label = pendingPushFiles.length === 1
        ? getLocalRelativePath(pendingPushFiles[0]!, mappedFolder)
        : `${pendingPushFiles.length} files`;
      setStatusMessage(`Pushed: ${label}`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err instanceof GitAuthError) {
        setStatusMessage(`Auth failed: ${err.message}`);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("conflict") || msg.includes("CONFLICT")) {
          setConflictFiles(pendingPushFiles);
          setModal("conflict");
          setStatusMessage("Push failed: merge conflicts detected.");
        } else {
          setStatusMessage(`Push failed: ${msg}`);
        }
      }
    } finally {
      isOperating.current = false;
      setPendingPushFiles([]);
    }
  }

  async function handleConflictRetry() {
    setModal("none");
    if (!globalConfig) return;
    isOperating.current = true;
    try {
      await initRepo(globalConfig);
      setRefreshKey((k) => k + 1);
    } finally {
      isOperating.current = false;
    }
  }

  const hotkeys =
    view === "explorer"
      ? "[S] Settings  [P] Pull  [U] Push  [D] Diff  [R] Refresh  [Tab] Switch Pane  [Q] Quit  ↑↓ Navigate"
      : view === "settings"
        ? "[Enter] Save  [Esc] Cancel"
        : "";

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <box
        style={{ backgroundColor: "#1e1e2e", border: false }}
        padding={1}
        flexDirection="row"
        alignItems="center"
        gap={2}
      >
        <ascii-font text="Agents Sync" font="tiny" color="#89b4fa" />
        <text fg="#6c7086">Team Agents &amp; Skills Manager</text>
      </box>

      {/* Main content */}
      <box flexGrow={1} flexDirection="column">
        {view === "loading" && (
          <box flexGrow={1} justifyContent="center" alignItems="center">
            <text fg="#6c7086">{statusMessage}</text>
          </box>
        )}

        {view === "settings" && (
          <Settings
            currentUrl={globalConfig?.remoteUrl ?? ""}
            onSave={handleSettingsSave}
            onCancel={() => {
              if (globalConfig) {
                setView("explorer");
              }
            }}
          />
        )}

        {view === "mapping" && (
          <box flexGrow={1} flexDirection="column" justifyContent="center" alignItems="center">
            <box
              flexDirection="column"
              style={{ border: true, borderColor: "#89b4fa" }}
              padding={2}
              gap={1}
              width={50}
            >
              <text fg="#cdd6f4"><b>Map Project Folder</b></text>
              <text fg="#6c7086">
                Select which folder in the central repo maps to this project:
              </text>
              {mappingFolders.map((folder, i) => (
                <box
                  key={folder}
                  paddingLeft={1}
                  style={{ backgroundColor: i === mappingIndex ? "#313244" : undefined }}
                >
                  <text fg={i === mappingIndex ? "#cdd6f4" : "#a6adc8"}>
                    {i === mappingIndex ? "▶ " : "  "}{folder}
                  </text>
                </box>
              ))}
              <text fg="#6c7086" marginTop={1}>↑↓ to select  ·  Enter to confirm</text>
            </box>
          </box>
        )}

        {view === "explorer" && (
          <box flexGrow={1} flexDirection="row">
            <Explorer
              mappedFolder={localConfig?.mappedFolder ?? null}
              selectedFile={selectedFile}
              focused={modal === "none" && focusedPane === "explorer"}
              onSelectFile={(path, source, isDirectory) => {
                setSelectedFile(path);
                setSelectedIsDirectory(isDirectory ?? false);
                if (source) setSelectedFileSource(source);
              }}
              onMappingRequired={(folders) => {
                setMappingFolders(folders);
                setMappingIndex(0);
                setView("mapping");
              }}
              onMapped={(folder) => {
                const lc: LocalConfig = { mappedFolder: folder };
                saveLocalConfig(lc);
                setLocalConfig(lc);
              }}
              refreshKey={refreshKey}
            />
            <DiffViewer
              selectedFile={selectedFile}
              selectedIsDirectory={selectedIsDirectory}
              mappedFolder={localConfig?.mappedFolder ?? null}
              focused={modal === "none" && focusedPane === "viewer"}
            />
          </box>
        )}

        {/* Modals */}
        {modal === "commit" && selectedFile && (
          <CommitPrompt
            filename={selectedIsDirectory ? selectedFile : basename(selectedFile)}
            files={pendingPushFiles}
            isDirectory={selectedIsDirectory}
            onCommit={handleCommit}
            onCancel={() => {
              setModal("none");
              setPendingPushFiles([]);
            }}
          />
        )}

        {modal === "conflict" && (
          <ConflictModal
            conflicts={conflictFiles}
            onRetry={handleConflictRetry}
            onDismiss={() => setModal("none")}
          />
        )}
      </box>

      {/* Footer */}
      <box
        style={{ backgroundColor: "#181825", border: false }}
        paddingLeft={1}
        paddingRight={1}
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <text fg="#6c7086">{hotkeys}</text>
        <text fg={statusMessage.startsWith("Error") || statusMessage.includes("failed") ? "#f38ba8" : "#a6e3a1"}>
          {statusMessage}
        </text>
      </box>
    </box>
  );
}
