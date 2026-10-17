/**
 * Reply Understanding Classifier
 * Implements prompts/classifier_system_prompt_v1.md and docs/05_REPLY_UNDERSTANDING.md
 * Includes the Kabir Rule, offline deterministic fallback, and LLM integrations.
 */

import type { ClassifierResult, ReplyIntent } from './types';

export const CLASSIFIER_SYSTEM_PROMPT = `You are an intelligent task coordinator assistant for student group projects.
Your job is to analyze a team member's reply regarding a specific assigned task and extract structured progress information.

### CONTEXT PROVIDED IN USER MESSAGE:
You will receive:
1. Task Details:
   - task_id: (e.g. "TASK-103")
   - title: (e.g. "Connect the payment API")
   - current_status: (e.g. "Pending" | "In Progress" | "Blocked" | "Complete")
   - due_date: (e.g. "2025-11-13")
   - owner_name: (e.g. "Kabir Patel")
2. Member Reply:
   - Raw text message sent by the member in chat.

---

### INTENT TAXONOMY:
Classify the message into EXACTLY ONE primary intent:
1. "completed": The task is 100% finished, tested, or merged.
2. "in_progress": Active work is underway with tangible forward momentum; no active blockers.
3. "blocked": Work cannot proceed because of an external dependency, missing credential, waiting on another teammate, or technical hurdle.
4. "delayed": The member explicitly states they have not started or will miss the due date, but without an external technical blocker (e.g., "studying for exams today, will start Friday").
5. "question": The member is asking for clarification, requirements, help, or guidance about the task.
6. "unrelated": The message is casual banter, off-topic chat, wrong group reply, or does not address the task.

---

### CRITICAL RULES (THE "KABIR RULE"):
1. PRIORITY OF BLOCKERS OVER PARTIAL WORK:
   If a member states they have made progress OR finished a part of the task, BUT they are currently waiting for external input, test credentials, approval, or another person's task (e.g. "connected, but waiting for test credentials", "code is written but I don't have AWS access", "finished the design but need Maya's feedback"), you MUST classify the intent as "blocked".
   - DO NOT mark it as "completed" or "in_progress".
   - Extract the exact impediment into the "blocker" field.

2. AMBIGUOUS REPLIES:
   If the reply is vague (e.g. "almost done", "making progress", "working on it"), assign intent "in_progress", but:
   - Set confidence <= 0.65.
   - Set "needs_followup": true.
   - Generate a brief, targeted "clarification_question" asking for estimated completion or what is left.

3. MULTI-TASK MENTIONS:
   If the member mentions multiple tasks, focus ONLY on the assigned task specified in the context. If they are talking about another task entirely, classify as "unrelated" or "question" with appropriate confidence.

4. CONFIDENCE THRESHOLD:
   - 0.90 - 1.0: Crystal clear explicit statement ("I merged the PR, it's done", "Blocked: waiting on API key").
   - 0.70 - 0.89: Clear implication from conversational wording ("Yeah wrapped that up an hour ago").
   - Below 0.70: Vague, conflicting, or incomplete information. Must set "needs_followup": true.

---

### OUTPUT FORMAT:
Output ONLY raw, valid JSON matching this schema:
{
  "task_id": "string",
  "intent": "completed" | "in_progress" | "blocked" | "delayed" | "question" | "unrelated",
  "progress_percent": integer (0 to 100, or null if unspecified),
  "blocker": "string describing blocker" | null,
  "needs_followup": boolean,
  "clarification_question": "string" | null,
  "confidence": float (0.0 to 1.0),
  "reasoning": "string (single concise sentence explaining the classification)"
}`;

export interface TaskContext {
  task_id: string;
  title: string;
  current_status?: string | null | undefined;
  due_date?: string | null | undefined;
  owner_name?: string | null | undefined;
  progress_percent?: number | null | undefined;
}

/**
 * Deterministic classifier implementing the Kabir Rule and edge cases.
 * Used as reliable fallback when offline, mocking, or handling high-confidence patterns.
 */
