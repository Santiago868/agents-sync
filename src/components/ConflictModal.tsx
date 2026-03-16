import { useKeyboard } from "@opentui/react";

interface ConflictModalProps {
  conflicts: string[];
  onRetry: () => void;
  onDismiss: () => void;
}

export function ConflictModal({ conflicts, onRetry, onDismiss }: ConflictModalProps) {
  useKeyboard((key) => {
    if (key.name === "r") onRetry();
    if (key.name === "escape") onDismiss();
  });

  return (
    <box
      position="absolute"
      top="20%"
      left="15%"
      width={70}
      flexDirection="column"
      style={{ border: true, borderColor: "#f38ba8" }}
      padding={2}
      gap={1}
    >
      <text fg="#f38ba8">
        <b>Merge Conflicts Detected</b>
      </text>
      <text fg="#6c7086">
        The following files have conflicts in the central repository:
      </text>
      <scrollbox height={8} marginTop={1}>
        {conflicts.map((file) => (
          <text key={file} fg="#fab387">
            · {file}
          </text>
        ))}
      </scrollbox>
      <text fg="#6c7086" marginTop={1}>
        Resolve conflicts in: ~/.team-agents-repo/
      </text>
      <text fg="#a6adc8">
        [R] Retry pull  ·  [Escape] Dismiss
      </text>
    </box>
  );
}
