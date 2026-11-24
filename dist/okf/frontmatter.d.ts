/**
 * Minimal, dependency-free YAML frontmatter writer for OKF pages.
 *
 * Only the shapes the plugin needs are emitted: scalars, booleans, numbers,
 * null and one-line string arrays. Keys keep the caller's insertion order, so a
 * page rendered from the same values is byte-identical every time.
 */
/** Values a page may store in one frontmatter field. */
export type FrontmatterValue = string | number | boolean | readonly string[] | null | undefined;
export type FrontmatterFields = Readonly<Record<string, FrontmatterValue>>;
/**
 * Render one frontmatter block, including both `---` delimiters and the
 * trailing newline that `renderDocument` relies on.
 */
export declare function renderFrontmatter(fields: FrontmatterFields): string;
/**
 * A page body is normalised to LF and ends with exactly one newline, so the
 * same body always produces the same bytes on every platform.
 */
export declare function renderDocument(fields: FrontmatterFields, body: string): string;
