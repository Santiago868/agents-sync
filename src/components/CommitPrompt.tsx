import { useKeyboard } from "@opentui/react";
import { useState } from "react";

interface CommitPromptProps {
  filename: string;
  onCommit: (message: string) => void;
  onCancel: () => void;
}

export function CommitPrompt({ filename, onCommit, onCancel }: CommitPromptProps) {
  const [value, setValue] = useState("");

  useKeyboard((key) => {
    if (key.name === "return" && value.trim()) {
      onCommit(value.trim());
    }
    if (key.name === "escape") {
      onCancel();
    }
  });

  return (
    <box
      position="absolute"
      top="30%"
      left="20%"
      width={60}
      flexDirection="column"
      style={{ border: true, borderColor: "#f38ba8" }}
      padding={2}
      gap={1}
    >
      <text fg="#cdd6f4">
        <b>Push Changes</b>
      </text>
      <text fg="#6c7086">
        File: <span fg="#a6e3a1">{filename}</span>
      </text>
      <box flexDirection="column" gap={1} marginTop={1}>
        <text fg="#a6adc8">Commit Message:</text>
        <box style={{ border: true, borderColor: "#89b4fa" }}>
          <input
            value={value}
            onInput={(v) => setValue(v)}
            focused
            width={52}
            placeholder="Describe your changes..."
          />
        </box>
      </box>
      <text fg="#6c7086" marginTop={1}>
        Enter to commit and push  |  Escape to cancel
      </text>
    </box>
  );
}
