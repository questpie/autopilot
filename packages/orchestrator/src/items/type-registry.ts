import type { TypeDefinition } from '@questpie/autopilot-spec'

export class TypeRegistry {
  private types = new Map<string, TypeDefinition>()
  private byPriority: TypeDefinition[] = []

  register(def: TypeDefinition): void {
    // Check for shadowing
    if (this.types.has(def.id)) {
      console.warn(`[type-registry] type '${def.id}' shadowed by ${def.source?.file ?? 'unknown'}`)
    }
    this.types.set(def.id, def)
    this.rebuildPriorityList()
  }

  unregister(id: string): void {
    this.types.delete(id)
    this.rebuildPriorityList()
  }

  has(id: string): boolean {
    return this.types.has(id)
  }

  get(id: string): TypeDefinition | undefined {
    return this.types.get(id)
  }

  all(): TypeDefinition[] {
    return Array.from(this.types.values())
  }

  allWithGlobs(): TypeDefinition[] {
    return this.byPriority.filter((t) => t.match.glob)
  }

  byCategory(cat: 'file' | 'folder'): TypeDefinition[] {
    return this.all().filter((t) => t.category === cat)
  }

  byExtension(ext: string): TypeDefinition | undefined {
    return this.all().find((t) => t.match.extensions?.includes(ext))
  }

  // For parent directive: look up if a parent folder's type has children_type
  private parentChildrenTypes = new Map<string, string>()

  setParentChildrenType(folderPath: string, childrenType: string): void {
    this.parentChildrenTypes.set(folderPath, childrenType)
  }

  removeParentChildrenType(folderPath: string): void {
    this.parentChildrenTypes.delete(folderPath)
  }

  getParentChildrenType(folderPath: string): string | undefined {
    // Given "clients/agrotrade", parent is "clients"
    const parent = folderPath.includes('/')
      ? folderPath.split('/').slice(0, -1).join('/')
      : null
    return parent ? this.parentChildrenTypes.get(parent) : undefined
  }

  private rebuildPriorityList(): void {
    this.byPriority = Array.from(this.types.values()).sort(
      (a, b) => (a.source?.priority ?? 0) - (b.source?.priority ?? 0),
    )
  }
}
