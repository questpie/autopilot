import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 1_000,
				retry: 2,
				refetchOnWindowFocus: true,
			},
		},
	})
}
