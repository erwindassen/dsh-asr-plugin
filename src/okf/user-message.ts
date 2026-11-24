/**
 * Build the user turn a child agent accepts.
 *
 * The agent driver takes a fully identified {@link UserMessage}, whose factory
 * lives in `@deepseek-ai/dsh-llm`. That package is a peer of this plugin and is
 * therefore not installed beside it: plugin code may only import the
 * dependencies the package declares, so the module is imported for types and
 * the message is assembled here. The shape follows `createMessage` in
 * `@deepseek-ai/dsh-llm` — a fresh identifier, the exact content blocks and the
 * producer source, deep-frozen before publication.
 *
 * @module
 */

import { randomUUID } from "node:crypto";

import type { MessageId, UserMessage } from "@deepseek-ai/dsh-llm";

/** Freeze one value and every nested value, matching the frozen message contract. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

/**
 * Build one immutable user-role message carrying a single text block.
 *
 * @param text - the complete instruction the child agent should read.
 * @returns a detached, frozen user message with a fresh stable identity.
 */
export function userTextMessage(text: string): UserMessage {
  return deepFreeze({
    id: randomUUID() as MessageId,
    role: "user",
    content: [{ type: "text", text }],
    source: { kind: "user" },
  }) as UserMessage;
}
