import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface LiveEvent {
  id: string;
  description: string;
  category: string;
  created_at: string;
}

const POLL_INTERVAL = 3000;
const MAX_EVENTS = 50;

export function useEvents(civId: string | null): LiveEvent[] {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const newestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!civId) {
      setEvents([]);
      newestRef.current = null;
      return;
    }

    let cancelled = false;

    async function poll() {
      const query = supabase
        .from('world_events')
        .select('id, description, category, created_at')
        .eq('civilization_id', civId)
        .order('created_at', { ascending: false })
        .limit(MAX_EVENTS);

      // Only fetch events newer than what we already have
      if (newestRef.current) {
        query.gt('created_at', newestRef.current);
      }

      const { data, error } = await query;
      if (cancelled || error || !data || data.length === 0) return;

      // Update newest timestamp
      newestRef.current = data[0]!.created_at;

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = data.filter((e) => !existingIds.has(e.id));
        if (newEvents.length === 0) return prev;
        // Newest first, cap at MAX_EVENTS
        return [...newEvents, ...prev].slice(0, MAX_EVENTS);
      });
    }

    // Initial fetch (no filter — get recent history)
    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [civId]);

  return events;
}
