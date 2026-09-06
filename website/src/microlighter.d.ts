// Minimal types for the microlighter client (ships without declarations).
declare module "microlighter" {
  export function highlightAll(options?: {
    root?: ParentNode;
    selector?: string;
    languageAliases?: Record<string, string>;
  }): Promise<Array<HTMLElement>>;
}
