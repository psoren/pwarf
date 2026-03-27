import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false,
    // Bypass navigator.locks to avoid orphaned lock warnings.
    // Safe for single-tab usage — no cross-tab session sync needed.
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => fn(),
  },
});
