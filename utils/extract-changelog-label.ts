import * as fs from 'node:fs'
import * as path from 'node:path'

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

function fail(msg: string): never {
    process.stderr.write(`${msg}\n`)
    process.exit(1)
}

function normalizeVersion(v: unknown): string | null {
    if (!v) return null
    return String(v).trim().replace(/^refs\/tags\//, '').replace(/^v/, '')
}

function extractSection(markdown: string, versionWanted: string | null) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n')

    // Match common formats like:
    // ## 1.2.3
    // ## v1.2.3
    // ## [1.2.3] - 2025-01-01
    const headingRe = /^##\s*(?:\[)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\])?(?:\s+[-–—].*)?$/

    const headings: Array<{ i: number; ver: string }> = []
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(headingRe)
        const ver = m?.[1]
        if (ver) headings.push({ i, ver })
    }

    if (headings.length === 0) {
        fail('CHANGELOG.md: could not find any version headings like "## 1.2.3"')
    }

    let chosenIndex = 0
    if (versionWanted) {
        const idx = headings.findIndex((h) => h.ver === versionWanted)
        if (idx !== -1) chosenIndex = idx
    }

    const startLine = headings[chosenIndex].i + 1
    const endLine = (headings[chosenIndex + 1]?.i ?? lines.length)
    const section = lines.slice(startLine, endLine).join('\n').trim()
    return section.length ? section : 'No changelog entries.'
}

async function renderMarkdownToHtml(md: string): Promise<string> {
    const file = await unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeStringify)
        .process(md)

    return String(file)
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
    const sectionMarkdown = extractSection(raw, versionArg)
    const html = await renderMarkdownToHtml(sectionMarkdown)

    // Docker build args + Dockerfile LABEL quoting can't safely contain raw newlines or double-quotes.
    // Swap attribute quotes to single quotes to keep HTML valid.
    const safeOneLine = html.replace(/\r?\n/g, '').replace(/"/g, "'").trim()
    const capped = truncate(safeOneLine, 6000)
    process.stdout.write(capped)
}

main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    fail(msg)
})
