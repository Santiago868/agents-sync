import { useState } from "react";

interface SettingsProps {
  currentUrl: string;
  onSave: (url: string) => void;
  onCancel: () => void;
}

export function Settings({ currentUrl, onSave, onCancel }: SettingsProps) {
  const [value, setValue] = useState(currentUrl);

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
              value={value}
              onInput={(v) => setValue(v)}
              onSubmit={(v) => {
                const text = typeof v === 'string' ? v : value;
                if (text.trim()) onSave(text.trim());
              }}
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
