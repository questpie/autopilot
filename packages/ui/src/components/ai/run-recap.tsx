import type { RunRecapProjection } from "@questpie/ui/components/ai/run-state";
import { RunProvenanceList } from "@questpie/ui/components/ai/run-provenance-list";

function RunRecap({
	recap,
	onOpenRecord,
}: {
	recap: RunRecapProjection;
	onOpenRecord: (recordId: string) => void;
}) {
	return (
		<section data-slot="run-recap" aria-label="Zhrnutie dokončeného behu">
			<p className="border-b border-border-subtle px-4 py-3 text-[length:var(--type-md)]">
				{recap.summary}
			</p>
			<RunProvenanceList items={recap.items} onOpen={onOpenRecord} />
		</section>
	);
}

export { RunRecap };
