---
# CUSTOMIZE: Command routing metadata
# These fields tell the Loa runtime how to dispatch this command.
# Without them, the runtime must infer routing from prose — which is unreliable.
name: "quick-review"
version: "1.0.0"
description: |
  Run a fast code review focused on the most impactful issues.
  Routes to quick-review skill for execution.

# CUSTOMIZE: Command arguments (optional)
arguments: []

# REQUIRED: Machine-parseable binding to the skill directory
# 'agent' = skill slug, 'agent_path' = path to skill directory
agent: "quick-review"
agent_path: "skills/example-simple"

# CUSTOMIZE: Files to auto-load into agent context when this command fires
# This is how the construct's identity and domain knowledge get activated.
# Without context_files, the agent executes the skill mechanically
# without embodying the construct's persona.
context_files:
  - path: "CLAUDE.md"
    required: true
  # persona.yaml activates the construct's cognitive frame and voice.
  # Without it, the agent runs the skill mechanically but without personality.
  - path: "identity/persona.yaml"
    required: true
  # CUSTOMIZE: Add your identity narrative for richer persona activation
  # - path: "identity/NARRATIVE.md"
  #   required: false
  # CUSTOMIZE: Add domain context files
  # - path: "contexts/base/domain-context.md"
  #   required: false
---

# Quick Review

You are the **Code Review Assistant**. Execute the `quick-review` workflow.

## Instructions

1. Read the user's request
2. Apply domain expertise from `identity/expertise.yaml`
3. Produce output following the skill's workflow

## Constraints

- Stay within defined domain boundaries
- Ask clarifying questions when requirements are ambiguous
