/**
 * Minimal `process` / `ProcessEnv` for `process.env.NEXT_PUBLIC_*` in client code.
 * If you add the official `npm i -D @types/node` package, remove this folder to
 * avoid duplicate `process` declarations.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly [key: string]: string | undefined;
    readonly NEXT_PUBLIC_API_URL?: string;
    readonly NEXT_PUBLIC_SUPABASE_URL?: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  }
}

declare const process: {
  readonly env: NodeJS.ProcessEnv;
};

declare module "path" {
  export function dirname(p: string): string;
}

declare module "url" {
  export function fileURLToPath(url: URL | string): string;
}
