---
name: consolidate-walkthrough
description: Reorganize an existing code walkthrough and accumulated follow-up answers into coherent learning paths. Use when explanations overlap, the scenario list has grown, or implementation changes have made earlier answers stale.
---

# Consolidate a Walkthrough

Produce an easier-to-follow explanation of what the reader now needs to understand. Reorganize the existing material instead of appending another scenario for each question. This skill edits explanation artifacts, not application behavior.

## Establish the evidence

Read the existing workflow JSON and relevant conversation. If only the generated HTML is available, its `flow-data` JSON contains the workflow and embedded source snapshots; extract that as input rather than hand-editing HTML.

Identify the reader's main question, the concrete action being explained, important misconceptions, and unresolved decisions. Treat the old narrative as claims to verify, not an authority. Read the referenced source and connected code needed to check sequence, guards, state changes and failure behavior.

Choose and state the source root and revision being explained. A fix on a PR branch is implemented there; that does not establish that it is deployed. Keep claims tied to their evidence: source reconstruction, illustrative example, measured test result, observed runtime behavior, or proposed change. Do not resolve conflicting claims by silently choosing one. Explain the uncertainty or narrow the claim.

## Reorganize around understanding

Choose a few distinct learning paths appropriate to the reader. For example: understand the system, follow one request, understand a change, and decide what comes next. This is a starting shape, not a required set or count.

- Put prerequisite product context and terminology before the code that depends on them.
- Fold answered questions into the relevant steps; retain a separate reference/Q&A path only when useful to the reader.
- Merge overlapping explanations and reuse shared steps across paths. Preserve useful inputs, outputs, examples and state changes rather than just shortening the text.
- Keep real authorization guards and meaningful failure paths. Preserve material caveats, tradeoffs, scope limits and unresolved questions when removing repetition.
- Explain before/after behavior where a change matters. Attach the actual implementation to implemented steps; attach current change sites to explicitly proposed steps. Do not present historical code as the current request path.
- Label conceptual or comparative paths as such. In runtime paths, disclose jumps between separate requests, background work, or unshown code.

Keep a short reconciliation note for the user: what was merged or removed, which claims changed status, and what remains unverified. Do not reproduce the conversation chronologically or make a chapter per follow-up.

## Build and check

Reuse the JSON schema and source-grounding rules in [Walk Me Through](../walk-me-through/SKILL.md). Use the existing viewer; consolidation alone does not require a new schema or navigation framework.

Write a separate `<name>.consolidated.json` and `<name>.consolidated.html` beside the original artifacts unless replacement was requested. Preserve the original for comparison. Build with the sibling skill's existing script:

```sh
python3 <plugin-root>/skills/walk-me-through/scripts/build.py --root <source-root> --flow <consolidated.json> --output <consolidated.html>
```

Check every resulting source range and scenario sequence. Verify that the reader's important questions still have clear answers and that implemented/tested/deployed/proposed distinctions survive the rewrite. Exercise scenario selection, step navigation and source/state tabs in a browser when available. A successful build or matching source hashes does not validate the narrative.

Share the consolidated HTML and the reconciliation note. Mention that it embeds source code, identify the source root for freshness checks, and state important verification limits. Do not install the plugin, change host configuration, or publish artifacts externally as part of consolidation unless requested.
