export interface ActorProjection {
	id: string;
	name: string;
	kind: "human" | "agent";
	avatarUrl?: string;
}
