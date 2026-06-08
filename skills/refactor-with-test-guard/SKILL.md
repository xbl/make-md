---
name: refactor-with-test-guard
description: Use when changing internal structure for an existing feature and behavior must stay the same. Trigger when the task is described as refactoring, cleanup, extraction, simplification, or reorganization of working code.
---

# Refactor With Test Guard

Refactoring without behavior coverage is guesswork.

This skill forces the sequence:
1. identify current behavior
2. confirm tests already protect it
3. add missing tests first
4. refactor only after coverage is green
5. rerun the relevant tests after the refactor

## When To Use

Use this before any task that changes structure without intending to change behavior, including:
- extracting helpers, modules, or components
- renaming or moving logic
- deduplicating code paths
- simplifying conditionals or state flow
- reorganizing files, folders, or ownership boundaries

Do not use this when the task is primarily a new feature or an intended behavior change. In those cases, use normal TDD for the new behavior first.

## Required Workflow

### 1. Define the refactor boundary

State what behavior must remain unchanged.
List the files, commands, or user flows affected.

If you cannot state the preserved behavior clearly, stop and understand the feature first.

### 2. Check existing protection

Search for the narrowest existing tests that already cover that behavior.

Look for:
- unit tests around the touched module
- component tests covering the affected interaction
- e2e tests if the behavior only exists at workflow level

If tests exist, confirm they are the right tests rather than merely touching nearby code.

### 3. Fill the gap before refactoring

If coverage is missing or weak, add tests first.

Rules:
- Prefer the narrowest test that proves the behavior
- Test observable behavior, not implementation details
- Run the new or targeted test before refactoring
- If fixing a bug discovered during setup, follow full TDD first

No structural refactor starts until the relevant tests are passing and trusted.

### 4. Perform the refactor

Only after behavior is protected:
- make the smallest structural move that improves the code
- avoid incidental behavior changes
- keep each step reviewable

If the refactor reveals behavior ambiguity, stop and resolve that with tests before proceeding further.

### 5. Re-run validation after refactor

Run the same targeted tests again after the refactor.
Then run any adjacent validation needed for confidence, such as:
- related unit suites
- typecheck
- lint
- focused e2e coverage for integration-heavy paths

Do not claim success unless the post-refactor validation passed.

## Decision Rules

- Existing good test coverage: reuse it and refactor
- Partial or indirect coverage: add one or more focused tests, then refactor
- No reliable coverage: write tests first, verify them, then refactor
- Intended behavior change discovered: stop calling it a refactor and switch to feature or bugfix TDD

## Anti-Patterns

Do not:
- refactor first and promise to test later
- rely on manual clicking as the only protection
- treat snapshot churn as behavior coverage
- rewrite tests to match accidental behavior drift without proving intent
- widen scope from cleanup into redesign unless the task is explicitly re-scoped

## Completion Checklist

- Preserved behavior was named explicitly
- Relevant existing tests were identified, or missing ones were added first
- Targeted tests passed before the refactor
- Structural changes were made without intentional behavior changes
- Targeted tests were rerun after the refactor
- Any broader validation needed for confidence also passed

## Output Shape

When using this skill, report:
- what behavior was protected
- whether tests already existed or were added first
- what was refactored
- which post-refactor checks passed
