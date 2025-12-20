import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

function fail(msg: string): never {
    process.stderr.write(`${msg}\n`)
    process.exit(1)
}

export type ChangelogEntry = {
    /** Normalized version (no leading "v"). */
    version: string
    /** The raw heading line that matched (e.g. `## [1.2.3] - 2025-01-01`). */
    heading: string
    /** The markdown body under the heading, trimmed. */
    body: string
}

export type ExtractChangelogEntryOptions = {
    /**
     * If true (default), removes HTML comments (`<!-- ... -->`) before parsing, so commented
     * sections are not accidentally returned.
     */
    stripHtmlComments?: boolean
    /**
     * If true (default), ignores SemVer build metadata (`+build.1`) when matching versions.
     * This helps match tags like `1.2.3+build.1` against headings like `## 1.2.3`.
     */
    ignoreBuildMetadata?: boolean
}

function stripBuildMetadata(v: string): string {
    const idx = v.indexOf('+')
    return idx === -1 ? v : v.slice(0, idx)
}

export function normalizeVersion(v: unknown, ignoreBuildMetadata = true): string | null {
    if (!v) return null
    const cleaned = String(v).trim().replace(/^refs\/tags\//, '').replace(/^v/i, '')
    return ignoreBuildMetadata ? stripBuildMetadata(cleaned) : cleaned
}

function normalizeMarkdown(md: string, stripHtmlComments: boolean): string {
    const normalized = md.replace(/\r\n/g, '\n')
    return stripHtmlComments ? normalized.replace(/<!--[\s\S]*?-->/g, '') : normalized
}

type Heading = { lineIndex: number; version: string; heading: string }

function findVersionHeadings(markdown: string, ignoreBuildMetadata: boolean): Heading[] {
    const lines = markdown.split('\n')

    // Match common formats like:
    // ## 1.2.3
    // ## v1.2.3
    // ## [1.2.3] - 2025-01-01
    // Also supports SemVer prerelease/build metadata:
    // ## 1.2.3-rc.1+build.7
    const headingRe =
        /^##\s*(?:\[)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)(?:\])?(?:\s+[-–—].*)?$/

    const headings: Heading[] = []
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(headingRe)
        const rawVer = m?.[1]
        if (!rawVer) continue
        const ver = normalizeVersion(rawVer, ignoreBuildMetadata)
        if (!ver) continue
        headings.push({ lineIndex: i, version: ver, heading: lines[i] })
    }
    return headings
}

/**
 * Extract a specific version's changelog entry.
 *
 * @param markdown Full changelog markdown
 * @param version Version to extract (accepts `v1.2.3` / `refs/tags/v1.2.3` / `1.2.3`)
 * @returns The entry, or `null` if not found.
 */
export function extractChangelogEntry(
    markdown: string,
    version: string,
    options: ExtractChangelogEntryOptions = {},
): ChangelogEntry | null {
    const strip = options.stripHtmlComments ?? true
    const ignoreBuild = options.ignoreBuildMetadata ?? true
    const md = normalizeMarkdown(markdown, strip)
    const wanted = normalizeVersion(version, ignoreBuild)
    if (!wanted) return null

    const headings = findVersionHeadings(md, ignoreBuild)
    if (headings.length === 0) return null

    const idx = headings.findIndex((h) => h.version === wanted)
    if (idx === -1) return null

    const lines = md.split('\n')
    const startLine = headings[idx].lineIndex + 1
    const endLine = headings[idx + 1]?.lineIndex ?? lines.length
    const body = lines.slice(startLine, endLine).join('\n').trim()

    return { version: headings[idx].version, heading: headings[idx].heading, body }
}

export function extractChangelogEntryBody(
    markdown: string,
    version: string,
    options: ExtractChangelogEntryOptions = {},
): string | null {
    return extractChangelogEntry(markdown, version, options)?.body ?? null
}

/**
 * Like `extractChangelogEntry`, but if the requested version isn't found, returns the latest entry.
 * This preserves the original behavior used for generating Docker label HTML.
 */
export function extractChangelogEntryOrLatest(
    markdown: string,
    versionWanted: string | null,
    options: ExtractChangelogEntryOptions = {},
): ChangelogEntry {
    const strip = options.stripHtmlComments ?? true
    const ignoreBuild = options.ignoreBuildMetadata ?? true
    const md = normalizeMarkdown(markdown, strip)

    const headings = findVersionHeadings(md, ignoreBuild)
    if (headings.length === 0) {
        fail('CHANGELOG.md: could not find any version headings like "## 1.2.3"')
    }

    let chosenIndex = 0
    if (versionWanted) {
        const wanted = normalizeVersion(versionWanted, ignoreBuild)
        if (wanted) {
            const idx = headings.findIndex((h) => h.version === wanted)
            if (idx !== -1) chosenIndex = idx
        }
    }

    const lines = md.split('\n')
    const startLine = headings[chosenIndex].lineIndex + 1
    const endLine = headings[chosenIndex + 1]?.lineIndex ?? lines.length
    const body = lines.slice(startLine, endLine).join('\n').trim()
    return {
        version: headings[chosenIndex].version,
        heading: headings[chosenIndex].heading,
        body: body.length ? body : 'No changelog entries.',
    }
}

export async function renderMarkdownToHtml(md: string): Promise<string> {
    const file = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeStringify)
        .process(md)

    return String(file)
}

export async function extractChangelogEntryHtml(
    markdown: string,
    version: string,
    options: ExtractChangelogEntryOptions = {},
): Promise<string | null> {
    const entry = extractChangelogEntry(markdown, version, options)
    if (!entry) return null
    const md = `${entry.heading}\n\n${entry.body}`.trim()
    return await renderMarkdownToHtml(md)
}

function findUp(startDir: string, filename: string): string | null {
    let dir = path.resolve(startDir)
    for (; ;) {
        const candidate = path.join(dir, filename)
        if (fs.existsSync(candidate)) return candidate

        const parent = path.dirname(dir)
        if (parent === dir) return null
        dir = parent
    }
}

function truncate(str: string, maxLen: number) {
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen - 3).trimEnd() + '...'
}

async function main() {
    const versionArg = normalizeVersion(process.argv[2])
    const changelogPath = findUp(process.cwd(), 'CHANGELOG.md')

    if (!changelogPath) {
        fail(
            `Missing CHANGELOG.md (searched upward from ${process.cwd()}). Add it so CI can set com.docker.extension.changelog.`,
        )
    }

    const raw = fs.readFileSync(changelogPath, 'utf-8')
    const entry = extractChangelogEntryOrLatest(raw, versionArg)
    const html = await renderMarkdownToHtml(`${entry.heading}\n\n${entry.body}`.trim())

    // Docker build args + Dockerfile LABEL quoting can't safely contain raw newlines or double-quotes.
    // Swap attribute quotes to single quotes to keep HTML valid.
    const safeOneLine = html.replace(/\r?\n/g, '').replace(/"/g, "'").trim()
    const capped = truncate(safeOneLine, 6000)
    process.stdout.write(capped)
}

// Only run CLI when invoked directly, not when imported as a module.
const isDirectInvocation =
    typeof process.argv[1] === 'string' && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectInvocation) {
    main().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        fail(msg)
    })
}
