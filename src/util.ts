import { useCallback, useEffect, useState } from "react";
import { Audience } from "./api";

/** Load data on mount (and on reload()), tracking loading/error state. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    run()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [run]);

  useEffect(reload, [reload]);
  return { data, setData, error, loading, reload };
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const stampFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
export const fmtStamp = (iso: string) => stampFmt.format(new Date(iso));

export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}

/** What the compose pages accept through router state, e.g. from the Events page. */
export interface ComposePreset {
  audience: Audience;
  eventId?: string;
  volunteerIds?: string[];
}

// SMS length: GSM-7 messages are 160 chars (153 per part when split); anything with
// other characters (emoji, curly quotes) is UCS-2 at 70 (67 per part).
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

export function smsSegments(text: string) {
  let units = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM7.includes(ch)) units += 1;
    else if (GSM7_EXT.includes(ch)) units += 2;
    else unicode = true;
  }
  if (unicode) {
    const len = [...text].length;
    return { unicode, length: len, segments: len <= 70 ? 1 : Math.ceil(len / 67) };
  }
  return { unicode, length: units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
}
