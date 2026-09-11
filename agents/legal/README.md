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

## CourtListener search

The plugin starts the single-file CourtListener MCP at
`.agents/plugins/legal/mcp/caselaw.ts`. Semantic search uses DI Framework's
`S3VectorStore` with the private `courtlistener/modernbert-768` index in
`us-west-2`. Configure AWS credentials and install `uv`, then prepare local query inference:

```sh
# If using an AWS login profile, authenticate once with: aws login
bun .agents/plugins/legal/mcp/caselaw.ts --warmup
```

The first warmup downloads the Free Law Project embeddings model (about 600 MB) and its
Python inference runtime. Queries use the pinned model revision
`04f0141fbc045122439d28d51ba670f3091e9ed8`, its `search_query:` prefix, mean
pooling and normalization. Query text is embedded locally on CPU; only the vector
goes to AWS. The AWS SDK uses its default credential chain (environment, shared profiles,
login/SSO sessions, or workload roles). Search and object retrieval call the SDK
directly; they do not launch the AWS CLI. No separately running embedding server
is needed.

`semantic_search_opinions` returns matching chunks and current import coverage.
Use `get_opinion_chunk` with its opinion ID and chunk number for more text. Results
are incomplete while import runs; missing results do not establish absence of law.
Optional `opinion_id` filtering is available, but court/date metadata is not in
this index. Similarity scores do not establish legal authority or current validity.

The existing `search_opinions` and `get_opinion` tools use CourtListener's live
REST API and require `COURTLISTENER_API_TOKEN` in the server environment.

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
