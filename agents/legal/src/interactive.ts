import type { ChatAgentRunOptions } from '@di-framework/ai';
import { CASE_WORKFLOW, CASE_WORKFLOW_SEQUENCE } from './case-workflow.ts';

export interface InteractiveAgent {
  agent: { chat(message: string, options?: ChatAgentRunOptions): Promise<{ content: string }> };
  clearHistory(): void | Promise<void>;
  close(): Promise<void>;
}

export interface ChatTerminal {
  readLine(prompt: string): Promise<string | null>;
  write(text: string): void;
  onInterrupt(handler: () => void): () => void;
  close(): void;
}

const HELP = [
  'Type a message and press Enter.',
  `Case workflow: ${CASE_WORKFLOW_SEQUENCE}`,
  ...CASE_WORKFLOW.map((step) => `${step.command.padEnd(10)}${step.description}`),
  'Run one stage at a time. Answer questions in chat; revisit any stage when facts change.',
  '/clear    Clear this session’s conversation history',
  '/paste    Compose multiple lines; /send submits, /cancel discards',
  '/help     Show commands',
  '/exit     Close the session',
  'Ctrl+C cancels a running request; at the prompt it exits. Ctrl+D ends input.',
].join('\n');

/** Terminal interaction delegates every model turn to the existing ai-utils agent. */
export async function runInteractive(
  session: InteractiveAgent,
  terminal: ChatTerminal,
  options: { intake?: boolean } = {},
): Promise<void> {
  let stopped = false;
  let active: AbortController | undefined;
  const removeInterrupt = terminal.onInterrupt(() => {
    if (active) {
      active.abort();
    } else {
      stopped = true;
      terminal.close();
    }
  });
  const respond = async (message: string) => {
    const controller = new AbortController();
    active = controller;
    terminal.write('Working…');
    try {
      const result = await session.agent.chat(message, { signal: controller.signal });
      terminal.write(controller.signal.aborted ? 'Request cancelled.' : `Agent: ${result.content}`);
    } catch (error) {
      terminal.write(
        controller.signal.aborted
          ? 'Request cancelled.'
          : `Request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      active = undefined;
    }
  };
  try {
    terminal.write(`Legal agent · Codex subscription\n${HELP}`);
    if (options.intake) await respond('/intake');
    let draft: string[] | undefined;
    while (!stopped) {
      const line = await terminal.readLine(draft ? '... ' : 'You> ');
      if (line === null) break;
      const command = line.trim();
      if (command === '/exit' || command === '/quit') break;
      if (draft) {
        if (command === '/cancel') {
          draft = undefined;
          terminal.write('Draft discarded.');
        } else if (command === '/send') {
          const message = draft.join('\n').trim();
          draft = undefined;
          if (message) await respond(message);
        } else {
          draft.push(line);
        }
        continue;
      }
      if (!command) continue;
      if (CASE_WORKFLOW.some((step) => step.command === command)) {
        await respond(command);
        continue;
      }
      switch (command) {
        case '/help':
          terminal.write(HELP);
          break;
        case '/clear':
          await session.clearHistory();
          terminal.write(
            'Conversation history cleared. Case data and plugin tools remain available.',
          );
          break;
        case '/paste':
          draft = [];
          terminal.write('Enter lines, then /send. Use /cancel to discard.');
          break;
        default:
          if (command.startsWith('/')) terminal.write('Unknown command. Use /help.');
          else await respond(line);
      }
    }
  } finally {
    removeInterrupt();
    terminal.close();
    await session.close();
  }
}
