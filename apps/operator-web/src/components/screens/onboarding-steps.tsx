import { useState } from "react";

import { AuthShell, Field, FieldDescription, FieldGroup, FieldLabel, Input } from "@questpie/ui";

import { type CompanyBootstrapDraft, previewCompanySlug } from "@/lib/data/commands/companies";

/** Canonical human-only onboarding flow: company -> team -> AI gate -> work. */
export const ONBOARDING_TOTAL_STEPS = 4;

export type CompanySubmitOutcome =
	| { status: "created" }
	| { status: "recoverable"; message: string };

type CompanyOnboardingStepProps = {
	/** Runs the bootstrap command; on "created" the route navigates away. */
	onSubmit: (draft: CompanyBootstrapDraft) => Promise<CompanySubmitOutcome>;
};

/** Static creation preview — the domain contract of companies.bootstrap (SPEC 10.2). */
const CREATION_PREVIEW = [
	"Priestor Whole Company",
	"Kanál #general",
	"Váš ľudský aktér (Owner)",
	"Autopilot čakajúci na nastavenie",
] as const;

export type AiOnboardingStepProps = {
	/** Proceeds to the final work step — a client navigation with no write. */
	onSkip: () => void;
};

/** What the Autopilot cannot do until a provider is connected (SPEC 10.4). */
const AI_UNAVAILABLE = [
	"Autopilot nespustí žiadnu úlohu ani beh.",
	"Neodpovie na spomenutia ani neprevezme zadania.",
	"Zostáva v tíme ako člen čakajúci na nastavenie.",
] as const;

/**
 * AI gate: an honest skip-only screen. No provider surface exists in this
 * phase, so the step configures nothing — it names exactly what stays
 * unavailable and lets the owner proceed without any write. 'Nastaviť neskôr'
 * is a client navigation to the work step; nothing is persisted.
 */
export function AiOnboardingStep({ onSkip }: AiOnboardingStepProps) {
	return (
		<div data-testid="screen-ai-setup">
			<AuthShell
				title="Pripojte poskytovateľa AI"
				description="Autopilota rozbehnete až po pripojení poskytovateľa AI. Kým chýba, zostáva nečinný — nič nepredstierame."
				step={{ current: 3, total: ONBOARDING_TOTAL_STEPS }}
				primaryAction={{ label: "Nastaviť neskôr" }}
				onSubmit={onSkip}
			>
				<section aria-labelledby="ai-unavailable" className="rounded-md border border-hairline p-3">
					<h2 id="ai-unavailable" className="text-sm font-medium">
						Kým poskytovateľ chýba
					</h2>
					<ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
						{AI_UNAVAILABLE.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>
				<p className="text-sm text-muted-foreground">
					Poskytovateľa pripojíte neskôr v nastaveniach spoločnosti. Tento krok teraz iba preskočíte
					— nič sa neuloží.
				</p>
			</AuthShell>
		</div>
	);
}

export type WorkOnboardingStepProps = {
	/** Confirms the Whole Company workspace and enters the adaptive shell. */
	onConfirm: () => void;
};

/** What every company starts with — the honest human-only workspace (SPEC 10.5). */
const WORKSPACE_INCLUDED = [
	"Priestor Whole Company pre celý tím.",
	"Kanál #general, kde sa vedú rozhovory.",
	"Ďalšie priestory pridáte kedykoľvek zo shellu.",
] as const;

/**
 * Final onboarding step: confirm the Whole Company workspace and enter the
 * adaptive shell. Human-only by design — no first Goal is invented here (no
 * goals surface exists yet), so the step confirms what already exists and
 * hands the owner into their company home.
 */
export function WorkOnboardingStep({ onConfirm }: WorkOnboardingStepProps) {
	return (
		<div data-testid="screen-work-setup">
			<AuthShell
				title="Takto budete pracovať"
				description="Váš tím začne v priestore Whole Company. Ďalšie priestory pridáte neskôr priamo v pracovnom prostredí."
				step={{ current: 4, total: ONBOARDING_TOTAL_STEPS }}
				primaryAction={{ label: "Vstúpiť do pracovného priestoru" }}
				onSubmit={onConfirm}
			>
				<section aria-labelledby="work-included" className="rounded-md border border-hairline p-3">
					<h2 id="work-included" className="text-sm font-medium">
						Čo máte pripravené
					</h2>
					<ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
						{WORKSPACE_INCLUDED.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>
			</AuthShell>
		</div>
	);
}

export function CompanyOnboardingStep({ onSubmit }: CompanyOnboardingStepProps) {
	const [name, setName] = useState("");
	const [pending, setPending] = useState(false);
	const [inlineError, setInlineError] = useState<string | null>(null);
	const slugPreview = previewCompanySlug(name);

	const submit = async () => {
		if (pending) return;
		setPending(true);
		setInlineError(null);
		const outcome = await onSubmit({ name });
		if (outcome.status === "recoverable") {
			// SPEC 10.2: the draft stays intact; only the error band appears.
			setInlineError(outcome.message);
			setPending(false);
			return;
		}
		// "created": stay pending — the route navigates to the next step.
	};

	return (
		<div data-testid="screen-company-setup">
			<AuthShell
				title="Vytvorte svoju spoločnosť"
				description="Pomenujte spoločnosť, v ktorej bude váš tím spolupracovať."
				step={{ current: 1, total: ONBOARDING_TOTAL_STEPS }}
				error={inlineError ?? undefined}
				primaryAction={{ label: "Pokračovať", pendingLabel: "Vytvárame spoločnosť…", pending }}
				onSubmit={() => {
					void submit();
				}}
			>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="company-name">Názov spoločnosti</FieldLabel>
						<Input
							id="company-name"
							required
							minLength={2}
							maxLength={160}
							placeholder="Hrebeň"
							value={name}
							disabled={pending}
							onChange={(event) => setName(event.target.value)}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="company-slug-preview">Adresa spoločnosti</FieldLabel>
						<Input
							id="company-slug-preview"
							readOnly
							tabIndex={-1}
							value={slugPreview}
							placeholder="nazov-spolocnosti"
						/>
						<FieldDescription>
							Predbežný tvar adresy — jedinečnú koncovku doplní server pri vytvorení.
						</FieldDescription>
					</Field>
				</FieldGroup>
				<section
					aria-labelledby="company-creation-preview"
					className="rounded-md border border-hairline p-3"
				>
					<h2 id="company-creation-preview" className="text-sm font-medium">
						Čo sa vytvorí
					</h2>
					<ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
						{CREATION_PREVIEW.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>
			</AuthShell>
		</div>
	);
}
