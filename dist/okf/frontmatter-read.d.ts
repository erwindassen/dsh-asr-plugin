/**
 * Reader for exactly the frontmatter subset `frontmatter.ts` writes.
 *
 * The plugin has no YAML dependency, so pages are parsed with this deliberately
 * narrow reader: `key: scalar`, `key: "quoted"`, and `key: [a, b]`. Unknown
 * lines are skipped instead of failing the whole page, because an agent may
 * author extra metadata the plugin does not need.
 */
export type ParsedFields = Readonly<Record<string, string | readonly string[]>>;
export interface ParsedFrontmatter {
    readonly fields: ParsedFields;
    readonly body: string;
}
/**
 * Parse a page into frontmatter fields and body.
 *
 * Without a complete `---` block the whole source is the body, which keeps
 * hand-written pages usable. Line endings are normalised to LF and the single
 * terminating newline is dropped, so `parse(renderDocument(fields, body))`
 * returns the original body.
 */
export declare function parseFrontmatter(source: string): ParsedFrontmatter;
