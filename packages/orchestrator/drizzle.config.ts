import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	tablesFilter: ['!search_fts*', '!search_vec*', '!knowledge_fts*', '!messages_fts*'],
})
