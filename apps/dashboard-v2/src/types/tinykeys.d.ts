declare module "tinykeys" {
  export function tinykeys(
    target: Window | HTMLElement,
    keybindings: Record<string, (event: KeyboardEvent) => void>
  ): () => void
}
