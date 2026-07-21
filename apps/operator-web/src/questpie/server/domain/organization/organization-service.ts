import { service } from "questpie/services";
import { createActorMembership } from "./actor-membership";
import { createChannels } from "./channels";
import { createCompanyBootstrap } from "./company-bootstrap";
import { createCompanyParticipation } from "./company-participation";
import { createInvitationAcceptance } from "./invitation-acceptance";
import { createInvitationLifecycle } from "./invitation-lifecycle";
import { createOrganizationCommandContext } from "./command-context";
import { createProjects } from "./projects";
import { createSpaceMemberships } from "./space-memberships";
import { createSpaces } from "./spaces";

export default service()
	.lifecycle("singleton")
	.create((serviceContext) => {
		const commandContext = createOrganizationCommandContext(serviceContext);
		const companyBootstrap = createCompanyBootstrap(serviceContext, commandContext);
		const companyParticipation = createCompanyParticipation(serviceContext, commandContext);
		const invitationLifecycle = createInvitationLifecycle(
			serviceContext,
			commandContext,
			companyParticipation,
		);
		const invitationAcceptance = createInvitationAcceptance(serviceContext, commandContext);
		const actorMembership = createActorMembership(
			serviceContext,
			commandContext,
			companyParticipation,
		);
		const spaces = createSpaces(serviceContext, commandContext);
		const spaceMemberships = createSpaceMemberships(serviceContext, commandContext);
		const projects = createProjects(serviceContext, commandContext);
		const channels = createChannels(serviceContext, commandContext);

		return {
			...companyBootstrap,
			...invitationLifecycle,
			...invitationAcceptance,
			...actorMembership,
			...spaces,
			...spaceMemberships,
			replaceRoleBindings: companyParticipation.replaceRoleBindings,
			...projects,
			...channels,
		};
	});
