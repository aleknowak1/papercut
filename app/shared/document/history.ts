// Undo/redo (ADR-006: one immutable project document with history).
//
// The history holds whole ProjectDocument values in two stacks: "past" and
// "future". That sounds expensive but is not, because of STRUCTURAL SHARING:
// every edit in edits.ts copies only the small path of objects it actually
// changes (say, one layer, its scene, and the top-level document) and shares
// every other scene, layer, asset, and character by reference with the
// previous version. A hundred history entries therefore cost little more
// memory than one document, and undo/redo never grows memory per keystroke.
// Undo is instant: swap the present document for its neighbour.

import type { ProjectDocument } from './types';

/** Oldest past entries are dropped beyond this; nobody undoes 200 steps. */
const MAX_HISTORY = 200;

export interface History {
  readonly past: readonly ProjectDocument[];
  readonly present: ProjectDocument;
  readonly future: readonly ProjectDocument[];
}

export function createHistory(doc: ProjectDocument): History {
  return { past: [], present: doc, future: [] };
}

/** Records an edit: the new document becomes present, redo history is cleared. */
export function applyEdit(history: History, next: ProjectDocument): History {
  if (next === history.present) return history; // the edit changed nothing
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return { past, present: next, future: [] };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future]
  };
}

export function redo(history: History): History {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1)
  };
}
