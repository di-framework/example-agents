# Recorded-video smoke test

Executed September 13, 2026 using the real `CodexVisionModel` through the locally
authenticated Codex CLI. This is one functional example, not an accuracy benchmark.
No source video, frames, or model output was supplied to the inference as text hints.
The model received sampled frames, timestamps, the extraction schema/instructions,
and previous unverified observations for the second window. It had no browsing or
stats tools and received no audio or official play-by-play.

## Source and reproduction

[MLB's Matt Olson highlight](https://baseballsavant.mlb.com/sporty-videos?playId=b8cacd37-2afb-3981-9207-b13a6a05f42a)
shows a solo home run against Houston on September 14, 2025. The downloadable playback
is published in [MLB's game content response](https://statsapi.mlb.com/api/v1/game/776329/content).

From `agents/baseball`, with FFmpeg installed and Codex signed in:

```sh
curl -fL 'https://mlb-cuts-diamond.mlb.com/FORGE/2025/2025-09/14/4b8992cf-e22864bf-a0b79bb1-csvm-diamondgcp-asset_1280x720_59_4000K.mp4' -o /tmp/baseball-mlb-clip.mp4
bun start --video /tmp/baseball-mlb-clip.mp4 --duration all --output /tmp/baseball-mlb-plays.json
```

Input: 16,368,871 bytes, 31.147783 seconds, 1280×720. Sampling: 1 frame/second,
20-second windows with four-second overlap. Model: CLI default for the authenticated
account, not an explicitly pinned model ID. A different model/default may return
different observations. `VISION_MODEL` can select an available model explicitly.

## Observed output

| Check                   | Result                                                         |
| ----------------------- | -------------------------------------------------------------- |
| Source coverage         | 0–31.147783 seconds, two successful windows                    |
| Proposed outcome        | One solo home run, Matt Olson batting, Valdez pitching         |
| Scoreboard              | Houston 1, Atlanta 1; bottom of the first, one out             |
| Evidence                | Delivery/swing frames and the explicit home-run graphic        |
| First event interval    | 3.019683–19.035683 seconds, ID `v0-1`                          |
| Second window           | Continuation/replay linked to `v0-1`                           |
| Candidate counts        | `{"home_run": 1}`                                              |
| Missing observations    | Ball-strike count `null`; first window's base occupancy `null` |
| Saved game/player stats | None; output is a review-required draft                        |

The model warned that the ball's landing was not clearly visible in the sampled frames
and used the explicit broadcast graphic as evidence. A frame was inspected locally to
verify that the graphic is present. Replay detection in this example worked; it can
still fail on different footage.

## What remains unvalidated

This does not establish full-game accuracy, every-pitch coverage, ball tracking,
hit/error attribution, earned runs, roster identification across substitutions,
real-time throughput, or performance on youth games without broadcast graphics.
Testing should expand to walks, strikeouts, ordinary outs, baserunning, scoring
changes, commercial breaks, and longer broadcasts, using scorer-reviewed annotations.
Measure missed/extra events, duplicate events, wrong outcomes, and incorrect identities
separately before using video-derived stats without scorer review.
