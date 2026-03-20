import { useState, useCallback, useEffect } from "react";
import { FORTRESS_SIZE, createWorldDeriver, type TerrainType } from "@pwarf/shared";
import { createAndGenerateWorld } from "../lib/world-gen";
import { embark } from "../lib/embark";
import { ensurePlayer } from "../lib/ensure-player";
import { loadSession } from "../lib/load-session";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export function useWorldState(opts: {
  user: User | null;
  vpCols: number;
  vpRows: number;
  setOffset: (x: number, y: number) => void;
}) {
  const { user, vpCols, vpRows, setOffset } = opts;

  const [playerEnsured, setPlayerEnsured] = useState(false);
  const [worldId, setWorldId] = useState<string | null>(null);
  const [worldSeed, setWorldSeed] = useState<bigint | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [civId, setCivId] = useState<string | null>(null);
  const [civName, setCivName] = useState<string | null>(null);
  const [embarkTerrain, setEmbarkTerrain] = useState<TerrainType | null>(null);
  const [mode, setMode] = useState<"fortress" | "world">("world");

  // Ensure player profile exists after auth, then restore any existing session
  useEffect(() => {
    if (user && !playerEnsured) {
      ensurePlayer(supabase, user.id, user.email ?? undefined)
        .then(() => loadSession(user.id))
        .then(async (session) => {
          if (session.worldId) {
            setWorldId(session.worldId);
            setWorldSeed(session.worldSeed);
          }
          if (session.civId) {
            setCivId(session.civId);
            setEmbarkTerrain(session.embarkTerrain);
            setMode("fortress");
            const center = Math.floor(FORTRESS_SIZE / 2);
            setOffset(center - Math.floor(vpCols / 2), center - Math.floor(vpRows / 2));
            // Fetch civ name from DB on session restore
            const { data } = await supabase
              .from('civilizations')
              .select('name')
              .eq('id', session.civId)
              .single();
            if (data) setCivName(data.name as string);
          }
          setPlayerEnsured(true);
        })
        .catch((err) => console.error("Failed to ensure player:", err));
    }
    if (!user) {
      setPlayerEnsured(false);
      setWorldId(null);
      setWorldSeed(null);
      setCivId(null);
      setCivName(null);
      setEmbarkTerrain(null);
    }
  }, [user, playerEnsured, setOffset]);

  const handleGenerateWorld = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const { worldId: wid, seed } = await createAndGenerateWorld("New World");
      setWorldId(wid);
      setWorldSeed(seed);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, []);

  const handleEmbark = useCallback(async (
    selectedX: number,
    selectedY: number,
  ) => {
    if (!worldId || !worldSeed) return;
    try {
      const { id, name } = await embark(worldId, selectedX, selectedY, worldSeed);
      const deriver = createWorldDeriver(worldSeed);
      const derived = deriver.deriveTile(selectedX, selectedY);
      setCivId(id);
      setCivName(name);
      setEmbarkTerrain(derived.terrain);
      setMode("fortress");
      const center = Math.floor(FORTRESS_SIZE / 2);
      setOffset(center - Math.floor(vpCols / 2), center - Math.floor(vpRows / 2));
    } catch (err) {
      console.error("Embark failed:", err);
    }
  }, [worldId, worldSeed, vpCols, vpRows, setOffset]);

  const handleRestart = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      await supabase.from('players').update({ world_id: null }).eq('id', currentUser.id);
    }
    setWorldId(null);
    setWorldSeed(null);
    setCivId(null);
    setCivName(null);
    setEmbarkTerrain(null);
    setMode("world");
    setOffset(0, 0);
  }, [setOffset]);

  return {
    playerEnsured,
    worldId,
    worldSeed,
    creating,
    createError,
    civId,
    civName,
    embarkTerrain,
    mode,
    setMode,
    handleGenerateWorld,
    handleEmbark,
    handleRestart,
  };
}
