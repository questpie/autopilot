import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/db/schema.ts',
	out: './drizzle',
	dialect: 'turso',
	tablesFilter: ['!search_fts*', '!search_vec*', '!knowledge_fts*', '!messages_fts*', '!chunks_fts*', '!chunks_vec*'],
})
