import { cn } from "@questpie/ui/lib/utils";
import { Loader2Icon } from "lucide-react";

function Spinner({ className, "aria-label": label, ...props }: React.ComponentProps<"svg">) {
	return (
		<Loader2Icon
			data-slot="spinner"
			role={label ? "status" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			className={cn("size-4 animate-spin", className)}
			{...props}
		/>
	);
}

export { Spinner };
