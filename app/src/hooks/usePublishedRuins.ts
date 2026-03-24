import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { Ruin } from "@pwarf/shared";

export function usePublishedRuins() {
  const [ruins, setRuins] = useState<Ruin[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      const { data } = await supabase
        .from("ruins")
        .select("id, name, cause_of_death, fallen_year, peak_population, danger_level, is_published, created_at, civilization_id, world_id, tile_x, tile_y, original_wealth, remaining_wealth, ghost_count")
        .eq("is_published", true)
        .order("fallen_year", { ascending: false })
        .limit(50);
      if (!cancelled && data) setRuins(data as Ruin[]);
    };
    void fetch();
    return () => { cancelled = true; };
  }, []);

  return ruins;
}
