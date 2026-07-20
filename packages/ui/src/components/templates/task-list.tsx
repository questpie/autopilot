import { ObjectList } from "@questpie/ui/components/templates/object-list";
import {
	mapObjectListAction,
	mapTaskListProjection,
} from "@questpie/ui/components/templates/task-list-mapper";
import type {
	TaskListAction,
	TaskListProjection,
} from "@questpie/ui/components/templates/task-list-contract";

export interface TaskListProps<TSpaceId extends string> {
	projection: TaskListProjection<TSpaceId>;
	onAction: (action: TaskListAction) => void;
}

function TaskList<TSpaceId extends string>({ projection, onAction }: TaskListProps<TSpaceId>) {
	const visualProjection = mapTaskListProjection(projection, onAction);
	return (
		<ObjectList
			projection={visualProjection}
			onAction={(action) => {
				const mapped = mapObjectListAction(action, projection);
				if (mapped) onAction(mapped);
			}}
		/>
	);
}

export { TaskList };
