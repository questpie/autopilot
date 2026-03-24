import { useFumadocsLoader } from 'fumadocs-core/source/client'
import browserCollections from 'fumadocs-mdx:collections/browser'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'

import { components } from '@/components/mdx'
import { baseOptions } from '@/lib/layout.shared'

type DocsLoaderData = {
	path: string
	url: string
	pageTree: object
}

const clientLoader = browserCollections.docs.createClientLoader({
	component({ toc, frontmatter, default: MDX }) {
		return (
			<DocsPage toc={toc}>
				<DocsTitle>{frontmatter.title}</DocsTitle>
				<DocsDescription>{frontmatter.description}</DocsDescription>
				<DocsBody>
					<MDX components={components} />
				</DocsBody>
			</DocsPage>
		)
	},
})

export function DocsRouteContent({ data }: { data: DocsLoaderData }) {
	const { pageTree } = useFumadocsLoader(data)
	const Content = clientLoader.getComponent(data.path)

	return (
		<DocsLayout {...baseOptions()} tree={pageTree}>
			<Content />
		</DocsLayout>
	)
}
