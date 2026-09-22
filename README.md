# Example Agents (di-framework)

A collection of example agents built with di-framework for practical, interactive workflows.

| Agent                                           | Description                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Legal](agents/legal/README.md)                 | Organizes case information, researches legal issues, checks sources, and prepares research briefs.                                                |
| [ML Researcher](agents/ml-researcher/README.md) | Researches and implements changes in di-framework-ml and di-framework; builds and evaluates bounded ONNX models from natural-language objectives. |
| [Baseball](agents/baseball/README.md)           | AI spectator that records finished files or OBS live streams (RTSP/RTMP) into a durable log; pluggable enhancers refine it.                        |

The agents share [`@di-framework/tui`](packages/tui/README.md), an Ink interface adapted from gsio with Markdown output, editable input, cancellable requests, and a plain-text fallback for pipes. Run `bun run --cwd packages/tui demo` to try it without model credentials.
