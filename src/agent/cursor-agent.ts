import {
  CursorAgent as SdkCursorAgent,
  type CursorAgentOptions,
  type InteractionUpdate,
  type ConversationTurn,
} from '@cursor-ai/january';
import type { SlopItem, Task, VerificationCommand } from '../types.js';

export { SdkCursorAgent as CursorAgent };
export type { CursorAgentOptions, InteractionUpdate, ConversationTurn };

export function createAgent(options: CursorAgentOptions): SdkCursorAgent {
  return new SdkCursorAgent(options);
}

const SLOP_PATTERNS = `
1. **Extra Comments** (category: extra-comments)
   - Comments that state the obvious or repeat what the code says
   - Comments with emojis like \`// 🔥 Fire the event\` or \`// ✨ Magic happens here\`
   - Comments that just restate the function name: \`// Call the stop function\` before \`stop();\`
   - Misleading comments like \`// Optional: send email\` for code that always runs
   - Comments inconsistent with the file's existing comment style

2. **Defensive Checks** (category: defensive-checks)
   - Extra try/catch blocks that are abnormal for that area of the codebase
   - Null/undefined checks for values that are already validated upstream
   - Defensive coding for impossible scenarios in trusted codepaths

3. **Any Casts** (category: any-cast)
   - TypeScript casts to \`any\` used to bypass type issues
   - Type assertions that hide real type problems

4. **Style Inconsistencies** (category: style-inconsistency)
   - Code style that doesn't match the rest of the file
   - Emojis in console.log statements
   - Naming conventions that differ from surrounding code
   - Over-engineering: unnecessarily complex code for trivial operations

5. **Generated Documentation** (category: generated-docs)
   - Markdown files with obvious AI-generated content
   - Overly formal language, generic boilerplate structure
   - Unrequested files like ARCHITECTURE.md, CONTRIBUTING.md with generic AI content
   - NOTE: Well-written READMEs are fine - only flag clearly AI-generated slop

6. **Reinventing the Wheel** (category: reinventing-wheel)
   - New helper functions when equivalent ones already exist in the codebase
   - Custom implementations of patterns already solved elsewhere in the code

7. **UI Slop** (category: ui-slop) [HINT ONLY - do not auto-fix]
   - Start Case text in UI strings: "Input Your Password", "Choose Username"
   - Emojis in UI text or labels
   - NOTE: This is detection-only. Flag for human review, do not attempt to fix.
`;

export function generateSlopDetectionPrompt(findingsPath: string, learningsContext?: string): string {
  let prompt = `Analyze the codebase and identify AI-generated slop that should be removed.

Look for these specific patterns:
${SLOP_PATTERNS}
`;

  if (learningsContext) {
    prompt += `
${learningsContext}
`;
  }

  prompt += `
After analyzing, write your findings to: ${findingsPath}

Use this exact markdown format:

\`\`\`markdown
# Deslop Scan Results

## Issues Found

### 1. [HIGH] Title of the issue
- **File:** path/to/file.ts
- **Line:** 42
- **Category:** defensive-checks
- **Description:** Explanation of what's wrong and why it should be removed

### 2. [MEDIUM] Another issue title
- **File:** path/to/other.ts
- **Line:** 15
- **Category:** extra-comments
- **Description:** Comment restates what the code already shows
\`\`\`

Rules:
- Use [HIGH], [MEDIUM], or [LOW] for severity
- Category must be one of: extra-comments, defensive-checks, any-cast, style-inconsistency, generated-docs, reinventing-wheel, ui-slop
- Write ONLY to the specified file, no other output needed
- If no issues found, write "## No Issues Found" in the file`;

  return prompt;
}

export function generateCodeReviewPrompt(reviewPath: string): string {
  return `Review the code changes that were just made in this codebase.

Look for:
- Incomplete fixes (partial changes that need follow-up)
- New issues introduced by the fixes
- Opportunities for further improvement
- Style inconsistencies with the rest of the codebase
- Any remaining AI slop patterns

After reviewing, write your findings to: ${reviewPath}

Use this exact markdown format:

\`\`\`markdown
# Deslop Review Results

## Suggestions

### 1. [HIGH] Title of suggestion
- **File:** path/to/file.ts
- **Line:** 42
- **Description:** Detailed explanation of what should be improved

### 2. [MEDIUM] Another suggestion
- **File:** path/to/other.ts
- **Line:** 15
- **Description:** What could be better
\`\`\`

If the code looks good and no improvements are needed, write:
\`\`\`markdown
# Deslop Review Results

## No Suggestions

The code changes look good. No further improvements needed.
\`\`\``;
}

export function generateTasksForSlopItem(item: SlopItem): Task[] {
  return [{
    id: `task-${item.id}`,
    title: `Fix: ${item.title}`,
    description: item.description,
    status: 'pending',
    file: item.file,
    slopItemId: item.id,
  }];
}

export function generateFixPrompt(item: SlopItem): string {
  const locationInfo = item.line ? ` around line ${item.line}` : '';

  return `Fix the following AI slop issue in ${item.file}${locationInfo}:

Issue: ${item.title}
Category: ${item.category}
Description: ${item.description}

Instructions:
- Remove or simplify the problematic code
- Make minimal changes - only fix this specific issue
- Ensure the code still works correctly after the fix
- Match the style of the surrounding code`;
}

export function generateVerificationFixPrompt(
  failedCommand: VerificationCommand,
  output: string,
  attempt: number
): string {
  return `A verification command failed after code changes were applied. Fix the issues.

Command: ${failedCommand.command}
Exit Code: ${failedCommand.exitCode ?? 'unknown'}
Attempt: ${attempt}

Error Output:
\`\`\`
${output}
\`\`\`

Instructions:
- Analyze the error output to understand what went wrong
- Fix the code issues that are causing the failure
- Do NOT modify test expectations unless the new behavior is clearly correct
- Make minimal changes to fix the specific error
- The goal is to make the verification command pass

Focus on fixing actual code bugs, not working around test failures.`;
}
