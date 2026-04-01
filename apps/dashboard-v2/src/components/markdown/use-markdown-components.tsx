import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { CodeBlock } from "./code-block"
import type { MarkdownMode } from "./markdown-config"
import type { Components } from "react-markdown"
import type { ResourceType } from "@/lib/resource-resolver"

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
      className="inline font-mono text-[13px] text-primary underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  )
}

export function useMarkdownComponents(mode: MarkdownMode): Partial<Components> {
  return useMemo(
    () => ({
      // Custom code blocks
      code({ className: codeClassName, children, ...props }) {
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
}
