import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, Audience, Opportunity } from "../api";
import { ComposePreset, useLoad } from "../util";

/** Shared state for the compose pages: audience choice plus the lists it needs. */
export function useCompose(defaultAudience: Audience) {
  const preset = (useLocation().state ?? null) as ComposePreset | null;
  const [audience, setAudience] = useState<Audience>(preset?.audience ?? defaultAudience);
  const [opportunityId, setOpportunityId] = useState(preset?.opportunityId ?? "");
  const [selected, setSelected] = useState<string[]>(preset?.volunteerIds ?? []);

  const lists = useLoad(() => Promise.all([api.opportunities(true), api.volunteers(), api.stats()]));
  const [allOpportunities, volunteers, stats] = lists.data ?? [[], [], null];
  // Upcoming ones (soonest first), then past ones (most recent first). Past ones are listed only
  // with "Show past" on, except the one we were sent here for.
  const [showPast, setShowPastState] = useState(false);
  const opportunities = useMemo(() => {
    const now = Date.now();
    const ended = (o: Opportunity) => new Date(o.end_at).getTime() < now;
    const upcoming = allOpportunities.filter((o) => !ended(o));
    const past = allOpportunities
      .filter((o) => ended(o) && (showPast || o.id === preset?.opportunityId))
      .sort((a, b) => b.start_at.localeCompare(a.start_at));
    return [...upcoming, ...past];
  }, [allOpportunities, showPast, preset?.opportunityId]);

  const setShowPast = (on: boolean) => {
    setShowPastState(on);
    // Hiding past ones: drop the choice if it was one of them (unless it's the one we came for).
    const chosen = allOpportunities.find((o) => o.id === opportunityId);
    if (!on && chosen && new Date(chosen.end_at).getTime() < Date.now() && chosen.id !== preset?.opportunityId) {
      setOpportunityId("");
    }
  };

  const recipientCount = useMemo(() => {
    if (audience === "all") return stats?.volunteers ?? 0;
    if (audience === "event") return opportunities.find((o) => o.id === opportunityId)?.signup_count ?? 0;
    return selected.length;
  }, [audience, opportunityId, selected, opportunities, stats]);

  const target = {
    audience,
    opportunity_id: audience === "event" ? opportunityId : undefined,
    volunteer_ids: audience === "volunteers" ? selected : undefined,
  };
  const ready = audience === "all" || (audience === "event" ? !!opportunityId : selected.length > 0);

  return {
    audience, setAudience, opportunityId, setOpportunityId, selected, setSelected,
    opportunities, showPast, setShowPast, volunteers, stats, listsError: lists.error, listsLoading: lists.loading,
    recipientCount, target, ready,
    opportunityTitle: opportunities.find((o) => o.id === opportunityId)?.title,
  };
}
