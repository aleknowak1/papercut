// One log line for logs/startup.log. Pure (no Electron), so the unit test
// can pin the format the diagnostics rely on.

export function formatStartupLine(whenIso: string, source: string, message: string): string {
  const flat = message.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', ' | ');
  return `${whenIso} [${source}] ${flat}\n`;
}
