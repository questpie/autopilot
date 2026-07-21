import type { ReactNode } from "react";
import { Streamdown, type AllowedTags, type Components } from "streamdown";

interface MessageMentionProps {
	actor_id?: string;
	children?: ReactNode;
	node?: unknown;
	node_id?: string;
}

function MessageMention({ actor_id, children, node: _node, node_id }: MessageMentionProps) {
	return (
		<span
			data-slot="actor-mention"
			data-actor-id={actor_id}
			data-node-id={node_id}
			className="rounded-[0.375rem] bg-agent px-1 font-medium text-agent-foreground"
		>
			{children}
		</span>
	);
}

const messageMarkdownComponents = {
	a: ({ children, node: _node, ...props }) => (
		<a
			{...props}
			className="wrap-anywhere font-medium text-agent-foreground underline"
			rel="noopener noreferrer"
			target="_blank"
		>
			{children}
		</a>
	),
	input: ({ node: _node, checked, ...props }) => (
		<input
			{...props}
			checked={checked}
			aria-label={checked ? "Dokončená položka" : "Nedokončená položka"}
		/>
	),
	mention: MessageMention,
	strong: ({ children }) => <strong>{children}</strong>,
} satisfies Components;

const messageLinkSafety = { enabled: false } as const;
const messageAllowedTags: AllowedTags = { mention: ["actor_id", "node_id"] };
const messageLiteralTags = ["mention"];

function MessageMarkdown({
	markdown,
	streaming = false,
}: {
	markdown: string;
	streaming?: boolean;
}) {
	return (
		<Streamdown
			allowedTags={messageAllowedTags}
			className="channel-markdown"
			components={messageMarkdownComponents}
			controls={false}
			linkSafety={messageLinkSafety}
			literalTagContent={messageLiteralTags}
			mode={streaming ? "streaming" : "static"}
		>
			{markdown}
		</Streamdown>
	);
}

export { MessageMarkdown };
