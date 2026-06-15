---
name: docx-review-alignment
description: Use when aligning project Markdown documentation with feedback, comments, tracked changes, or annotations from a Word (.docx) design review.
---

# Docx Review Alignment (Word 评审修改与同步)

## Overview
This skill provides a structured workflow for synchronizing and aligning a design document's source Markdown (.md) files in the project with review feedback, comments, and tracked changes from a compiled Word (.docx) document after an architecture or design review.

## When to Use
- You have a Word (.docx) document (e.g., generated from the project's Markdown files) that has been returned with edits, comments (`w:comment`), or tracked changes (`w:ins`/`w:del`) from a design review.
- You need to systematically extract, organize, and catalog all review modification points.
- You need to compare the reviewed document's content with the project's source Markdown files, apply simple changes directly, and brainstorm/plan complex changes before editing.
- You want to update the project's Markdown files, verify the edits, and potentially re-export to Word for subsequent reviews.

### When NOT to Use
- For general writing or editing tasks without a reviewed Word document as input (use `chinese-writing-assistant` instead).
- For pure code refactoring unrelated to design documentation.

## Core Pattern
```
[Reviewed Word (.docx)] ──(Extract & Convert)──> [Review Markdown & Comments]
                                                        │
                                                        ▼
[Source Markdown (.md)] <──(Brainstorm & Edit)── [Compare & Catalog Points]
                                                        │
                                                        ▼
                                             [Updated Source Markdown]
```

## Implementation

### Stage 1: Extract Comments & Tracked Changes
Before modifying any files, read and analyze the reviewed `.docx` file using the `docx` skill tools to extract comments and changes:
1. **Extract raw text and tracked changes** using pandoc or by unpacking the `.docx`:
   ```bash
   pandoc --track-changes=all reviewed-document.docx -o reviewed-content.md
   ```
2. **Catalog all review comments and annotations**:
   Analyze comments and categorize them into:
   - **Simple Points** (e.g., typos, formatting, small phrasing tweaks, factual corrections): These can be modified directly.
   - **Complex Points** (e.g., structural changes, logic changes, architecture decisions, new scene flows): These require architectural brainstorming before editing.

### Stage 2: Convert & Diff
1. Convert the final reviewed `.docx` to a temporary Markdown file.
2. Run a diff between the newly converted Markdown and the project's existing source Markdown files to pinpoint exact insertion/modification locations.

### Stage 3: Brainstorming & Planning (头脑风暴)
**REQUIRED SUB-SKILL:** For any **Complex Points**, you MUST load the `brainstorming` skill first to design and analyze the changes:
1. **Explore Architect Intent**: Analyze the feedback's underlying intent, potential side effects, and architectural impact on related modules or scenes.
2. **Model Solutions**: Formulate and compare at least 2-3 options to address the architect's concerns.
3. **Write a Plan**: Create a clear, step-by-step editing plan containing the exact locations and content to be modified.

### Stage 4: Surgical Updates
1. Apply simple edits directly.
2. For complex changes, follow the brainstormed plan exactly, using the `edit` or `write` tools to update the project's source Markdown files.
3. Ensure the tone, style, and formatting mimic the surrounding sections exactly.

### Stage 5: Verification & Re-Export
1. Verify the integrity of the updated Markdown files (formatting, links, headings).
2. If requested, re-export the updated Markdown files back to a Word (.docx) document using pandoc/docx tools for a second round of review or final delivery.

## Common Mistakes
- **Overwriting blindly**: Overwriting large blocks of the source Markdown files with the converted Word text, which destroys formatting, metadata, and custom markdown ornaments (like mermaid diagrams, custom tables, or hidden comments).
- **Missing hidden comments**: Only looking at text changes and failing to extract and catalog the Word document's native comments (`w:comment`) and footnotes.
- **Skipping brainstorming**: Implementing complex architecture edits directly without running a brainstorming phase, leading to shallow fixes that violate the project's core architecture principles.
- **Disrupting sequence numbers**: Changing steps or scenes without renumbering all subsequent steps or updating related diagrams.
