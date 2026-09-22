import type { ChatAgentRunOptions } from '@di-framework/ai';
import { createTerminal } from '@di-framework/tui';
import { CHAT_HELP, runChat, type ChatTerminal } from '@di-framework/tui/core';
import { createBaseballCommands, type BaseballCommandSession } from './commands.ts';

export const HELP = `Tell me about your team, paste postgame stats, or ask for a season report.
/video PATH  Watch the first two minutes of recorded game footage and review plays
/photo PATH  Read a scorebook photo with AI vision and review its draft
${CHAT_HELP}`;

export interface BaseballSession extends BaseballCommandSession {
  agent: { chat(message: string, options?: ChatAgentRunOptions): Promise<{ content: string }> };
  clearHistory(): void;
}

export async function runInteractive(session: BaseballSession, terminal: ChatTerminal = createTerminal()) {
  await runChat({
    chat: (message, settings) => session.agent.chat(message, settings),
    clearHistory: () => session.clearHistory(),
    // The CLI owns the database and closes it in its existing finally block.
  }, terminal, {
    title: 'Baseball stats agent',
    help: HELP,
    clearMessage: 'Chat cleared; saved stats remain.',
    cancelledMessage: 'Cancelled. Check saved records before repeating an entry.',
    commands: [...createBaseballCommands(session)],
  });
}
