import type { Readable, Writable } from 'node:stream';
import { createTerminal as createSharedTerminal } from '@di-framework/tui';
import { createReadlineTerminal, type ChatTerminal } from '@di-framework/tui/core';

/** Explicit streams keep the existing injectable plain-terminal API. */
export function createTerminal(
  input?: Readable & { isTTY?: boolean },
  output: Writable = process.stdout,
): ChatTerminal {
  return input
    ? createReadlineTerminal({ input, output, interrupts: process })
    : createSharedTerminal();
}
