// Thin client for the VolunteerKC API (FastAPI, see /VKC/docs).

export const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/VKC";
const TOKEN_KEY = "vkc-admin-token";

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface AdminVolunteer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  pronouns: string | null;
  birthdate: string; // YYYY-MM-DD
  background_check_complete: boolean;
  role: "user" | "admin";
  device_count: number;
  created_at: string | null;
}

export type VolunteerUpdate = Partial<
  Pick<
    AdminVolunteer,
    "name" | "email" | "phone" | "address" | "city" | "state" | "zip" | "pronouns" | "birthdate" | "background_check_complete" | "role"
  >
>;

/** A volunteer opportunity: the details (what, where, when). */
export interface Opportunity {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location_name: string;
  address: string;
  city: string;
  state: string;
  source: string;
  signup_count: number; // volunteers with an event for it (signed up or walked in)
  checkin_count: number; // volunteers who have checked in
  user_modified_count?: number; // events whose volunteer corrected their own times/hours (API 2026-11-15+)
}

/** One volunteer's event for an opportunity: signup, arrival, departure, hours. */
export interface VolunteerEvent {
  volunteer_id: string;
  name: string;
  email: string;
  phone: string;
  signed_up_at: string;
  walk_in: boolean; // checked in (or was recorded by an admin) without signing up first
  checked_in_at: string | null;
  checked_out_at: string | null;
  hours: number | null;
  user_modified?: boolean; // the volunteer corrected their own times/hours in the app (stays set after admin edits)
  user_modified_at?: string | null;
}

/** One logged correction to a volunteer's event, by the volunteer or an admin. */
export interface EventChange {
  changed_at: string;
  changed_by: string | null; // null if that account was deleted
  changed_by_name: string | null;
  changed_by_role: "volunteer" | "admin";
  old_checked_in_at: string | null;
  old_checked_out_at: string | null;
  old_hours: number | null;
  new_checked_in_at: string | null;
  new_checked_out_at: string | null;
  new_hours: number | null;
}

/** Admin correction. Only the fields sent change; null clears. Without hours, the API recalculates them from the times. */
export type VolunteerEventUpdate = Partial<Pick<VolunteerEvent, "checked_in_at" | "checked_out_at" | "hours">>;

export interface SyncResult {
  fetched: number;
  created: number;
  updated: number;
  removed: number;
  kept_with_events: number; // gone from the website but kept because people signed up
}

export interface Stats {
  volunteers: number;
  ios_devices: number;
  android_devices: number;
  upcoming_events: number;
  push_configured: boolean;
  sms_configured: boolean;
  email_configured?: boolean; // API 2026-11-15+ (SMTP_* settings)
}

// "event" = everyone signed up for one opportunity (the API's name for that audience).
export type Audience = "all" | "event" | "volunteers";

export interface SendResult {
  message_id: string;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface SmsRecipientResult {
  volunteer_id: string;
  name: string;
  phone: string;
  status: "sent" | "failed" | "no_phone" | "opted_out";
  error: string | null;
}

export interface SmsSendResult extends SendResult {
  results: SmsRecipientResult[];
}

export interface EmailRecipientResult {
  volunteer_id: string;
  name: string;
  email: string;
  status: "sent" | "failed" | "no_email";
  error: string | null;
}

export interface EmailSendResult extends SendResult {
  results: EmailRecipientResult[];
}

export type Channel = "push" | "sms" | "email";

export interface OutboundMessage {
  id: string;
  channel: Channel;
  audience: Audience;
  opportunity_title: string | null;
  sent_by_name: string | null;
  title: string | null; // push title or email subject
  body: string;
  recipients: number;
  sent: number;
  failed: number;
  created_at: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the session just won't survive a reload
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // The API host's firewall blocks PUT and DELETE outright; the API reads this header instead.
  if (method === "PUT" || method === "DELETE") {
    headers["X-HTTP-Method-Override"] = method;
    method = "POST";
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // Usually means BASE points at the web host instead of the API (see README, "Hosting elsewhere").
    throw new ApiError(res.status, `The server at ${BASE} didn't reply like the VolunteerKC API. Check VITE_API_BASE.`);
  }
}

export interface RawResponse {
  status: number;
  statusText: string;
  ms: number;
  body: string;
}

/**
 * Send any request and return the raw reply, error statuses included. Used by the API tester.
 * Unlike request(), a 401 here doesn't sign the admin out (testing a bad login shouldn't end the session).
 */
export async function rawRequest(method: string, path: string, body?: string): Promise<RawResponse> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  if (method === "PUT" || method === "PATCH" || method === "DELETE") {
    headers["X-HTTP-Method-Override"] = method;
    method = "POST";
  }
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body || undefined });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const text = await res.text();
  return { status: res.status, statusText: res.statusText, ms: Math.round(performance.now() - started), body: text };
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; volunteer: Volunteer }>("POST", "/api/auth/login", { email, password }),
  me: () => request<Volunteer>("GET", "/api/volunteers/me"),

  stats: () => request<Stats>("GET", "/api/admin/stats"),
  volunteers: (q?: string) =>
    request<AdminVolunteer[]>("GET", `/api/admin/volunteers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  updateVolunteer: (id: string, body: VolunteerUpdate) =>
    request<AdminVolunteer>("PUT", `/api/admin/volunteers/${id}`, body),
  deleteVolunteer: (id: string) => request<void>("DELETE", `/api/admin/volunteers/${id}`),

  opportunities: (includePast = false) =>
    request<Opportunity[]>("GET", `/api/opportunities?include_past=${includePast}`),
  opportunityEvents: (opportunityId: string) =>
    request<VolunteerEvent[]>("GET", `/api/opportunities/${opportunityId}/events`),
  /** Correct someone's arrival/departure/hours, or record a volunteer who didn't use the app. */
  updateVolunteerEvent: (opportunityId: string, volunteerId: string, body: VolunteerEventUpdate) =>
    request<VolunteerEvent>("PUT", `/api/opportunities/${opportunityId}/events/${volunteerId}`, body),
  /** History of corrections to one volunteer's event, oldest first. */
  eventChanges: (opportunityId: string, volunteerId: string) =>
    request<EventChange[]>("GET", `/api/opportunities/${opportunityId}/events/${volunteerId}/changes`),
  syncOpportunities: () => request<SyncResult>("POST", "/api/opportunities/sync"),

  sendPush: (body: {
    title: string;
    body: string;
    audience: Audience;
    opportunity_id?: string;
    volunteer_ids?: string[];
  }) => request<SendResult>("POST", "/api/admin/notifications", body),
  sendSms: (body: {
    body: string;
    audience: Exclude<Audience, "all">;
    opportunity_id?: string;
    volunteer_ids?: string[];
  }) =>
    request<SmsSendResult>("POST", "/api/admin/sms", body),

  sendEmail: (body: {
    subject: string;
    body: string;
    audience: Audience;
    opportunity_id?: string;
    volunteer_ids?: string[];
  }) => request<EmailSendResult>("POST", "/api/admin/email", body),

  messages: (channel?: Channel) =>
    request<OutboundMessage[]>("GET", `/api/admin/messages${channel ? `?channel=${channel}` : ""}`),
  /** Remove a message from the history (it has already been delivered; this doesn't unsend it). */
  deleteMessage: (id: string) => request<void>("DELETE", `/api/admin/messages/${id}`),
};
