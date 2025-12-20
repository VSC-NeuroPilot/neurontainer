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
};

function normalizeVersion(v: string): string {
    return v.trim().replace(/^refs\/tags\//, '').replace(/^v/i, '');
}

function normalizeMarkdown(md: string, stripHtmlComments: boolean): string {
    const normalized = md.replace(/\r\n/g, '\n');
    return stripHtmlComments ? normalized.replace(/<!--[\s\S]*?-->/g, '') : normalized;
}

type Heading = { lineIndex: number; version: string; heading: string };

function findVersionHeadings(markdown: string): Heading[] {
    const lines = markdown.split('\n');

    // Match common formats like:
    // ## 1.2.3
    // ## v1.2.3
    // ## [1.2.3] - 2025-01-01
    const headingRe = /^##\s*(?:\[)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\])?(?:\s+[-–—].*)?$/;

    const headings: Heading[] = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(headingRe);
        const ver = m?.[1];
        if (!ver) continue;
        headings.push({ lineIndex: i, version: normalizeVersion(ver), heading: lines[i] });
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
    const md = normalizeMarkdown(markdown, strip);
    const wanted = normalizeVersion(version);

    const headings = findVersionHeadings(md);
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
