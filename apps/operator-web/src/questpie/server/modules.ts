/**
 * Modules — static module dependencies for this project.
 */
import { openApiModule } from "@questpie/openapi";
import { workflowsModule } from "@questpie/workflows/modules/workflows";
import { mcpModule } from "@questpie/mcp/modules/mcp";
import { starterModule } from "questpie/modules/starter";

const modules = [starterModule, openApiModule, workflowsModule, mcpModule] as const;

export default modules;
