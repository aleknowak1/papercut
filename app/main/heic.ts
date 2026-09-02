// HEIC (iPhone photo) import via Windows' own decoder — OQ-016, DOC-08 A13,
// ADR-017/OQ-020 constraint: nothing bundled, no libheif, no libde265, no
// native Node module. A small script runs in a separate, Microsoft-signed
// process: WINDOWS POWERSHELL 5.1 (powershell.exe, which ships with
// Windows) — deliberately not PowerShell 7 (pwsh), because the Windows
// imaging components are projected reliably in 5.1 and not in 7. The script
// uses the Windows Imaging Component through PresentationCore (also part of
// Windows): WIC picks up Microsoft's HEIF Image Extension when the user has
// it, decodes the HEIC, and writes a PNG for the normal import path.
//
// If the extension is missing, the import shows the friendly
// "export as JPG" message instead of an error (DOC-01 §5.1).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';

export function isHeicPath(sourcePath: string): boolean {
  const ext = extname(sourcePath).toLowerCase();
  return ext === '.heic' || ext === '.heif';
}

/** The friendly path when Windows cannot decode HEIC (M-9.2). */
export const HEIC_HELP_MESSAGE =
  'This is an iPhone photo (HEIC), and this Windows PC cannot open that format yet. ' +
  'Two easy fixes: (1) install Microsoft\'s free "HEIF Image Extension" from the ' +
  'Microsoft Store, then import again; or (2) on the iPhone, share or export the ' +
  'photo as JPG (Settings → Camera → Formats → "Most Compatible" makes new photos ' +
  'JPG) and import that file instead. The photo was not added.';

// The conversion script (Windows PowerShell 5.1). WIC sniffs the actual file
// content, so this same script decodes any format Windows has a codec for.
const CONVERT_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName PresentationCore
  $inStream = [System.IO.File]::OpenRead($env:PAPERCUT_HEIC_SOURCE)
  try {
    $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
      $inStream,
      [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
      [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
    $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($decoder.Frames[0]))
    $outStream = [System.IO.File]::Create($env:PAPERCUT_HEIC_DEST)
    try { $encoder.Save($outStream) } finally { $outStream.Dispose() }
  } finally { $inStream.Dispose() }
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.GetBaseException().Message)
  exit 1
}
`;

export interface HeicConversionResult {
  readonly ok: boolean;
  /** When not ok: 'no-decoder' shows HEIC_HELP_MESSAGE; 'unreadable' its own. */
  readonly reason?: 'no-decoder' | 'unreadable';
  readonly detail?: string;
}

/**
 * Decides what a failed decode means. WIC reports a missing codec as "No
 * imaging component suitable to complete this operation was found."
 * (0x88982F50); anything else means the file itself is bad.
 */
export function classifyConversionError(stderrText: string): 'no-decoder' | 'unreadable' {
  const text = stderrText.toLowerCase();
  if (text.includes('no imaging component') || text.includes('88982f50')) return 'no-decoder';
  return 'unreadable';
}

/**
 * Converts a HEIC to a PNG in a separate signed Windows process. Never
 * throws; the result says what happened in a way the UI can explain.
 */
export function convertHeicToPng(sourcePath: string, destPath: string): Promise<HeicConversionResult> {
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe', // Windows PowerShell 5.1, always present on Windows 10/11
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', CONVERT_SCRIPT],
      {
        env: { ...process.env, PAPERCUT_HEIC_SOURCE: sourcePath, PAPERCUT_HEIC_DEST: destPath },
        windowsHide: true
      }
    );
    let stderrText = '';
    child.stderr.on('data', (data) => {
      stderrText += String(data);
    });
    child.on('error', (error) => {
      resolve({ ok: false, reason: 'unreadable', detail: String(error) });
    });
    child.on('exit', (code) => {
      if (code === 0 && existsSync(destPath)) {
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          reason: classifyConversionError(stderrText),
          detail: stderrText.trim()
        });
      }
    });
  });
}
