import { Button, IconButton, Panel } from '@boh/ui';
import { FileJson, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useHomebrew } from '../../app/data/homebrew';
import { formatNumber } from '../../app/format';

export function HomebrewPanel() {
  const { packs, error, importFile, remove } = useHomebrew();
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setWorking(true);
    const problems: string[] = [];
    for (const file of files) {
      const problem = await importFile(file);
      if (problem) problems.push(`${file.name}: ${problem}`);
    }
    setMessages(problems);
    setWorking(false);
  };

  return (
    <Panel title="Homebrew">
      <p className="mb-3 text-sm text-muted">
        Add homebrew in the 5etools format (.json files from the 5etools homebrew repository or made
        in 5etools). Packs are saved with your own data and appear everywhere like official content,
        under their own sources.
      </p>
      <Button onClick={() => inputRef.current?.click()} disabled={working}>
        <Upload className="h-4 w-4" aria-hidden /> Add homebrew file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {[...messages, ...(error ? [error] : [])].map((m) => (
        <p key={m} role="alert" className="mt-2 text-sm text-accent-ink">
          {m}
        </p>
      ))}
      {packs.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {packs.map((pack) => (
            <li key={pack.path} className="flex items-center gap-3 px-3 py-2">
              <FileJson className="h-5 w-5 shrink-0 text-faint" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {pack.sources.map((s) => s.name).join(', ')}
                </p>
                <p className="truncate text-xs text-muted">
                  {pack.fileName} · {formatNumber(pack.entities)} entries
                </p>
              </div>
              <IconButton
                label={`Remove ${pack.fileName}`}
                size="icon-sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  if (
                    window.confirm(`Remove ${pack.fileName}? Its entries disappear from the app.`)
                  ) {
                    void remove(pack.path);
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
