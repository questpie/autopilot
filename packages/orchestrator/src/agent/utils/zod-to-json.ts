import { z } from 'zod'

/** Minimal zod-to-JSON-schema converter for our tool schemas */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
	return zodTypeToJson(schema)
}

export function zodTypeToJson(schema: z.ZodType): Record<string, unknown> {
	// Unwrap optionals and defaults
	if (schema instanceof z.ZodOptional) {
		return zodTypeToJson(schema.unwrap())
	}
	if (schema instanceof z.ZodDefault) {
		return zodTypeToJson(schema._def.innerType)
	}

	if (schema instanceof z.ZodString) {
		const result: Record<string, unknown> = { type: 'string' }
		if (schema.description) result.description = schema.description
		return result
	}

	if (schema instanceof z.ZodNumber) {
		const result: Record<string, unknown> = { type: 'number' }
		if (schema.description) result.description = schema.description
		return result
	}

	if (schema instanceof z.ZodEnum) {
		return { type: 'string', enum: schema.options }
	}

	if (schema instanceof z.ZodArray) {
		return {
			type: 'array',
			items: zodTypeToJson(schema.element),
		}
	}

	if (schema instanceof z.ZodObject) {
		const shape = schema.shape as Record<string, z.ZodType>
		const properties: Record<string, unknown> = {}
		const required: string[] = []

		for (const [key, value] of Object.entries(shape)) {
			properties[key] = zodTypeToJson(value)
			if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
				required.push(key)
			}
		}

		const result: Record<string, unknown> = {
			type: 'object',
			properties,
		}
		if (required.length > 0) {
			result.required = required
		}
		return result
	}

	if (schema instanceof z.ZodRecord) {
		return {
			type: 'object',
			additionalProperties: zodTypeToJson(schema.valueSchema),
		}
	}

	if (schema instanceof z.ZodBoolean) {
		const result: Record<string, unknown> = { type: 'boolean' }
		if (schema.description) result.description = schema.description
		return result
	}

	if (schema instanceof z.ZodLiteral) {
		const value = schema.value
		const result: Record<string, unknown> = { type: typeof value, const: value }
		if (schema.description) result.description = schema.description
		return result
	}

	if (schema instanceof z.ZodNullable) {
		return zodTypeToJson(schema.unwrap())
	}

	if (schema instanceof z.ZodUnion) {
		const options = (schema._def.options as z.ZodType[]).map(zodTypeToJson)
		const result: Record<string, unknown> = { anyOf: options }
		if (schema.description) result.description = schema.description
		return result
	}

	// Fallback
	return { type: 'object' }
}
