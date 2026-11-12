# Walk Me Through

Turn a concrete user action into an interactive walkthrough with the relevant code, example inputs and outputs, and state changes attached to every step.

A coding agent researches the workflow and writes a small JSON document. A Python builder validates references and embeds exact source snippets in a standalone HTML viewer. Playback follows the explanation; it does not execute the application.

## Try it

Requires Python 3.9 or later. No runtime packages, frontend build, server, or knowledge graph are required.

```sh
python3 skills/walk-me-through/scripts/build.py --root . --flow examples/how-it-works.json --output how-it-works.html
```

Open `how-it-works.html` in your browser. Choose a scenario, click steps, use Play/Back/Next, and switch between source code and example state.

## Use with a coding agent

The plugin includes Codex and Claude manifests. Point your host's local plugin loader at this directory, or load `skills/walk-me-through/SKILL.md` directly. For example:

> Use the walk-me-through skill to explain what happens when a user submits a review. Include the successful save and one meaningful failure path.

The skill describes the JSON format and how to generate a viewer for any project. This repository is the plugin source, not an installed host configuration.

For an existing walkthrough that has accumulated overlapping explanations, use the prototype consolidation skill:

> Use consolidate-walkthrough to reorganize this walkthrough and our follow-up answers. Keep the important examples and caveats, verify the current source, and write a separate consolidated copy.

Read `skills/consolidate-walkthrough/SKILL.md` directly, or use it through the plugin. It reuses the same JSON format and viewer, and distinguishes implemented changes from proposed or unverified behavior.

## Freshness

Click **Check source folder** and select the same project root used for `--root`. The viewer compares SHA256 hashes of the full referenced files, including uncommitted edits. Missing or changed files mark the explanation out of date.

Browsers offering live directory access recheck every 30 seconds while visible and when the tab regains focus. A standard folder picker provides one-time checks elsewhere: select the folder again after edits. Previews without browser hashing must be opened directly in a browser. Access is read-only; nothing is uploaded.

Matching hashes cover only referenced files. They do not prove the narrative, unreferenced dependencies, or runtime behavior remain correct. Review the explanation before regenerating after source changes.

## Checks

```sh
python3 skills/walk-me-through/scripts/test_build.py
```

Optional browser checks use an existing Playwright installation:

```sh
node skills/walk-me-through/scripts/test_freshness.cjs /absolute/path/to/node_modules/@playwright/test
```

The browser tests exercise real fixture-file edits through a stubbed directory handle and the real standard folder input. The native operating-system permission prompt requires manual interaction.
