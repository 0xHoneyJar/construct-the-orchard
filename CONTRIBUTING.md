# Contributing

Thank you for contributing to this construct.

## Structure

```
construct.yaml              # Manifest — skills, commands, metadata
identity/
  persona.yaml              # Cognitive frame and voice
  expertise.yaml            # Domain knowledge and boundaries
  NARRATIVE.md              # Identity narrative (prose, for L2 publishing)
skills/                     # Skill implementations
  <skill-name>/
    index.yaml              # Metadata, triggers, capability routing hints
    SKILL.md                # Instructions and workflow
commands/                   # Slash command files with routing frontmatter
scripts/                    # Executable scripts invoked by skills
  MANIFEST.yaml             # Machine-readable tool declarations (agent discovery)
  lib/
    construct-runtime.ts    # Shared utilities (credentials, output, progress)
  install.sh                # Post-install hook
schemas/                    # Validation schemas
contexts/                   # Domain context files (optional)
```

## Adding a Skill

1. Create the skill directory: `skills/my-skill/`

2. Define metadata in `skills/my-skill/index.yaml`:
   ```yaml
   slug: my-skill
   name: "My Skill"

   # Use "Use this skill IF..." for routing clarity
   description: |
     Use this skill IF user invokes `/my-command` OR needs [what it does].
     Produces artifacts to [output path].
   version: 1.0.0

   # Natural language triggers for proactive routing
   # Without these, the skill only works via explicit /command
   triggers:
     - "/my-command"
     - "natural language phrase"
     - "another way users might ask"

   capabilities:
     model_tier: sonnet          # haiku | sonnet | opus
     danger_level: safe          # safe | moderate | high | critical
     effort_hint: small          # small | medium | large
     downgrade_allowed: true
     execution_hint: sequential  # parallel | sequential
     requires:
       native_runtime: false
       tool_calling: true
       thinking_traces: false
       vision: false
   ```

3. Write instructions in `skills/my-skill/SKILL.md`:
   - **Trigger** — how to invoke this skill
   - **Workflow** — step-by-step execution instructions
   - **Boundaries** — what the skill does NOT do

4. Register in `construct.yaml`:
   ```yaml
   skills:
     - slug: my-skill
       path: skills/my-skill
   ```

## Adding a Command

Commands are markdown files in `commands/` with **YAML frontmatter for routing**.

The frontmatter is how the Loa runtime reliably dispatches commands to skills. Without it, the runtime must infer routing from prose — which is non-deterministic and causes inconsistent invocation.

```yaml
---
name: "my-command"
version: "1.0.0"
description: |
  What this command does.
  Routes to my-skill for execution.

arguments:
  - name: "target"
    description: "What to operate on"
    required: false

# REQUIRED: Machine-parseable skill binding
agent: "my-skill"
agent_path: "skills/my-skill"

# Auto-load files into agent context on invocation
# This is how the construct's identity activates
context_files:
  - path: "CLAUDE.md"
    required: true
  - path: "identity/persona.yaml"
    required: true
  - path: "identity/NARRATIVE.md"
    required: false
---

# My Command

You are the **My Construct** agent. Execute the `my-skill` workflow.

## Instructions
...

## Constraints
...
```

### Key frontmatter fields

| Field | Required | Purpose |
|-------|----------|---------|
| `agent` | Yes | Skill slug to route to |
| `agent_path` | Yes | Path to skill directory |
| `context_files` | Recommended | Files to load into agent context (identity, domain knowledge) |
| `arguments` | Optional | Declared parameters |

Register in `construct.yaml`:
```yaml
commands:
  - name: my-command
    path: commands/my-command.md
```

## Adding Scripts

If your construct ships executable scripts (search tools, data pipelines, etc.), there are two concerns: **navigability** (how agents discover your scripts) and **I/O** (how scripts communicate with agents).

### Navigability — scripts/MANIFEST.yaml

Every construct that ships scripts should include a `scripts/MANIFEST.yaml` declaring what's available. This is the CLI equivalent of Anthropic's `input_schema` or MCP's `tools/list` — it lets agents discover your tools without reading source code.

```yaml
scripts:
  - name: my-search
    description: "Run grounded search for research sessions"
    entry: my-search.ts
    runtime: npx tsx
    args:
      - name: --query
        type: string
        required: true
        description: "The search topic"
    output:
      format: json
      fields:
        findings: "string — synthesized results"
        sources: "array of {title, url}"
    credentials:
      - name: MY_API_KEY
        required: true
    danger_level: safe
```

See `scripts/MANIFEST.yaml` for the full template with examples across TypeScript, Bash, and Python.

**Why this exists**: An agent landing in `scripts/` faces `.ts` and `.sh` files with no context. The manifest answers three questions every agent asks:
1. **What's here?** — script names and descriptions (routing)
2. **How do I call it?** — runtime, args, types (invocation)
3. **What comes back?** — output format, side effects, credentials needed (expectations)

This maps directly to how every major AI firm structures tool calling:

| Our manifest field | Anthropic equivalent | OpenAI equivalent | MCP equivalent |
|-------------------|---------------------|-------------------|----------------|
| `name` + `description` | `tool.name` + `tool.description` | `function.name` + `function.description` | `tool.name` + `tool.description` |
| `args` | `tool.input_schema` | `function.parameters` | `tool.inputSchema` |
| `output.format` + `output.fields` | `tool_result` content | function return value | `tool.outputSchema` |
| `danger_level` | (system prompt) | (not formalized) | `tool.annotations.destructiveHint` |
| `credentials` | (not formalized) | (not formalized) | (not formalized) |

