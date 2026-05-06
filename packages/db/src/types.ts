// Hand-written placeholder until Phase 1 generates `types.gen.ts` from the live Supabase project.
// After Phase 1, this file re-exports from the generated file:
//   export type { Database } from './types.gen.js';

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
