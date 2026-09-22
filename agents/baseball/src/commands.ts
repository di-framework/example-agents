import type { ChatCommand } from '@di-framework/tui/core';
import type { VideoOptions } from './video.ts';

export interface BaseballCommandSession {
  readPhoto(path: string, signal?: AbortSignal): Promise<unknown>;
  watchVideo?(path: string, options?: VideoOptions): Promise<unknown>;
}

function mediaPath(args: string, command: string): string {
  const path = args.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  if (!path.trim()) throw new Error(`Usage: ${command} PATH`);
  return path;
}

/** Media commands depend only on the injected photo/video capabilities. */
export function createBaseballCommands(session: BaseballCommandSession): ChatCommand[] {
  return [
    {
      name: '/photo',
      description: 'Read a scorebook photo and review its draft',
      arguments: 'PATH',
      async run(args, context) {
        const path = mediaPath(args, '/photo');
        context.setStatus('Reading scorebook image…');
        const draft = await session.readPhoto(path, context.signal);
        context.signal.throwIfAborted();
        context.write(JSON.stringify(draft, null, 2));
        context.write('Draft only; no stats saved. Review the values, then provide corrections or ask to save them.');
      },
    },
    {
      name: '/video',
      description: 'Watch recorded footage and review plays',
      arguments: 'PATH',
      async run(args, context) {
        const path = mediaPath(args, '/video');
        if (!session.watchVideo) throw new Error('Video analysis is unavailable in this session');
        context.setStatus('Watching recorded game footage…');
        const draft = await session.watchVideo(path, {
          signal: context.signal,
          onProgress: (draft) => context.setStatus(`Analyzed through ${draft.coverage.analyzedThrough.toFixed(1)}s / ${draft.coverage.requestedEnd.toFixed(1)}s`),
        });
        context.signal.throwIfAborted();
        context.write(JSON.stringify(draft, null, 2));
        context.write('Draft plays only; no stats saved. Review timestamps, replays, identities, and missing coverage before entering game stats.');
      },
    },
  ];
}
