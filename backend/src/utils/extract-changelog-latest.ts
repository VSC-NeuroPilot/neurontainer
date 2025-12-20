/**
 * Small, dependency-free changelog parser utilities for extracting a *specific* version's entry
 * from `CHANGELOG.md`-style markdown.
 *
 * Supports common headings like:
 * - `## 1.2.3`
 * - `## v1.2.3`
 * - `## [1.2.3] - 2025-01-01`
 * - `## [v1.2.3] — 2025-01-01`
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

export type ChangelogEntry = {
    /** Normalized version (no leading "v"). */
    version: string;
    /** The raw heading line that matched (e.g. `## [1.2.3] - 2025-01-01`). */
    heading: string;
    /** The markdown body under the heading, trimmed. */
    body: string;
};

export type ExtractChangelogEntryOptions = {
    /**
     * If true (default), removes HTML comments (`<!-- ... -->`) before parsing, so commented
     * sections are not accidentally returned.
     */
    stripHtmlComments?: boolean;
    /**
     * If true (default), ignores SemVer build metadata (`+build.1`) when matching versions.
     * This helps match tags like `1.2.3+build.1` against headings like `## 1.2.3`.
     */
    ignoreBuildMetadata?: boolean;
};

function stripBuildMetadata(v: string): string {
    const idx = v.indexOf('+');
    return idx === -1 ? v : v.slice(0, idx);
}

function normalizeVersion(v: string, ignoreBuildMetadata: boolean): string {
    const cleaned = v.trim().replace(/^refs\/tags\//, '').replace(/^v/i, '');
    return ignoreBuildMetadata ? stripBuildMetadata(cleaned) : cleaned;
}

function normalizeMarkdown(md: string, stripHtmlComments: boolean): string {
    const normalized = md.replace(/\r\n/g, '\n');
    return stripHtmlComments ? normalized.replace(/<!--[\s\S]*?-->/g, '') : normalized;
}

type Heading = { lineIndex: number; version: string; heading: string };

function findVersionHeadings(markdown: string, ignoreBuildMetadata: boolean): Heading[] {
    const lines = markdown.split('\n');

    // Match common formats like:
    // ## 1.2.3
    // ## v1.2.3
    // ## [1.2.3] - 2025-01-01
    // Also supports SemVer prerelease/build metadata:
    // ## 1.2.3-rc.1+build.7
    const headingRe =
        /^##\s*(?:\[)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)(?:\])?(?:\s+[-–—].*)?$/;

    const headings: Heading[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(headingRe);
        const ver = m?.[1];
        if (!ver) continue;
        headings.push({ lineIndex: i, version: normalizeVersion(ver, ignoreBuildMetadata), heading: lines[i] });
    }
    return headings;
}

/**
 * Extract a specific version's changelog entry.
 *
 * @param markdown Full changelog markdown
 * @param version Version to extract (accepts `v1.2.3` or `1.2.3`)
 * @returns The entry, or `null` if not found.
 */
export function extractChangelogEntry(
    markdown: string,
    version: string,
    options: ExtractChangelogEntryOptions = {},
): ChangelogEntry | null {
    const strip = options.stripHtmlComments ?? true;
    const ignoreBuild = options.ignoreBuildMetadata ?? true;
    const md = normalizeMarkdown(markdown, strip);
    const wanted = normalizeVersion(version, ignoreBuild);

    const headings = findVersionHeadings(md, ignoreBuild);
    if (headings.length === 0) return null;

    const idx = headings.findIndex(h => h.version === wanted);
    if (idx === -1) return null;

    const lines = md.split('\n');
    const startLine = headings[idx].lineIndex + 1;
    const endLine = headings[idx + 1]?.lineIndex ?? lines.length;
    const body = lines.slice(startLine, endLine).join('\n').trim();

    return {
        version: headings[idx].version,
        heading: headings[idx].heading,
        body,
    };
}

/**
 * Convenience helper: returns only the markdown body for a version.
 */
export function extractChangelogEntryBody(
    markdown: string,
    version: string,
    options: ExtractChangelogEntryOptions = {},
): string | null {
    return extractChangelogEntry(markdown, version, options)?.body ?? null;
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
    const file = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeStringify)
        .process(markdown);

    return String(file);
}

/**
 * Extract a version entry and render it to sanitized HTML.
 *
 * The rendered HTML includes the version heading as an `<h2>` (via markdown `## ...`).
 */
export async function extractChangelogEntryHtml(
    markdown: string,
    version: string,
    options: ExtractChangelogEntryOptions = {},
): Promise<string | null> {
    const entry = extractChangelogEntry(markdown, version, options);
    if (!entry) return null;
    const md = `${entry.heading}\n\n${entry.body}`.trim();
    return await renderMarkdownToHtml(md);
}
