CREATE TABLE IF NOT EXISTS search_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  UNIQUE(entity_type, entity_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_search_entity_type ON search_index(entity_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_search_entity_id ON search_index(entity_id);
