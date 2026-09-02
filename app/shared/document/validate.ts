// Validates a freshly loaded project.json before the app trusts it. A file
// edited by hand, half-written by a crash, or from a future version must
// produce a clear error, never a broken editor.

import { PROJECT_FORMATS, type ProjectDocument } from './types';

class ValidationError extends Error {}

function fail(path: string, expected: string): never {
  throw new ValidationError(`project.json is not valid: ${path} should be ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkString(value: unknown, path: string): void {
  if (typeof value !== 'string') fail(path, 'text');
}

function checkOptionalString(value: unknown, path: string): void {
  if (value !== undefined) checkString(value, path);
}

function checkOptionalBoolean(value: unknown, path: string): void {
  if (value !== undefined && typeof value !== 'boolean') fail(path, 'true or false');
}

function checkNumber(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'a number');
}

function checkArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(path, 'a list');
}

function checkKeyframe(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'a keyframe');
  checkNumber(value['time'], `${path}.time`);
  checkNumber(value['x'], `${path}.x`);
  checkNumber(value['y'], `${path}.y`);
  checkNumber(value['scale'], `${path}.scale`);
  checkNumber(value['rotation'], `${path}.rotation`);
  if (typeof value['flipX'] !== 'boolean') fail(`${path}.flipX`, 'true or false');
  checkNumber(value['opacity'], `${path}.opacity`);
  checkString(value['easing'], `${path}.easing`);
  checkOptionalString(value['poseId'], `${path}.poseId`);
}

function checkLayer(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'a layer');
  checkString(value['id'], `${path}.id`);
  checkString(value['name'], `${path}.name`);
  if (!isRecord(value['source'])) fail(`${path}.source`, 'a layer source');
  const kind = value['source']['kind'];
  if (kind !== 'character' && kind !== 'prop' && kind !== 'text') {
    fail(`${path}.source.kind`, '"character", "prop" or "text"');
  }
  checkArray(value['keyframes'], `${path}.keyframes`);
  value['keyframes'].forEach((k, i) => checkKeyframe(k, `${path}.keyframes[${i}]`));
  checkOptionalBoolean(value['hidden'], `${path}.hidden`);
  checkOptionalBoolean(value['locked'], `${path}.locked`);
}

function checkAudioClip(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'an audio clip');
  checkString(value['id'], `${path}.id`);
  if (!isRecord(value['source'])) fail(`${path}.source`, 'an audio source');
  const kind = value['source']['kind'];
  if (kind !== 'asset' && kind !== 'tts') fail(`${path}.source.kind`, '"asset" or "tts"');
  if (kind === 'tts') {
    const line = value['source']['ttsLine'];
    if (!isRecord(line)) fail(`${path}.source.ttsLine`, 'a dialogue line');
    checkString(line['characterId'], `${path}.source.ttsLine.characterId`);
    checkString(line['text'], `${path}.source.ttsLine.text`);
    checkString(line['delivery'], `${path}.source.ttsLine.delivery`);
    checkString(line['voice'], `${path}.source.ttsLine.voice`);
  }
  checkNumber(value['startSeconds'], `${path}.startSeconds`);
  checkNumber(value['volume'], `${path}.volume`);
  checkNumber(value['fadeInSeconds'], `${path}.fadeInSeconds`);
  checkNumber(value['fadeOutSeconds'], `${path}.fadeOutSeconds`);
  checkOptionalString(value['attachedToLayerId'], `${path}.attachedToLayerId`);
}

function checkScene(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'a scene');
  checkString(value['id'], `${path}.id`);
  checkString(value['name'], `${path}.name`);
  checkNumber(value['durationSeconds'], `${path}.durationSeconds`);
  checkOptionalString(value['backgroundAssetId'], `${path}.backgroundAssetId`);
  const fit = value['backgroundFit'];
  if (fit !== undefined && fit !== 'cover' && fit !== 'stretch') {
    fail(`${path}.backgroundFit`, '"cover" or "stretch"');
  }
  checkArray(value['cameraKeyframes'], `${path}.cameraKeyframes`);
  checkArray(value['layers'], `${path}.layers`);
  value['layers'].forEach((l, i) => checkLayer(l, `${path}.layers[${i}]`));
  checkArray(value['audioClips'], `${path}.audioClips`);
  value['audioClips'].forEach((c, i) => checkAudioClip(c, `${path}.audioClips[${i}]`));
  checkOptionalString(value['transitionOut'], `${path}.transitionOut`);
}

/**
 * Checks that a parsed JSON value has the shape of a ProjectDocument.
 * Throws a plain-language error naming the first bad field.
 */
export function validateProjectDocument(value: unknown): ProjectDocument {
  if (!isRecord(value)) fail('the file', 'a project document');
  if (value['schemaVersion'] !== 1) {
    throw new ValidationError(
      'This project was saved by a different version of the app (unknown schemaVersion).'
    );
  }
  checkString(value['name'], 'name');
  if (!PROJECT_FORMATS.includes(value['format'] as never)) {
    fail('format', `one of ${PROJECT_FORMATS.join(', ')}`);
  }
  checkNumber(value['fps'], 'fps');
  checkArray(value['assets'], 'assets');
  value['assets'].forEach((a, i) => {
    if (!isRecord(a)) fail(`assets[${i}]`, 'an asset');
    checkString(a['id'], `assets[${i}].id`);
    checkString(a['file'], `assets[${i}].file`);
    if (a['type'] !== 'image' && a['type'] !== 'cutout' && a['type'] !== 'audio') {
      fail(`assets[${i}].type`, '"image", "cutout" or "audio"');
    }
    if (!isRecord(a['metadata'])) fail(`assets[${i}].metadata`, 'metadata');
  });
  checkArray(value['characters'], 'characters');
  value['characters'].forEach((c, i) => {
    if (!isRecord(c)) fail(`characters[${i}]`, 'a character');
    checkString(c['id'], `characters[${i}].id`);
    checkString(c['name'], `characters[${i}].name`);
    checkArray(c['poses'], `characters[${i}].poses`);
    c['poses'].forEach((p, j) => {
      if (!isRecord(p)) fail(`characters[${i}].poses[${j}]`, 'a pose');
      checkString(p['id'], `characters[${i}].poses[${j}].id`);
      checkString(p['name'], `characters[${i}].poses[${j}].name`);
      checkString(p['cutoutAssetId'], `characters[${i}].poses[${j}].cutoutAssetId`);
    });
    checkOptionalString(c['voice'], `characters[${i}].voice`);
  });
  checkArray(value['scenes'], 'scenes');
  value['scenes'].forEach((s, i) => checkScene(s, `scenes[${i}]`));

  return value as unknown as ProjectDocument;
}
