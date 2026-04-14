import { z } from 'zod'

export const TypeDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum(['file', 'folder']).default('file'),

  match: z.object({
    extensions: z.array(z.string()).optional(),
    glob: z.string().optional(),
    frontmatter_discriminator: z.string().optional(),
    is_dir: z.boolean().optional(),
    children_type: z.string().optional(),
  }),

  schema: z
    .object({
      inline: z.record(z.unknown()).optional(),
      ref: z.string().optional(),
    })
    .optional(),

  display: z
    .object({
      icon: z.string().optional(),
      color: z.string().optional(),
      list_columns: z
        .array(
          z.object({
            key: z.string(),
            label: z.string(),
            align: z.enum(['left', 'right']).optional(),
            format: z.enum(['text', 'number', 'currency', 'date', 'badge']).optional(),
          }),
        )
        .optional(),
      primary_field: z.string().optional(),
      secondary_field: z.string().optional(),
    })
    .optional(),

  renderer: z
    .object({
      builtin: z.string().optional(),
      generic: z
        .object({
          kind: z.enum(['detail-card', 'kanban', 'table', 'timeline', 'gallery']),
          config: z.record(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),

  aggregations: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        query: z.object({
          type: z.string(),
          where: z.record(z.unknown()).optional(),
        }),
        op: z.enum(['count', 'sum', 'avg', 'min', 'max']),
        field: z.string().optional(),
        format: z.enum(['text', 'number', 'currency']).optional(),
      }),
    )
    .optional(),

  hooks: z
    .object({
      on_create: z.string().optional(),
      on_update: z.string().optional(),
      on_delete: z.string().optional(),
    })
    .optional(),

  source: z
    .object({
      file: z.string(),
      pack: z.string().optional(),
      priority: z.number(),
    })
    .optional(),
})

export type TypeDefinition = z.infer<typeof TypeDefinitionSchema>
