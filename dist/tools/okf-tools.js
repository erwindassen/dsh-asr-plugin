import { defineTool, ToolArgsError, validateJsonSchemaValue, } from "@deepseek-ai/dsh-tools";
import { OkfError } from "../okf/contracts.js";
export const OKF_WRITE_PAGE_TOOL = "okf_write_page";
const WRITTEN_PAGE_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        relative_path: { type: "string", required: true },
        bytes: { type: "integer", required: true },
    },
};
const PARAMETERS = {
    path: { type: "string", required: true },
    content: { type: "string", required: true },
};
/** Reject unknown arguments instead of silently ignoring a typo. */
function strictTool(definition) {
    const parameters = { ...definition.parameters, additionalProperties: false };
    const execute = definition.execute.bind(definition);
    return {
        ...definition,
        parameters: parameters,
        async execute(args, exec) {
            const violations = validateJsonSchemaValue(parameters, args);
            if (violations.length > 0)
                throw new ToolArgsError(violations);
            return execute(args, exec);
        },
    };
}
/**
 * The one write authority a summarising child agent has.
 *
 * The child runs in its own Session whose tool set carries no filesystem tools,
 * so without this it can only answer in prose — which is exactly how a
 * summarising run ended with zero pages and a "did not write this meeting's
 * page" failure. The write itself is validated and contained by the registry;
 * the tool only reports what happened, and never echoes page content back.
 */
function writePageTool(pages) {
    return strictTool(defineTool({
        name: OKF_WRITE_PAGE_TOOL,
        description: "Write one page of the Open Knowledge Format bundle you are summarising into. " +
            "`path` is bundle-relative and must stay inside meetings/, actions/, deadlines/, entities/, " +
            "concepts/ or sources/ (for example `meetings/2026-01-31-weekly-review.md`); index.md files and " +
            "references/ are owned by the plugin and are refused. `content` is the complete page, frontmatter " +
            "included. Call it once per page; never paste pages into your final answer.",
        parameters: PARAMETERS,
        output: {
            schema: WRITTEN_PAGE_SCHEMA,
            render: (_args, value) => [{
                    type: "text",
                    text: `Wrote ${value.relative_path} (${String(value.bytes)} bytes).`,
                }],
        },
        execute: async (args, exec) => {
            const session = exec.agent?.session.id;
            if (session === undefined) {
                throw new Error("okf_write_page only runs inside a summarising agent session");
            }
            try {
                const written = await pages.write(String(session), args.path, args.content);
                return { relative_path: written.relativePath, bytes: written.bytes };
            }
            catch (error) {
                // The agent can fix a bad path or an oversized page; give it the reason.
                if (error instanceof OkfError)
                    throw new Error(error.message, { cause: error });
                throw error;
            }
        },
    }));
}
export function registerOkfTools(context, deps) {
    context.tools.register(writePageTool(deps.pages));
}
//# sourceMappingURL=okf-tools.js.map