export function classifyReplyOffline(task: TaskContext, rawReply: string): ClassifierResult {
  const text = rawReply.trim().toLowerCase();
  const taskId = task.task_id;
  const currentProgress = task.progress_percent ?? 0;

  // 1. Explicit delays (exams, sickness, personal schedules)
  // Check this before generic blocker keywords like "can't" so that "can't get to this due to midterms" is delayed, not blocked.
  if (
    text.includes('exam') ||
    text.includes('midterm') ||
    text.includes('sick') ||
    text.includes('starting friday') ||
    text.includes('start friday') ||
    (text.includes('delay') && !text.includes('waiting for') && !text.includes('credentials'))
  ) {
    return {
      task_id: taskId,
      intent: 'delayed',
      progress_percent: currentProgress,
      blocker: null,
      needs_followup: false,
      clarification_question: null,
      confidence: 0.9,
      reasoning: 'Member communicated a schedule delay without an external technical blocker.',
    };
  }

  // 2. THE KABIR RULE: Priority of blockers over partial work
  // Matches clauses such as "waiting for...", "blocked by...", "stuck on...", "need credentials...", etc.
  const blockerMatch = rawReply.match(
    /(?:waiting for|blocked by|blocked on|stuck on|can(?:not|'t)\s+(?:proceed|continue|test)|unable to|no access to|need\s+credentials|need\s+access|need\s+api)\s+([^.!,;]+)/i,
  );
  const blockerKeywords = [
    'waiting for',
    'blocked by',
    'blocked on',
    'stuck on',
    'no access',
    'credentials',
    'credential',
    'missing api key',
  ];

  if (blockerMatch || blockerKeywords.some((w) => text.includes(w))) {
    let blockerText = blockerMatch ? blockerMatch[0].trim() : rawReply.trim();
    // Clean up trailing punctuation
    blockerText = blockerText.replace(/[.!,;]+$/, '').trim();
    // Estimate progress if partial work mentioned (e.g. "connected" => 75%)
    let progress = currentProgress;
    if (text.includes('connected') || text.includes('written') || text.includes('implemented') || text.includes('built')) {
      progress = Math.max(currentProgress, 75);
    }

    return {
      task_id: taskId,
      intent: 'blocked',
      progress_percent: progress,
      blocker: blockerText,
      needs_followup: false,
      clarification_question: null,
      confidence: 0.96,
      reasoning: 'Member reported blocker language that overrides partial progress (Kabir Rule).',
    };
  }

  // 3. Ambiguous replies ("almost done", "nearly done", "working on it") -> Confidence < 0.70 safeguard
  // MUST be checked BEFORE completion words because "almost done" contains "done"
  if (
    text.includes('almost done') ||
    text.includes('nearly done') ||
    text.includes('almost finished') ||
    text.includes('nearly finished') ||
    text.includes('working on it') ||
    text.includes('making progress') ||
    text === 'soon' ||
    text === 'nearly' ||
    text === 'almost'
  ) {
    return {
      task_id: taskId,
      intent: 'in_progress',
      progress_percent: Math.max(currentProgress, 75),
      blocker: null,
      needs_followup: true,
      clarification_question:
        'Great to hear! Are you planning to push that tonight, or do you need help wrapping it up?',
      confidence: 0.62,
      reasoning: 'Reply indicates forward progress but provides no concrete milestone (ambiguous safeguard).',
    };
  }

  // 4. Explicit completion signals
  const completionWords = ['complete', 'completed', 'finished', 'done', 'shipped', 'merged', 'pushed', 'resolved'];
  if (completionWords.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text))) {
    return {
      task_id: taskId,
      intent: 'completed',
      progress_percent: 100,
      blocker: null,
      needs_followup: false,
      clarification_question: null,
      confidence: 0.98,
      reasoning: 'Explicit completion signal confirmed.',
    };
  }

  // 5. Questions
  if (
    rawReply.includes('?') ||
    text.startsWith('how') ||
    text.startsWith('what') ||
    text.startsWith('should') ||
    text.startsWith('are we') ||
    text.startsWith('can we') ||
    text.startsWith('could we') ||
    text.startsWith('is there')
  ) {
    return {
      task_id: taskId,
      intent: 'question',
      progress_percent: currentProgress,
      blocker: null,
      needs_followup: true,
      clarification_question: "Got your question! I'll notify the team and flag this for discussion.",
      confidence: 0.85,
      reasoning: 'Member asked a clarifying question regarding the task requirements.',
    };
  }

  // 6. Active work signal
  if (text.includes('working') || text.includes('started') || text.includes('implementing') || text.includes('coding')) {
    return {
      task_id: taskId,
      intent: 'in_progress',
      progress_percent: Math.max(currentProgress, 50),
      blocker: null,
      needs_followup: false,
      clarification_question: null,
      confidence: 0.86,
      reasoning: 'Active work signal detected without blockers.',
    };
  }

  // 7. Unrelated or unparseable chatter
  return {
    task_id: taskId,
    intent: 'unrelated',
    progress_percent: currentProgress,
    blocker: null,
    needs_followup: true,
    clarification_question: `Could you share a quick status update on '${task.title}'? Are you on track or blocked?`,
    confidence: 0.45,
    reasoning: 'No reliable task progress signal identified.',
  };
}

