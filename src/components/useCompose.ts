import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, Audience } from "../api";
import { ComposePreset, useLoad } from "../util";

/** Shared state for the push and SMS compose pages: audience choice plus the lists it needs. */
export function useCompose(defaultAudience: Audience) {
  const preset = (useLocation().state ?? null) as ComposePreset | null;
  const [audience, setAudience] = useState<Audience>(preset?.audience ?? defaultAudience);
  const [opportunityId, setOpportunityId] = useState(preset?.opportunityId ?? "");
  const [selected, setSelected] = useState<string[]>(preset?.volunteerIds ?? []);

  const lists = useLoad(() => Promise.all([api.opportunities(), api.volunteers(), api.stats()]));
  const [opportunities, volunteers, stats] = lists.data ?? [[], [], null];

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
    opportunities, volunteers, stats, listsError: lists.error, listsLoading: lists.loading,
    recipientCount, target, ready,
    opportunityTitle: opportunities.find((o) => o.id === opportunityId)?.title,
  };
}
