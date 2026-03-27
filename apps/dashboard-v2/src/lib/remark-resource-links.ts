/**
 * Custom remark plugin that detects resource references in text nodes
 * and wraps them in a custom MDAST node for rendering.
 *
 * This integrates with the resource-resolver to auto-link task IDs,
 * agent refs, file paths, channels, PRs, and artifacts in markdown.
 */

import type { Root, Text, PhrasingContent } from "mdast"
import { resolveReferences } from "./resource-resolver"

type RemarkPlugin = () => (tree: Root) => void

interface ResourceLinkNode {
  type: "resourceLink"
  data: {
    hName: "resource-link"
    hProperties: {
      resourceType: string
      href: string
      label: string
    }
  }
  children: Array<{ type: "text"; value: string }>
}

function isText(node: PhrasingContent): node is Text {
  return node.type === "text"
}

/**
 * Remark plugin that converts resource references (task-123, agent:max, etc.)
 * into custom `resource-link` HTML elements that the React renderer can handle.
 */
export const remarkResourceLinks: RemarkPlugin = () => {
  return (tree: Root) => {
    visitTextNodes(tree as unknown as NodeWithChildren)
  }
}

type NodeWithChildren = { children?: PhrasingContent[] } & Record<string, unknown>

function visitTextNodes(node: NodeWithChildren) {
  if (!node.children) return

  const newChildren: PhrasingContent[] = []
  let changed = false

  for (const child of node.children) {
    if (isText(child)) {
      const refs = resolveReferences(child.value)

      if (refs.length === 0) {
        newChildren.push(child)
        continue
      }

      changed = true
      let lastIndex = 0

      for (const ref of refs) {
        // Text before reference
        if (ref.start > lastIndex) {
          newChildren.push({
            type: "text",
            value: child.value.slice(lastIndex, ref.start),
          })
        }

        // Resource link node
        const linkNode: ResourceLinkNode = {
          type: "resourceLink" as unknown as "resourceLink",
          data: {
            hName: "resource-link",
            hProperties: {
              resourceType: ref.type,
              href: ref.url,
              label: ref.displayLabel,
            },
          },
          children: [{ type: "text", value: ref.displayLabel }],
        }

        newChildren.push(linkNode as unknown as PhrasingContent)
        lastIndex = ref.end
      }

      // Remaining text
      if (lastIndex < child.value.length) {
        newChildren.push({
          type: "text",
          value: child.value.slice(lastIndex),
        })
      }
    } else {
      // Recurse into child nodes
      if ("children" in child) {
        visitTextNodes(child as unknown as { children: PhrasingContent[] })
      }
      newChildren.push(child)
    }
  }

  if (changed) {
    node.children = newChildren
  }
}
