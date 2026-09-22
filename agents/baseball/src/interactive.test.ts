import { expect, test } from "bun:test";
import { createTerminalModel } from "@di-framework/tui/core";
import { runInteractive, type BaseballSession } from "./interactive.ts";

test("shared chat routes media commands with quoted paths, progress, and draft notices", async () => {
  const model = createTerminalModel();
  const calls: string[] = [];
  let cleared = 0;
  let mediaSignal: AbortSignal | undefined;
  const session: BaseballSession = {
    agent: {
      async chat(message) {
        calls.push(message);
        return { content: "reply" };
      },
    },
    clearHistory() {
      cleared++;
    },
    async readPhoto(path, signal) {
      calls.push(`photo:${path}`);
      mediaSignal = signal;
      return { draft: "photo" };
    },
    async watchVideo(path, options) {
      calls.push(`video:${path}`);
      // The UI only consumes coverage from the progress object.
      await options?.onProgress?.({
        coverage: { analyzedThrough: 30, requestedEnd: 120 },
      } as Parameters<
        NonNullable<NonNullable<typeof options>["onProgress"]>
      >[0]);
      return { draft: "video" };
    },
  };
  const statuses: (string | null)[] = [];
  model.subscribe(() => {
    statuses.push(model.getSnapshot().status);
  });
  for (const line of [
    '/photo "score book.jpg"',
    "/video 'game clip.mp4'",
    "/photo",
    '/photo ""',
    "/clear",
    "/paste",
    "first",
    "second",
    "/send",
    "/exit",
  ])
    model.submit(line);
  await runInteractive(session, model.terminal);
  expect(calls).toEqual([
    "photo:score book.jpg",
    "video:game clip.mp4",
    "first\nsecond",
  ]);
  expect(mediaSignal).toBeInstanceOf(AbortSignal);
  expect(cleared).toBe(1);
  expect(statuses).toContain("Analyzed through 30.0s / 120.0s");
  const text = model
    .getSnapshot()
    .messages.map((entry) => entry.content)
    .join("\n");
  expect(text).toContain("Draft only; no stats saved.");
  expect(text).toContain("Draft plays only; no stats saved.");
  expect(text).toContain("Usage: /photo PATH");
});

test("cancelled media results are suppressed and the next chat turn still runs", async () => {
  const model = createTerminalModel();
  for (const line of [
    "/photo image.jpg",
    "/video game.mp4",
    "continue",
    "/exit",
  ])
    model.submit(line);
  await runInteractive(
    {
      agent: {
        async chat() {
          return { content: "continued" };
        },
      },
      clearHistory() {},
      async readPhoto(_, signal) {
        model.interrupt();
        expect(signal?.aborted).toBe(true);
        return { cancelledResult: true };
      },
    },
    model.terminal,
  );
  const text = model
    .getSnapshot()
    .messages.map((entry) => entry.content)
    .join("\n");
  expect(text).toContain(
    "Cancelled. Check saved records before repeating an entry.",
  );
  expect(text).not.toContain("cancelledResult");
  expect(text).toContain("Video analysis is unavailable");
  expect(text).toContain("continued");
});
