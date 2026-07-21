import type { TeamRoster } from "@/lib/data/feature-queries";

export type CompanyTeamProps = {
	roster: TeamRoster;
};

const memberStatus = (member: TeamRoster["members"][number]): string => {
	if (member.pendingSetup) return "Vyžaduje nastavenie";
	if (member.roleLabel) return member.roleLabel;
	return member.kind === "agent" ? "Agent" : "Člen";
};

/**
 * App team surface: the server-truth roster in the shell (reuses the onboarding
 * team projection). Read-only here — invitations are issued during onboarding.
 * The dormant Autopilot honestly reads "Vyžaduje nastavenie"; nothing is faked.
 */
export function CompanyTeam({ roster }: CompanyTeamProps) {
	return (
		<div data-testid="screen-company-team" className="mx-auto w-full max-w-3xl px-4 py-8">
			<header className="mb-6">
				<p className="ui-eyebrow text-xs text-muted-foreground">Tím</p>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">Váš tím</h1>
			</header>
			<ul className="grid gap-2">
				{roster.members.map((member) => (
					<li
						key={member.id}
						className="flex items-center justify-between gap-3 rounded-md border border-border-subtle p-3"
					>
						<span className="truncate font-medium">{member.name}</span>
						<span className="shrink-0 text-sm text-muted-foreground">{memberStatus(member)}</span>
					</li>
				))}
			</ul>
			{roster.invitations.length > 0 ? (
				<section className="mt-6">
					<h2 className="mb-2 text-sm font-medium">Čakajúce pozvánky</h2>
					<ul className="grid gap-2">
						{roster.invitations.map((invitation) => (
							<li
								key={invitation.id}
								className="flex items-center justify-between gap-3 rounded-md border border-border-subtle p-3 text-sm"
							>
								<span className="truncate">{invitation.email}</span>
								<span className="shrink-0 text-muted-foreground">Pozvánka čaká</span>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}
