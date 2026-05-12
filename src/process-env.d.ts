/**
 * Extend `process.env` keys used in the app. Declared here instead of
 * `typings/node/` so `typeRoots` can resolve real `@types/node` (Buffer, stream, etc.).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly [key: string]: string | undefined;
    /** Server-only: OpenAI API key for `/api/generate-resume` (default path). */
    readonly OPENAI_API_KEY?: string;
    readonly OPENAI_MODEL?: string;
    readonly OPENAI_PRICE_INPUT_PER_MTOK?: string;
    readonly OPENAI_PRICE_OUTPUT_PER_MTOK?: string;
    /** Server-only: Claude API key when using Anthropic models. */
    readonly ANTHROPIC_API_KEY?: string;
    readonly ANTHROPIC_MODEL?: string;
    readonly ANTHROPIC_PRICE_INPUT_PER_MTOK?: string;
    readonly ANTHROPIC_PRICE_OUTPUT_PER_MTOK?: string;
    readonly ANTHROPIC_PRICE_CACHE_READ_PER_MTOK?: string;
    readonly MAX_BODY_BYTES?: string;
    readonly NEXT_PUBLIC_SUPABASE_URL?: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  }
}
