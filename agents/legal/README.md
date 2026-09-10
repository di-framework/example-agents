# Legal agent

A case research agent built with di-framework. Fill in the facts, walk through a
short workflow, and get a sourced brief.

## Setup

Sign in with Codex (`codex login`), then from this directory:

```sh
bun install
bun start
```

Put what you know in `case-data/README.md`. Leave unknowns as `UNKNOWN`.

## Workflow

Work stage by stage at the prompt:

`/intake` → `/timeline` → `/issues` → `/gaps` → `/research` → `/verify` → `/brief`

Ask ordinary questions between stages. Outputs land under
`legal-references/{STATE}/`. Type `/help` for commands, `/exit` when done.

## Use in code

```ts
import { createChatModel } from '@di-framework/ai';
import { createLegalAgent } from './src/agent.ts';

const legal = await createLegalAgent(
  createChatModel({ provider: 'openai', auth: 'subscription' }),
);
try {
  console.log((await legal.agent.chat('/intake')).content);
} finally {
  await legal.close();
}
```

## Verify

```sh
bun test
bun run typecheck
```
