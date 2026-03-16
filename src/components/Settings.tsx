import { useKeyboard } from "@opentui/react";
import { useRef, useState } from "react";
import type { InputRenderable } from "@opentui/core";

interface SettingsProps {
  currentUrl: string;
  onSave: (url: string) => void;
}

export function Settings({ currentUrl, onSave }: SettingsProps) {
  const [value, setValue] = useState(currentUrl);
  const inputRef = useRef<InputRenderable>(null);

  useKeyboard((key) => {
    if (key.name === "return" && value.trim()) {
      onSave(value.trim());
    }
  });

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
    >
      <box
        flexDirection="column"
        style={{ border: true, borderColor: "#525252" }}
        padding={2}
        gap={1}
        width={60}
      >
        <text fg="#cdd6f4">
          <b>Configure Team Repository</b>
        </text>
        <text fg="#6c7086">
          Enter the Git remote URL for your team's central repository.
        </text>
        <box flexDirection="column" gap={1} marginTop={1}>
          <text fg="#a6adc8">Git Remote URL:</text>
          <box style={{ border: true, borderColor: "#89b4fa" }}>
            <input
              ref={inputRef}
              value={value}
              onChange={(v) => setValue(v)}
              focused
              width={52}
              placeholder="https://github.com/yourteam/agents-repo.git"
            />
          </box>
        </box>
        <text fg="#6c7086" marginTop={1}>
          Press Enter to save and clone repository.
        </text>
      </box>
    </box>
  );
}
