import { parseArgs } from 'node:util';
import { resolve, dirname, basename, join } from 'node:path';
import { mkdir, writeFile, rename, rm, realpath } from 'node:fs/promises';
import { createChatModel } from '@di-framework/ai';
import { createBaseballAgent } from './agent.ts';
import { reportCsv } from './export.ts';
import { runInteractive } from './interactive.ts';
import { BaseballStore } from './store.ts';
import { CodexVisionModel } from './codex-vision.ts';
import { readScorebook } from './vision.ts';
import { watchVideo } from './video.ts';

export { createBaseballAgent } from './agent.ts';
export { BaseballStore } from './store.ts';
export { reportCsv } from './export.ts';
export { CodexVisionModel } from './codex-vision.ts';
export { readScorebook } from './vision.ts';
export { watchVideo } from './video.ts';
export type { VideoDraft, VideoEvent } from './video-schema.ts';

if (import.meta.main) {
  try {
    const { values } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: false, options: {
      help: { type: 'boolean', short: 'h' }, data: { type: 'string' },
      report: { type: 'string' }, export: { type: 'string' },
      photo: { type: 'string' },
      video: { type: 'string' }, start: { type: 'string' }, duration: { type: 'string' },
      fps: { type: 'string' }, output: { type: 'string' },
    } });
    if (values.help) {
      console.log(`Usage: bun start [--data path/to/baseball.sqlite]
       bun start --report TEAM_ID [--data path/to/baseball.sqlite]
       bun start --export TEAM_ID [--data path/to/baseball.sqlite]
       bun start --photo path/to/scorebook.jpg
       bun start --video path/to/game.mp4 [--start SECONDS] [--duration SECONDS|all]
                 [--fps 0.5..2] [--output plays.json]
Video requires ffmpeg/ffprobe. Defaults: first 120 seconds, 1 frame/second.
--output saves a draft after every window; stdout prints the final JSON. No game stats are saved.
Chat uses the same subscription authentication as the legal agent.
Reports (JSON) and exports (CSV) run locally without model authentication.
Default storage: agents/baseball/data/baseball.sqlite. Run bun run demo for a synthetic example.`);
    } else {
      if ([values.report, values.export, values.photo, values.video].filter((v) => v !== undefined).length > 1)
        throw new Error('Choose one of --report, --export, --photo, or --video');
      if (!values.video && [values.start, values.duration, values.fps, values.output].some((v) => v !== undefined))
        throw new Error('--start, --duration, --fps, and --output require --video');
      const databasePath = resolve(values.data ?? resolve(import.meta.dir, '../data/baseball.sqlite'));
      const teamId = values.report ?? values.export;
      if (values.video) {
        const input = await realpath(values.video);
        const output = values.output ? resolve(values.output) : undefined;
        if (output && await realpath(output).catch(() => output) === input) throw new Error('Output must not overwrite the source video');
        const controller = new AbortController();
        const cancel = () => controller.abort();
        process.on('SIGINT', cancel);
        try {
          const numberOption = (value: string | undefined, fallback: number) => {
            if (value === undefined) return fallback;
            if (!value.trim() || !Number.isFinite(Number(value))) throw new Error('Video options must be finite numbers');
            return Number(value);
          };
          const result = await watchVideo(new CodexVisionModel({ model: process.env.VISION_MODEL }), input, {
            start: numberOption(values.start, 0),
            duration: values.duration === 'all' ? 'all' : numberOption(values.duration, 120),
            fps: numberOption(values.fps, 1), signal: controller.signal,
            onProgress: async (draft) => {
              if (output) {
                await mkdir(dirname(output), { recursive: true });
                const temporary = join(dirname(output), `.${basename(output)}.${crypto.randomUUID()}.tmp`);
                try { await writeFile(temporary, JSON.stringify(draft, null, 2) + '\n'); await rename(temporary, output); }
                finally { await rm(temporary, { force: true }); }
              }
              console.error(`Analyzed ${draft.coverage.analyzedThrough.toFixed(1)}s / ${draft.coverage.requestedEnd.toFixed(1)}s; draft plays require review.`);
            },
          });
          console.log(JSON.stringify(result, null, 2));
        } finally { process.off('SIGINT', cancel); }
      } else if (values.photo) {
        const model = new CodexVisionModel({ model: process.env.VISION_MODEL });
        console.log(JSON.stringify(await readScorebook(model, values.photo), null, 2));
      } else if (teamId) {
        const store = new BaseballStore(databasePath);
        try {
          const report = store.report({ teamId, from: null, through: null });
          process.stdout.write(values.export ? reportCsv(report) : JSON.stringify(report, null, 2) + '\n');
        } finally { store.close(); }
      } else {
        const baseball = createBaseballAgent(createChatModel({ provider: 'openai', auth: 'subscription' }), { databasePath });
        try { await runInteractive(baseball); }
        finally { baseball.close(); }
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
