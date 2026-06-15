---
name: tang
description: Use when reviewing, aligning, and revising architectural or high-level design documents (概要设计) to ensure strict scope management, pragmatic wording, and risk mitigation, especially after a "Tang" style review.
---

# Tang-Style Architecture Review & Alignment (唐式架构评审与防坑指南)

## Overview
This skill is a defensive documentation and scope-management methodology. It translates verbal and annotated review feedback (especially from a pragmatic, risk-aware reviewer like "唐老师") into concrete, conservative document edits. 

The core principle is **"No over-promising, no scope creep, and strict alignment with the contract/requirements."** 

## 概要设计编写基调 (Writing Tone & Baseline)
Based on the foundational review feedback, all architecture design documents MUST adhere to the following baseline tone and principles:

1. **务实求真 (Pragmatic & Realistic)**:
   - 概要设计的唯一目的是“解决具体问题”指导落地，绝不是为了推销项目、描绘宏大蓝图或重申立项时的“业务痛点”。
   - 凡是带有“画大饼”、“吹牛”性质的主观修饰词（如“端到端”、“全链路无死角”、“彻底颠覆”）必须统统删掉。
2. **绝对对齐发包范围 (Strict Contract Alignment)**:
   - 需求与功能范围必须 100% 和已确认的需求规格（需规/发包内容）对齐。
   - 如果某个功能在本期（Phase）不落地，必须明确标注 `[面向未来规划，不在本期落地]`，绝不能留有敞口给实施挖坑。
3. **精准的职责边界 (Defensive Boundaries)**:
   - **绝不越权**：不该本系统管的（如测试管理、业务审批流、复杂的 AP 数据分析），坚决不写或只写极弱的配合（如“仅提供0级原始数据”、“配合获取”）。
   - **技术中立**：在概要设计中不要出现过于具体的限制性技术导向词汇（如“低代码开发”应弱化为“表单配置”），避免后期技术选型被锁死引发违约风险。
4. **词汇降级与客观化 (De-escalation of Terminology)**:
   - 避免使用带有破坏性、对抗性或行内敏感定义的词汇。
   - 例：“剥离” -> “独立”；“质量门禁” -> “流程门禁”。

## Core Principles & Actionable Patterns

### 1. Scope Management (防挖坑 & 缩口子)
Never let the design document commit to features that are outside the current phase's contracted scope.
- **Pattern**: If a feature is a future plan, explicitly mark it as `[不在本期落地，属未来规划]` (Not in current phase, belongs to future planning).
- **Pattern**: If a feature isn't in the requirements specification (需规), delete it or flag it as a `[TODO: 需与需求方确认是否纳入本期]`.
- **Specifics**: Remove complex features that aren't core to the current delivery (e.g., "缺陷管理" (Defect Management), "报工" (Timesheet Reporting)).

### 2. Pragmatic Wording (去吹牛 & 务实)
Remove all subjective, absolute, or marketing-style language. High-level designs are for solving problems, not selling the project.
- **Remove**: "全链路" (Full-chain) -> Change to specific scopes like "交付版本链路" (Delivery version chain).
- **Remove**: "最终形成端到端的..." (Ultimately forming end-to-end...) -> Delete entirely.
- **Remove**: Broad complaints about "业务痛点" (Business pain points). A design document *solves* problems; it doesn't need to re-litigate the pain points that justified the project.

### 3. Clear Boundaries & Role Definition (定边界)
Ensure the system's role is strictly boxed into its actual capabilities.
- **Metrics (度量)**: Keep it extremely conservative. The system only provides "0级指标" (Level 0 metrics / raw data). It is a TP (transaction processing) system, not an AP (analytical processing) system. Complex charts and analytics go to a dedicated metrics platform.
- **Integration**: The unified platform is a "唯一入口" (Single Entry) via micro-frontends, not a monolith that subsumes all other tools.

### 4. Neutral & Safe Terminology (弱化贬义 & 规避敏感词)
- **Change**: "剥离" (Strip away / divorce) -> "独立" (Independent / Decoupled). Don't make it sound like the legacy system is being forcefully dismantled.
- **Change**: "质量门禁" (Quality Gate) -> "流程门禁" (Process Gate). Avoid using industry terms that have specific, heavily regulated meanings in the client's internal environment unless you are actually building that specific regulatory gate.
- **Remove**: Overly specific tech stacks like "低代码" (Low-code) in high-level feature descriptions. Use vague, contract-aligned terms like "表单配置" (Form configuration).
- **Remove**: "体验优化" (Experience Optimization) or "交互体验一致性设计" from the architecture overview. That belongs in detailed UI/UX design, not high-level architecture.

## Execution Strategy

When applying this skill to edit a document, use **Revision Mode** formatting to make the changes highly visible to the user:
- Use `<del>old text</del>` for deletions.
- Use `<ins>new text</ins>` for insertions.
- Use `> **[TODO / 评审确认]:** ...` blockquotes for areas where the reviewer noted a risk (e.g., "Inconsistent with requirements", "Check with Mr. Sheng").

### Step-by-Step Workflow
1. **Analyze**: Map the provided comments (from Word) and transcript feedback to the text.
2. **Brainstorm**: For complex points (like defining the boundary of "Metrics"), explicitly state the rationale before modifying.
3. **Execute**: Apply the `<del>` and `<ins>` tags to the Markdown document, or directly output Python scripts to manipulate docx XML via `docx-js`/`python lxml`. **Ensure the author of tracked changes is set correctly according to user instructions (e.g., 'xie').**
4. **Flag**: Add explicit TODOs for unresolvable external dependencies (e.g., "Need to check with Xue/Sheng").