### Self-description — --help

Scripts should support `--help` so agents can discover capabilities at runtime:

```
$ npx tsx scripts/my-search.ts --help
my-search — Run grounded search for research sessions

Usage: npx tsx scripts/my-search.ts --query <string> [--depth <int>] [--model <string>]

Arguments:
  --query    (required) The search topic
  --depth    (optional, default: 2) Number of search passes (0-4)
  --model    (optional) Override the default model

Output: JSON to stdout
Credentials: GEMINI_API_KEY (required)
```

This is not a prescription — implement it however fits your language. Python's `argparse` gives this for free. For TypeScript and Bash, see the reference implementations below.

### Symlink safety — NEVER assume SCRIPT_DIR is inside the project

When packs are installed via the global store (`~/.loa/constructs/packs/`), the local path at `.claude/constructs/packs/{slug}` is a **symlink**. Node.js resolves `import.meta.url` to the **real path**, so `SCRIPT_DIR` becomes `~/.loa/constructs/packs/{slug}/scripts/` — completely outside the project directory.

This breaks two common patterns:
- **`.env` walk-up**: walking up from `~/.loa/` never reaches the project root where `.env` lives
- **Pack detection**: `SCRIPT_DIR.indexOf(".claude/constructs/packs/")` returns `-1` on the real path

**Always use `construct-runtime.ts`** — it handles this correctly via `findProjectRoot(process.cwd())`. Never write your own `.env` walk-up from `SCRIPT_DIR`.

```
BROKEN:  import.meta.url → ~/.loa/constructs/packs/k-hole/scripts/ → walk up → ~/  (no .env)
CORRECT: process.cwd()   → find .git/.claude → project root → .env found
```

### I/O — Nakamoto protocol

| Output | Destination | Who reads it |
|--------|-------------|--------------|
| Structured result | **stdout** (JSON via `writeSync`) | Agent |
| Progress, retries, timing | **stderr** (`process.stderr.write`) | User terminal |
| Full reports, trails | **file** (`grimoires/{slug}/`) | Agent via Read tool |

Use the shared utility at `scripts/lib/construct-runtime.ts`:

```typescript
import { loadEnvFile, resolveCredential, resolveOutputDir, output, fatal } from "./lib/construct-runtime.ts";
import { dirname } from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// 1. Load credentials (symlink-safe: finds project root from cwd, then walks up)
loadEnvFile(SCRIPT_DIR);
const key = resolveCredential("MY_API_KEY");
if (!key) fatal("Missing MY_API_KEY", { hint: "Set it in .env or ~/.loa/credentials.json" });

// 2. Resolve output dir (symlink-safe: detects pack install via cwd project root)
const OUTPUT_DIR = resolveOutputDir(SCRIPT_DIR, "my-construct");

// 3. Do work, write progress to stderr
process.stderr.write("[my-tool] Running...\n");

// 4. One JSON output at exit
output({ result: "...", output_dir: OUTPUT_DIR });
```

### Reference implementations

| Language | Construct | Script | Pattern |
|----------|-----------|--------|---------|
| TypeScript | k-hole | `dig-search.ts` | Nakamoto stdout/stderr, .env cascade, JSON output |
| Bash | ruggy | `corpus-diff.sh` | `--help`, `--json`, unknown-flag catching, exit codes |
| Python | the-mint | `generate-gemstone.py` | argparse (auto `--help`), env var validation |

Reference: `docs/guides/script-conventions.md` in [loa-constructs](https://github.com/0xHoneyJar/loa-constructs).

### Invoking scripts from SKILL.md

Tell the agent explicitly — don't assume it will discover the script:
```markdown
CRITICAL: You MUST run the search script via Bash tool. Do NOT skip it.
npx tsx scripts/my-search.ts --query "<user's thread>"
```

## Adding Domain Context

For constructs with domain-specific knowledge (brand guides, research bases, platform rules), use a `contexts/` or `grimoires/` directory:

```
contexts/
  base/                     # Shared domain knowledge
    domain-rules.md
  overlays/                 # Project-specific overrides
    project-config.yaml
```

Reference these in command frontmatter via `context_files` so they load on invocation.

## Updating Identity

When expanding the construct's scope:

- Add new domains to `identity/expertise.yaml` with honest depth ratings (1-5)
- Update boundaries when the construct's refusal scope changes
- Update persona only if the construct's cognitive approach fundamentally shifts
- Add or update the identity narrative (`identity/*.md`) for publishing readiness

## Validation

CI runs on every push and PR. Validate locally:

```bash
yq eval '.' construct.yaml
yq eval '.' identity/persona.yaml
yq eval '.' identity/expertise.yaml
```

## Guidelines

- **One skill, one responsibility** — keep skills focused and composable
- **Capability metadata on every skill** — `model_tier`, `danger_level`, `effort_hint` enable intelligent routing
- **Triggers on every skill** — without them, the skill is invisible to natural language routing
- **Routing frontmatter on every command** — without `agent`/`agent_path`, invocation is non-deterministic
- **context_files for identity** — without them, the agent executes skills without the construct's persona
- **Document boundaries** — what a skill does NOT do is as important as what it does
- **Be honest about depth** — a depth-3 domain that's accurate is better than a depth-5 that overpromises
- **Write SKILL.md for experts** — specific inputs, outputs, edge cases, not vague descriptions
