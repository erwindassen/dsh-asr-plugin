import { describe, expect, it } from "vitest";
import { createUserMessage } from "@deepseek-ai/dsh-llm";

import { userTextMessage } from "../../src/okf/user-message.js";

/**
 * The plugin builds its own user message because `@deepseek-ai/dsh-llm` is a
 * peer that is not installed beside the plugin at runtime. These tests keep the
 * local shape identical to the package factory instead of trusting it.
 */
describe("userTextMessage", () => {
  it("matches the message the LLM package builds for the same input", () => {
    const text = "Summarise the meeting into references/transcripts/abc.md";
    const expected = createUserMessage({ content: [{ type: "text", text }], source: { kind: "user" } });
    const actual = userTextMessage(text);

    expect({ ...actual, id: "ignored" }).toEqual({ ...expected, id: "ignored" });
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  });

  it("carries a fresh identifier per message", () => {
    const first = userTextMessage("a");
    const second = userTextMessage("b");

    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
    expect(first.id).not.toBe(second.id);
  });

  it("publishes an immutable message", () => {
    const message = userTextMessage("hello");

    expect(Object.isFrozen(message)).toBe(true);
    expect(Object.isFrozen(message.content)).toBe(true);
    expect(Object.isFrozen(message.content[0])).toBe(true);
    expect(Object.isFrozen(message.source)).toBe(true);
  });

  it("keeps the instruction text as one text block with the user source", () => {
    const message = userTextMessage("only this");

    expect(message.role).toBe("user");
    expect(message.source).toEqual({ kind: "user" });
    expect(message.content).toHaveLength(1);
    expect(message.content[0]).toEqual({ type: "text", text: "only this" });
  });
});
