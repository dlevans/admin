import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, Audience } from "../api";
import { ComposePreset, useLoad } from "../util";

/** Shared state for the push and SMS compose pages: audience choice plus the lists it needs. */
export function useCompose(defaultAudience: Audience) {
  const preset = (useLocation().state ?? null) as ComposePreset | null;
  const [audience, setAudience] = useState<Audience>(preset?.audience ?? defaultAudience);
  const [eventId, setEventId] = useState(preset?.eventId ?? "");
  const [selected, setSelected] = useState<string[]>(preset?.volunteerIds ?? []);

  const lists = useLoad(() => Promise.all([api.events(), api.volunteers(), api.stats()]));
  const [events, volunteers, stats] = lists.data ?? [[], [], null];

  const recipientCount = useMemo(() => {
    if (audience === "all") return stats?.volunteers ?? 0;
    if (audience === "event") return events.find((e) => e.id === eventId)?.signup_count ?? 0;
    return selected.length;
  }, [audience, eventId, selected, events, stats]);

  const target = {
    audience,
    event_id: audience === "event" ? eventId : undefined,
    volunteer_ids: audience === "volunteers" ? selected : undefined,
  };
  const ready = audience === "all" || (audience === "event" ? !!eventId : selected.length > 0);

  return {
    audience, setAudience, eventId, setEventId, selected, setSelected,
    events, volunteers, stats, listsError: lists.error, listsLoading: lists.loading,
    recipientCount, target, ready,
    eventTitle: events.find((e) => e.id === eventId)?.title,
  };
}
