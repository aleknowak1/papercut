// The start-up log's line format (CL-0022): one line per event, timestamp
// first, source tagged, newlines flattened so one event is always one line.
import { describe, expect, it } from 'vitest';
import { formatStartupLine } from '../app/main/logLine';

describe('startup log line format', () => {
  it('writes timestamp, source, and message on one line', () => {
    expect(formatStartupLine('2026-09-02T10:00:00.000Z', 'main', 'app ready')).toBe(
      '2026-09-02T10:00:00.000Z [main] app ready\n'
    );
  });

  it('flattens multi-line messages (stack traces) into one line', () => {
    const line = formatStartupLine('t', 'renderer', 'Error: boom\r\n  at somewhere');
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(line).toContain('Error: boom |   at somewhere');
  });
});
