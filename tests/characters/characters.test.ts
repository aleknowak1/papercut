// Characters with poses (M-2.5, ADR-015): add/rename/reorder/delete
// round-trip through save/reopen, every operation is one undo step, and a
// damaged pose in project.json is refused in plain language.

import { describe, expect, it } from 'vitest';
import { createProject, loadProject, saveProject } from '../../app/main/projectStore';
import {
  addCharacter,
  addPose,
  removeCharacter,
  removePose,
  renameCharacter,
  renamePose,
  reorderPose
} from '../../app/shared/document/edits';
import { applyEdit, createHistory, undo } from '../../app/shared/document/history';
import type { Character, ProjectDocument } from '../../app/shared/document/types';
import { validateProjectDocument } from '../../app/shared/document/validate';
import { sampleProject } from '../helpers/sampleProject';
import { suiteOutputDirs } from '../helpers/testOutput';

const tempDir = suiteOutputDirs('characters');

const dave: Character = { id: 'char-1', name: 'Dave', poses: [] };
const pose = (id: string, name: string): { id: string; name: string; cutoutAssetId: string } => ({
  id,
  name,
  cutoutAssetId: `cutout-for-${id}`
});

function withDaveAndPoses(doc: ProjectDocument): ProjectDocument {
  let next = addCharacter(doc, dave);
  next = addPose(next, 'char-1', pose('p1', 'Standing'));
  next = addPose(next, 'char-1', pose('p2', 'Pointing'));
  next = addPose(next, 'char-1', pose('p3', 'Shocked'));
  return next;
}

/** sampleProject() already has its own character; ours is looked up by id. */
function daveIn(doc: ProjectDocument): Character | undefined {
  return doc.characters.find((c) => c.id === 'char-1');
}

describe('character and pose edits', () => {
  it('adds, renames, reorders and deletes poses', () => {
    let doc = withDaveAndPoses(sampleProject());
    expect(daveIn(doc)?.poses.map((p) => p.name)).toEqual([
      'Standing',
      'Pointing',
      'Shocked'
    ]);

    doc = renamePose(doc, 'char-1', 'p2', 'Pointing at suitcase');
    expect(daveIn(doc)?.poses[1]?.name).toBe('Pointing at suitcase');

    doc = reorderPose(doc, 'char-1', 'p3', 0);
    expect(daveIn(doc)?.poses.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);

    doc = removePose(doc, 'char-1', 'p1');
    expect(daveIn(doc)?.poses.map((p) => p.id)).toEqual(['p3', 'p2']);

    doc = renameCharacter(doc, 'char-1', 'Dave from accounts');
    expect(daveIn(doc)?.name).toBe('Dave from accounts');

    const before = doc.characters.length;
    doc = removeCharacter(doc, 'char-1');
    expect(daveIn(doc)).toBeUndefined();
    expect(doc.characters).toHaveLength(before - 1);
  });

  it('reorder clamps out-of-range positions and ignores unknown ids', () => {
    const doc = withDaveAndPoses(sampleProject());
    const clamped = reorderPose(doc, 'char-1', 'p1', 99);
    expect(daveIn(clamped)?.poses.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
    expect(reorderPose(doc, 'char-1', 'nope', 0)).toEqual(doc); // unchanged content
    expect(reorderPose(doc, 'nope', 'p1', 0).characters).toEqual(doc.characters);
  });

  it('every operation is exactly one undo step', () => {
    const start = sampleProject();
    let history = createHistory(start);
    history = applyEdit(history, addCharacter(history.present, dave));
    history = applyEdit(history, addPose(history.present, 'char-1', pose('p1', 'Standing')));
    history = applyEdit(history, renamePose(history.present, 'char-1', 'p1', 'Waving'));
    history = applyEdit(history, removePose(history.present, 'char-1', 'p1'));

    history = undo(history);
    expect(daveIn(history.present)?.poses[0]?.name).toBe('Waving');
    history = undo(history);
    expect(daveIn(history.present)?.poses[0]?.name).toBe('Standing');
    history = undo(history);
    expect(daveIn(history.present)?.poses).toHaveLength(0);
    history = undo(history);
    expect(history.present).toEqual(start);
  });

  it('characters with poses survive save and reopen field for field', () => {
    const dir = tempDir();
    const projectDir = createProject(dir, 'Characters', '9:16');
    const doc = withDaveAndPoses(loadProject(projectDir));
    saveProject(projectDir, doc);
    expect(loadProject(projectDir)).toEqual(doc);
  });

  it('a damaged pose is refused in plain language', () => {
    const doc = withDaveAndPoses(sampleProject());
    const damaged = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
    (damaged['characters'] as { poses: unknown[] }[])[0]!.poses[1] = { id: 'p2' };
    expect(() => validateProjectDocument(damaged)).toThrow(/poses\[1\]\.name/);
  });
});
