export function Logo({ className }: { className?: string }) {
	return (
		<div className={`flex items-center gap-2 ${className ?? ""}`}>
			<img
				src="/autopilot/logo/symbol-light.svg"
				alt=""
				className="h-5 w-auto dark:hidden"
			/>
			<img
				src="/autopilot/logo/symbol-dark.svg"
				alt=""
				className="hidden h-5 w-auto dark:block"
			/>
			<span className="text-sm font-semibold tracking-tight">Autopilot</span>
		</div>
	);
}
