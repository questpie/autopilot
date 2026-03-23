CREATE VIRTUAL TABLE IF NOT EXISTS search_vec USING vec0(
  search_id INTEGER PRIMARY KEY,
  embedding float[768]
);
