import { StatePanel } from "@questpie/ui";

import type { ChannelSummary } from "@/lib/data/feature-queries";

export type ChannelDirectoryProps = {
	channels: readonly ChannelSummary[];
};

/**
 * Channel directory (F03): every active channel of the Space, the protected
 * #general anchor first (`isSystemDefault`), then standard channels. Query-free —
 * the LIVE Space detail route derives `channels` off `channels.visibleLive` and
 * passes them in, so this component just renders the list plus its honest empty
 * state. Channels have no detail route yet, so rows are non-interactive.
 */
export function ChannelDirectory({ channels }: ChannelDirectoryProps) {
	return (
		<section data-testid="screen-channel-directory" aria-label="Kanály">
			<header className="mb-4">
				<p className="ui-eyebrow text-xs text-muted-foreground">Kanály</p>
				<h2 className="mt-1 text-lg font-semibold tracking-tight">Kanály priestoru</h2>
			</header>
			{channels.length === 0 ? (
				<StatePanel
					state="empty"
					title="Zatiaľ žiadne kanály"
					description="Kanály tohto priestoru sa zobrazia hneď, ako niektorý vznikne."
				/>
			) : (
				<ul className="grid gap-2">
					{channels.map((channel) => (
						<li key={channel.id}>
							<div
								data-testid="channel-row"
								data-channel-default={channel.isSystemDefault ? "true" : undefined}
								className="flex w-full items-center justify-between gap-3 rounded-md border border-hairline p-3 text-left"
							>
								<span className="font-medium">
									<span className="text-muted-foreground">#</span>
									{channel.slug}
								</span>
								{channel.isSystemDefault ? (
									<span className="text-xs text-muted-foreground">Predvolený kanál</span>
								) : null}
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
