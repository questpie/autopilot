import { z } from 'zod'

export const ItemRecordSchema = z.object({
  path: z.string(),
  is_dir: z.boolean(),
  type: z.string().nullable(),
  type_source: z
    .enum([
      'frontmatter',
      'compound_ext',
      'glob',
      'parent_directive',
      'plain_ext',
      'implicit',
      'fallback',
      'unknown',
    ])
    .nullable(),
  frontmatter: z.record(z.unknown()).nullable(),
  body_preview: z.string().nullable(),
  size: z.number().nullable(),
  mtime: z.string(),
  hash: z.string().nullable(),
  parent_path: z.string().nullable(),
  indexed_at: z.string(),
})

export type ItemRecord = z.infer<typeof ItemRecordSchema>
