// A small number field for the inspectors (layer and camera): commits
// once on Enter or blur — one undo step — and snaps back on Escape or
// nonsense input.

import { useState, type JSX } from 'react';

export function NumberField({
  label,
  value,
  suffix,
  title,
  onCommit
}: {
  readonly label: string;
  /** The document's value, already rounded for display. */
  readonly value: number;
  readonly suffix?: string;
  readonly title?: string;
  readonly onCommit: (value: number) => void;
}): JSX.Element {
  const [text, setText] = useState<string | undefined>(undefined);
  const commit = (): void => {
    if (text === undefined) return;
    setText(undefined);
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed === value) return;
    onCommit(parsed);
  };
  return (
    <label className="mask-tool inspector-field">
      {label}
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        title={title}
        value={text ?? String(value)}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setText(undefined);
        }}
      />
      {suffix}
    </label>
  );
}