/**
 * Call Anthropic Claude if configured
 */
async function callClaude(task: TaskContext, reply: string, apiKey: string): Promise<ClassifierResult> {
  const model = process.env['ANTHROPIC_MODEL'] || 'claude-3-5-haiku-latest';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Task Details:\n${JSON.stringify(task, null, 2)}\n\nMember Reply:\n"${reply}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error [${response.status}]: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as { content: [{ text: string }] };
  const rawText = data.content?.[0]?.text?.trim() ?? '{}';
  const cleanJson = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleanJson);
  parsed.task_id = task.task_id;
  return parsed as ClassifierResult;
}

/**
 * Call OpenAI if configured
 */
async function callOpenAI(task: TaskContext, reply: string, apiKey: string): Promise<ClassifierResult> {
  const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Task Details:\n${JSON.stringify(task, null, 2)}\n\nMember Reply:\n"${reply}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error [${response.status}]: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as { choices: [{ message: { content: string } }] };
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? '{}';
  const parsed = JSON.parse(rawText);
  parsed.task_id = task.task_id;
  return parsed as ClassifierResult;
}

/**
 * Main Classifier Function
 * Tries LLM if configured; automatically uses deterministic Kabir Rule on failure or offline.
 */
export async function classifyReply(task: TaskContext, rawReply: string): Promise<ClassifierResult> {
  const anthropicKey = process.env['ANTHROPIC_API_KEY']?.trim();
  const openaiKey = process.env['OPENAI_API_KEY']?.trim();
  const useMock = process.env['USE_MOCK_LLM']?.toLowerCase();

  // If mock mode is explicitly forced, use offline classifier immediately
  if (useMock === 'true' || useMock === '1' || useMock === 'yes') {
    return classifyReplyOffline(task, rawReply);
  }

  // The Kabir Rule is deliberately checked deterministically first for high reliability on key blocker phrases
  const text = rawReply.toLowerCase();
  if (text.includes('waiting for') || text.includes('blocked by') || text.includes('need credentials')) {
    return classifyReplyOffline(task, rawReply);
  }

  if (anthropicKey) {
    try {
      return await callClaude(task, rawReply, anthropicKey);
    } catch (err) {
      console.warn('Claude API call failed, using deterministic fallback:', err);
    }
  }

  if (openaiKey) {
    try {
      return await callOpenAI(task, rawReply, openaiKey);
    } catch (err) {
      console.warn('OpenAI API call failed, using deterministic fallback:', err);
    }
  }

  return classifyReplyOffline(task, rawReply);
}
