import { useState, useMemo, useCallback } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkBreaks from "remark-breaks"
import rehypeHighlight from "rehype-highlight"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import { CopyIcon, CheckIcon, CaretDownIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { remarkResourceLinks } from "@/lib/remark-resource-links"
import { MarkdownToc } from "./markdown-toc"
import { cn } from "@/lib/utils"
import type { Components } from "react-markdown"
import type { ResourceType } from "@/lib/resource-resolver"

type MarkdownMode = "full" | "inline"

interface MarkdownRendererProps {
  content: string
  mode?: MarkdownMode
  className?: string
}

const MAX_COLLAPSED_LINES = 20
const COLLAPSED_SHOW_LINES = 10

/** Resource link component rendered from our custom remark plugin. */
function ResourceLinkElement({
  href,
  label,
}: {
  resourceType: ResourceType
  href: string
  label: string
}) {
  return (
    <Link
      to={href}
      className="inline-flex items-center gap-1 rounded-none border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-heading text-primary transition-colors hover:opacity-80"
    >
      {label}
    </Link>
  )
}

/** Code block with copy, language tag, line numbers, and collapse. */
function CodeBlock({
  className,
  children,
  mode,
}: {
  className?: string
  children: React.ReactNode
  mode: MarkdownMode
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const language = className?.replace("language-", "") ?? ""
  const code = String(children).replace(/\n$/, "")
  const lines = code.split("\n")
  const isLong = lines.length > MAX_COLLAPSED_LINES
  const shouldCollapse = isLong && !expanded

  const displayCode = shouldCollapse
    ? lines.slice(0, COLLAPSED_SHOW_LINES).join("\n")
    : code

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="group/code relative my-2 border border-border bg-card">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        {language && (
          <span className="font-heading text-[10px] text-muted-foreground">
            {language}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-5 gap-1 px-1.5 text-[10px] opacity-0 transition-opacity group-hover/code:opacity-100 md:opacity-0"
        >
          {copied ? (
            <>
              <CheckIcon size={10} />
              {t("common.copied")}
            </>
          ) : (
            <>
              <CopyIcon size={10} />
              {t("common.copy")}
            </>
          )}
        </Button>
      </div>

      {/* Code content */}
      <div
        className={cn(
          "overflow-x-auto p-3 font-mono text-[13px] leading-relaxed",
          mode === "inline" && "max-h-[200px] overflow-y-auto",
        )}
      >
        <pre className="m-0">
          <code className={className}>
            {mode === "full" && lines.length > 1 ? (
              // Line numbers in full mode
              <table className="border-collapse">
                <tbody>
                  {(shouldCollapse ? lines.slice(0, COLLAPSED_SHOW_LINES) : lines).map(
                    (line, i) => (
                      <tr key={i}>
                        <td className="select-none pr-4 text-right text-[10px] text-muted-foreground/50 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="whitespace-pre">{line}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : (
              displayCode
            )}
          </code>
        </pre>
      </div>

      {/* Expand button for long blocks */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-1.5 font-heading text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <CaretDownIcon
            size={10}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
          {expanded
            ? t("markdown.show_less")
            : t("markdown.show_more_lines", { count: lines.length - COLLAPSED_SHOW_LINES })}
        </button>
      )}
    </div>
  )
}

/**
 * Markdown renderer with two modes:
 * - "full": document mode with TOC, line numbers, heading anchors
 * - "inline": compact mode for chat, comments, pins
 */
export function MarkdownRenderer({
  content,
  mode = "full",
  className,
}: MarkdownRendererProps) {
  const remarkPlugins = useMemo(
    () => [
      remarkGfm,
      remarkMath,
      ...(mode === "inline" ? [remarkBreaks] : []),
      remarkResourceLinks,
    ],
    [mode],
  )

  const rehypePlugins = useMemo(
    () => [
      rehypeHighlight,
      ...(mode === "full"
        ? [rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }] as [typeof rehypeAutolinkHeadings, { behavior: string }]]
        : []),
    ],
    [mode],
  )

  const components: Partial<Components> = useMemo(
    () => ({
      // Custom code blocks
      code({ className: codeClassName, children, ...props }) {
        // CheckIcon if it's a code block (not inline)
        const isBlock =
          props.node?.position?.start.line !== props.node?.position?.end.line ||
          String(children).includes("\n")

        if (isBlock) {
          return (
            <CodeBlock className={codeClassName} mode={mode}>
              {children}
            </CodeBlock>
          )
        }

        return (
          <code
            className={cn(
              "rounded-none border border-border bg-card px-1 py-0.5 font-mono text-[13px]",
              codeClassName,
            )}
            {...props}
          >
            {children}
          </code>
        )
      },

      // Pre tag handled by code block
      pre({ children }) {
        return <>{children}</>
      },

      // Custom resource-link element from our remark plugin
      "resource-link": ({
        resourceType,
        href,
        label,
      }: {
        resourceType: ResourceType
        href: string
        label: string
      }) => (
        <ResourceLinkElement
          resourceType={resourceType}
          href={href}
          label={label}
        />
      ),

      // Tables
      table({ children }) {
        return (
          <div className="my-4 overflow-x-auto">
            <table className="w-full border-collapse border border-border text-sm">
              {children}
            </table>
          </div>
        )
      },
      thead({ children }) {
        return (
          <thead className="bg-muted/30 font-heading text-xs uppercase">
            {children}
          </thead>
        )
      },
      th({ children }) {
        return (
          <th className="border border-border px-3 py-2 text-left font-medium">
            {children}
          </th>
        )
      },
      td({ children }) {
        return <td className="border border-border px-3 py-2">{children}</td>
      },

      // Headings with proper sizing per mode
      h1({ children }) {
        return (
          <h1
            className={cn(
              "font-heading font-bold",
              mode === "full" ? "mb-4 mt-8 text-2xl" : "mb-2 mt-4 text-base",
            )}
          >
            {children}
          </h1>
        )
      },
      h2({ children }) {
        return (
          <h2
            className={cn(
              "font-heading font-bold",
              mode === "full" ? "mb-3 mt-6 text-xl" : "mb-2 mt-3 text-[15px]",
            )}
          >
            {children}
          </h2>
        )
      },
      h3({ children }) {
        return (
          <h3
            className={cn(
              "font-heading font-bold",
              mode === "full" ? "mb-2 mt-5 text-lg" : "mb-1 mt-2 text-sm",
            )}
          >
            {children}
          </h3>
        )
      },

      // Links
      a({ href, children }) {
        if (href?.startsWith("/")) {
          return (
            <Link to={href} className="text-primary underline underline-offset-4 hover:opacity-80">
              {children}
            </Link>
          )
        }
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:opacity-80"
          >
            {children}
          </a>
        )
      },

      // Task lists
      input({ checked, ...props }) {
        return (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-2 accent-primary"
            {...props}
          />
        )
      },

      // Block quotes
      blockquote({ children }) {
        return (
          <blockquote className="my-2 border-l-2 border-primary/30 pl-4 text-muted-foreground italic">
            {children}
          </blockquote>
        )
      },

      // Paragraphs
      p({ children }) {
        return <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
      },

      // Lists
      ul({ children }) {
        return <ul className="mb-3 list-disc pl-6">{children}</ul>
      },
      ol({ children }) {
        return <ol className="mb-3 list-decimal pl-6">{children}</ol>
      },
      li({ children }) {
        return <li className="mb-1">{children}</li>
      },

      // Horizontal rule
      hr() {
        return <hr className="my-6 border-border" />
      },

      // Images
      img({ src, alt }) {
        return (
          <img
            src={src}
            alt={alt ?? ""}
            className={cn(
              "my-4 max-w-full border border-border",
              mode === "inline" && "max-h-[200px] object-contain",
            )}
          />
        )
      },
    }),
    [mode],
  )

  return (
    <div className={cn("flex gap-8", mode === "full" && "items-start")}>
      {/* Main content */}
      <div
        className={cn(
          "min-w-0 flex-1",
          mode === "full"
            ? "max-w-[720px] font-sans text-sm leading-[1.65]"
            : "font-sans text-sm leading-normal",
          className,
        )}
      >
        <Markdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content}
        </Markdown>
      </div>

      {/* TOC sidebar (full mode, desktop only) */}
      {mode === "full" && (
        <div className="hidden shrink-0 lg:block lg:w-48 xl:w-56">
          <div className="sticky top-6">
            <MarkdownToc content={content} />
          </div>
        </div>
      )}
    </div>
  )
}
