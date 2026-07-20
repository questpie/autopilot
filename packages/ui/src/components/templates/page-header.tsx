import { Fragment, type ReactNode } from "react";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@questpie/ui/components/ui/breadcrumb";

function PageHeader({
	title,
	icon,
	breadcrumbs,
	context,
	actions,
}: {
	title: string;
	icon?: ReactNode;
	breadcrumbs?: readonly string[];
	context?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className="flex items-start justify-between gap-4 border-b px-4 py-5 lg:px-8 lg:py-6">
			<div className="min-w-0">
				{breadcrumbs?.length ? (
					<Breadcrumb>
						<BreadcrumbList>
							{breadcrumbs.map((crumb, index) => (
								<Fragment key={`${crumb}-${index}`}>
									<BreadcrumbItem>
										{index === breadcrumbs.length - 1 ? (
											<BreadcrumbPage>{crumb}</BreadcrumbPage>
										) : (
											crumb
										)}
									</BreadcrumbItem>
									{index < breadcrumbs.length - 1 ? <BreadcrumbSeparator /> : null}
								</Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				) : null}
				<div className="flex items-center gap-3">
					{icon}
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
				</div>
				{context ? <div className="mt-2 text-sm text-muted-foreground">{context}</div> : null}
			</div>
			{actions ? (
				<div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
			) : null}
		</header>
	);
}

export { PageHeader };
