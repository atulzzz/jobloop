# JobLoop Project Instructions

## Dual Goal

JobLoop has two equally important goals:

1. Become a genuinely useful job-search tool.
2. Give the project owner credible, explainable, interview-ready AI Agent
   engineering experience.

Do not optimize only for shipping speed. Preserve opportunities for the owner
to design, write, debug, test, commit, demo, and explain important code.

## Owner Profile

- Frontend engineer with React, React Native, TypeScript, Node.js and complex
  workflow-platform experience.
- Uses AI coding tools as part of the normal development process.
- Should not handwrite every line, but must own the core Agent and domain logic.

## Required Hands-On Work

The project owner should personally implement or substantially rewrite:

- JobPosting model and the first recruitment-site adapter.
- Missing-field and unreadable-salary handling.
- Minimal Agent Loop and tool-result handling.
- At least one MCP tool.
- Deterministic job-scoring logic.
- Application state transitions and idempotency.
- Interview turn and voice-to-text integration boundary.

AI can implement surrounding infrastructure, UI, styling, CRUD, fixtures,
documentation and test scaffolding.

## Collaboration Protocol

For each hands-on module:

1. The AI writes acceptance criteria, fixtures and failing tests.
2. The owner writes the first implementation.
3. The owner runs the tests and debugs obvious failures.
4. The AI reviews and explains boundary, security and maintainability issues.
5. The owner makes or approves the final critical change.
6. The AI completes surrounding engineering work.
7. The owner commits the accepted slice and records what they learned.

Before the owner has attempted a required module, do not replace the exercise
with a complete AI implementation unless the owner explicitly asks for that.

## Evidence for Resume and Interviews

Maintain evidence for:

- The owner's architecture and product decisions.
- The owner's manual code commits.
- Important bugs and root causes.
- Tests and acceptance results.
- Trade-offs involving tools, MCP, IPC, context, approval and recovery.

Resume statements must match actual ownership. If the owner only directed AI
implementation, describe AI-assisted implementation rather than independent
development of the core modules.

Do not invent metrics, employment, responsibility or provenance.

## Current Status

- D1 technical feasibility: completed and accepted.
- D2 application shell and IPC hardening: completed and accepted.
- D3 JobPosting and BOSS detail/search adapters: completed and accepted.
- Next effective slice: editable job confirmation form, salary/field correction,
  and replacing the read-only structured card with a clear review workflow.
