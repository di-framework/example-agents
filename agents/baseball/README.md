# Baseball stats agent

> STATUS: In Progress, Unverified

A di-framework agent that watches recorded baseball footage with AI vision and produces
a timestamped draft of plays and scoreboard observations. Use any game broadcasts/clips to
try the video workflow, or use historically recorded game footable. Review what it observed, then
enter confirmed game stats into the team/season tracker. Scorebook photos and manual
entry are also supported. Stats persist in SQLite; tools calculate season totals and rates.

## Run

From this repository, run `bun install`, then:

```sh
cd agents/baseball
bun start
```

Chat and vision use your existing Codex sign-in. You can also supply DI Framework
`ChatModel` instances for chat and vision to `createBaseballAgent`. The default database is
`agents/baseball/data/baseball.sqlite`, independent of the current directory. Use
`bun start --data /path/to/stats.sqlite` for another database.

Try a synthetic game without signing in or writing team data:

```sh
bun run demo
```

## Watch a recorded game

Install [FFmpeg](https://ffmpeg.org/download.html), including `ffmpeg` and `ffprobe`
on PATH (`brew install ffmpeg` on macOS). In chat:

```text
/video /path/to/game.mp4
Explain the plays you observed and what needs review.
```

This analyzes the first two minutes, then keeps the draft available for follow-up chat.
For a specific passage or a whole recording:

```sh
bun start --video /path/to/game.mp4 --start 300 --duration 120 --output plays.json
bun start --video /path/to/game.mp4 --duration all --output full-game.json
```

`--start` and `--duration` are seconds on the video timeline. Default duration is 120
seconds; `all` processes the remaining recording, up to six hours per invocation.
Default `--fps 1` samples one frame per second; supported values are 0.5–2. Higher
sampling uses more image inputs. Whole games require many sequential model calls and
may be slower than playback. This is recorded-file analysis, not a real-time service.

The pipeline:

1. FFmpeg decodes 20-second windows with four seconds of overlap, preserves the selected
   source timestamps, and scales frames to at most 1280 pixels wide.
2. The vision model receives ordered images, timestamps, and the latest 40 proposed
   events. It reads visible scoreboard information and proposes outcomes, with evidence
   frames, uncertainty, and original-presentation/replay labels.
3. Responses must match the schema and cite frames actually supplied. Replays and linked
   duplicates do not enter `candidateCounts`; neither do uncertain or lower-confidence
   events. Those counts remain observations for review, not official baseball statistics.
4. `--output` replaces the JSON draft after each successful window. If a later request
   fails or is cancelled, earlier windows remain in that file with `status: in_progress`.
   `complete` means the requested interval was processed, not that every play was captured.
   Stdout emits the final JSON; progress goes to stderr. Temporary frames are removed.

The output includes scoreboard snapshots, proposed pitches/outcomes, visible player
names, timestamps, duplicate references, coverage, and a hash of the sampled image
evidence. It does not retain video frames. Review by seeking to the cited seconds in the
original recording. `live` in an event means original presentation rather than a replay;
it does not imply a live streaming connection.

Video analysis has no stats tools and cannot save game records. In chat, confirm the
final score, game date, player identities, and all counts in each category you want saved.
The agent must keep missing categories unrecorded. A highlight cannot establish a full
game's pitch count, RBI, earned runs, or fielding stats. MLB examples belong to their
own teams/seasons with a nine-inning ERA basis.

Current limits: local completed video files only; no live URLs, MLB.TV connection,
audio commentary, continuous ball tracking, or calibrated accuracy guarantee. Sparse
sampling can miss fast action and complete plays, and replay detection can be wrong.
Full-game stat accuracy and youth-game footage still need evaluation. The live smoke
test uses an official MLB highlight; see [video evaluation](VIDEO_EVALUATION.md).

Programmatic use accepts the same injected vision `ChatModel` as photos:

```ts
const draft = await baseball.watchVideo("/path/to/game.mp4", {
  start: 300,
  duration: 120,
  fps: 1,
  onProgress: (draft) => console.log(draft.coverage.analyzedThrough),
});
```

For model integration and authentication, see the photo section below. Each video
window uses [multiple image inputs](https://developers.openai.com/api/docs/guides/images-vision),
not a native video payload. No new model download or inference service is needed.

## Read a scorebook photo

In chat, enter a local image path (spaces are supported):

```text
/photo /path/to/scorebook.jpg
```

The vision model reads the image and returns a draft with player rows, counts, and
warnings for unclear handwriting or missing columns. Review it, provide corrections,
and ask the agent to save the confirmed stats. Reading an image does not write game
records. Missing cells remain `null`; blank cells are never assumed to mean zero.
If a category is incomplete, clarify its missing counts or leave that category unrecorded.

For extraction alone:

```sh
bun start --photo /path/to/scorebook.png
# Optionally choose the image-capable model available to your account:
VISION_MODEL=your-model-id bun start
```

PNG, JPEG, and WebP are accepted up to 20 MiB. Convert HEIC or PDF first. Use a clear,
upright image with readable column headers. Interpretation of handwritten scoring
symbols needs scorer review; the current live smoke test covers a printed synthetic
score sheet, not a benchmark of handwritten scorebooks.

The default `CodexVisionModel` sends image attachments through
[`codex exec --image`](https://learn.chatgpt.com/docs/cli/reference), using the CLI's
default model unless `VISION_MODEL` is set. It requests a JSON schema, uses a temporary
directory with a read-only sandbox, disables shell/web tools, ignores user configuration,
and removes its temporary files afterward. Authentication still uses the existing sign-in.
Extraction times out after 120 seconds and supports cancellation. DI Framework 5.3.2's
subscription bridge is text-only, so this dedicated image adapter supplies the vision
step while DI Framework handles the chat and stats tools.

You can instead inject an image-capable API model (including a compatible local endpoint):

```ts
import { OpenAiChatModel } from "@di-framework/ai";
import { createBaseballAgent } from "./src/agent.ts";

const baseball = createBaseballAgent(chatModel, {
  visionModel: new OpenAiChatModel({
    model: "your-vision-model",
    apiKey: process.env.OPENAI_API_KEY,
  }),
});
try {
  console.log(await baseball.readPhoto("/path/to/scorebook.jpg"));
} finally {
  baseball.close();
}
```

The injected model must accept image bytes and return the requested structured data.
The image is passed as multimodal content, not as a filename in a text prompt.
See [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision).

Example chat:

```text
Create the Owls for Fall 2026, Majors division. Use a six-inning ERA basis.
Add Alex, jersey 7, and Sam, jersey 12.
We beat the Foxes 5–3 on September 12, 2026. Alex threw 38 pitches.
The source is my postgame scorebook. Other stats aren't recorded yet.
Show our season record and Alex's pitch log.
Correct Alex's pitch count in that game to 40; I missed two pitches.
```

Use `/paste` for multiline scorebooks, `/send` to submit, `/clear` to reset chat while
keeping stats, and `/exit` to leave. The agent asks about ambiguous names and missing
counts. It can save a final score or pitch count before the rest of the scorebook.

## Recorded data

- Each team ID identifies one team and season. Setup includes division and an explicit
  6-, 7-, or 9-inning ERA basis; this is a reporting setting, not eligibility enforcement.
- Roster entries have a stable player ID, display name, jersey number, and active status.
  Retiring or renaming a player preserves their stats. First names/nicknames work.
- Games have a stable ID, date, opponent, doubleheader game number, final score,
  scorebook source, and player lines. Only completed games are entered.
- Each player line can include complete batting, pitching, and/or fielding categories,
  plus an independently recorded pitch count. A category is `null` when unrecorded.
  Every count within a supplied category is required; missing counts are never filled
  with zero. Only include players who participated.
- Corrections replace the complete game using its current revision and a reason.
  Old versions remain accessible through `game_history`. Voiding removes a game from
  reports while preserving its history; a correction can restore it.

Batting fields: `AB`, `H`, `doubles`, `triples`, `HR`, `R`, `RBI`, `BB`, `HBP`, `SO`,
`SB`, `CS`, `SF`, `SH`, `CI` (catcher interference). Pitching: `outs`, `H`, `R`, `ER`,
`BB`, `HBP`, `SO`. Fielding: `PO`, `A`, `E`. Zero means known zero.

Season rates use summed counts. Reports include recorded-game coverage and preserve
undefined rates as `null`. IP uses baseball notation: seven outs is `2.1`, meaning two
innings and one out. Display that as notation, never a decimal in calculations.

Formula references:

- AVG = H/AB; SLG = total bases/AB. [MLB glossary](https://www.mlb.com/glossary/standard-stats/slugging-percentage).
- OBP = (H+BB+HBP)/(AB+BB+HBP+SF). [MLB glossary](https://www.mlb.com/glossary/standard-stats/on-base-percentage).
- WHIP = (BB+H)/(outs/3). [MLB glossary](https://www.mlb.com/glossary/standard-stats/walks-and-hits-per-inning-pitched).
- ERA = ER × configured innings/(outs/3); MLB uses nine. [MLB glossary](https://www.mlb.com/glossary/standard-stats/earned-run-average).

OPS = OBP+SLG; fielding percentage = (PO+A)/(PO+A+E). Plate appearances include
AB, BB, HBP, SF, SH, and CI. Saved counts reflect the scorer's attribution; video
observations do not adjudicate errors or earned runs.

## Reports and exports

Use `list_teams` in chat to see saved IDs. JSON and CSV reports also work without a model:

```sh
bun start --report owls-2026
bun start --export owls-2026 > season.csv
```

CSV contains player summaries, opportunity counts, and coverage; blank cells mean
unrecorded/undefined. Chat reports can filter by inclusive start/end dates. Pitch logs
include recorded game dates and counts. They do not calculate legal pitching eligibility
or required rest, including workload for other teams.

Data files under `data/` are excluded from Git. Close the agent before copying the SQLite
file for backup. Chat messages and tool results go to the configured model provider;
local SQLite storage does not make chat inference local. Photos and sampled video frames
are sent to the selected vision provider. Source metadata and evidence hashes are retained
with drafts; the tracker does not copy images/video into its database. Reports and exports run locally.

Live streaming, spreadsheet imports, and GameChanger synchronization are not implemented.

## Use in code

```ts
import { createBaseballAgent } from "./src/agent.ts";

const baseball = createBaseballAgent(chatModel, {
  databasePath: "./team.sqlite",
});
try {
  console.log((await baseball.agent.chat("Show the saved teams")).content);
} finally {
  baseball.close();
}
```

For deterministic integrations, import `BaseballStore` from `src/store.ts`; its methods
validate the same inputs as the agent tools. `scripts/demo.ts` contains a full example
scorebook entry. No external database service or embedding model is needed.

## Verify

```sh
bun test
bun run typecheck
bun run demo
```

Tests use synthetic data and injected inference to exercise real tool calls, formulas,
persistence, stale edits, game history, missing data, exports, image transport, and
vision cancellation without credentials. Video tests exercise the actual FFmpeg decoder,
timestamp evidence, overlapping windows, duplicate handling, partial checkpoints, and
model isolation; decoder tests skip when FFmpeg is absent.
