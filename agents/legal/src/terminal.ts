import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { ChatTerminal } from './interactive.ts';

/** readline's iterator retains pasted or piped lines while the agent is working. */
export function createTerminal(
  input: Readable & { isTTY?: boolean } = process.stdin,
  output: Writable = process.stdout,
): ChatTerminal {
  const readline = createInterface({
    input,
    output,
    terminal: Boolean(input.isTTY),
    crlfDelay: Infinity,
  });
  const lines = readline[Symbol.asyncIterator]();
  return {
    async readLine(prompt) {
      if (input.isTTY) {
        readline.setPrompt(prompt);
        readline.prompt();
      }
      const result = await lines.next();
      return result.done ? null : result.value;
    },
    write(text) {
      output.write(`${text}\n\n`);
    },
    onInterrupt(handler) {
      readline.on('SIGINT', handler);
      process.on('SIGINT', handler);
      return () => {
        readline.off('SIGINT', handler);
        process.off('SIGINT', handler);
      };
    },
    close() {
      readline.close();
    },
  };
}
