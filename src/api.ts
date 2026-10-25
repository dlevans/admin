// Thin client for the VolunteerKC API (FastAPI, see /VKC/docs).

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/VKC";
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

export interface VkcEvent {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location_name: string;
  city: string;
  state: string;
  source: string;
  signup_count: number;
}

export interface Signup {
  volunteer_id: string;
  name: string;
  email: string;
  phone: string;
  signed_up_at: string;
}

export interface Stats {
  volunteers: number;
  ios_devices: number;
  android_devices: number;
  upcoming_events: number;
  push_configured: boolean;
  sms_configured: boolean;
}

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

export interface OutboundMessage {
  id: string;
  channel: "push" | "sms";
  audience: Audience;
  event_title: string | null;
  sent_by_name: string | null;
  title: string | null;
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

  events: (includePast = false) =>
    request<VkcEvent[]>("GET", `/api/events${includePast ? "?include_past=true" : ""}`),
  signups: (eventId: string) => request<Signup[]>("GET", `/api/events/${eventId}/signups`),
  syncEvents: () =>
    request<{ fetched: number; created: number; updated: number; removed: number }>("POST", "/api/events/sync"),

  sendPush: (body: {
    title: string;
    body: string;
    audience: Audience;
    event_id?: string;
    volunteer_ids?: string[];
  }) => request<SendResult>("POST", "/api/admin/notifications", body),
  sendSms: (body: { body: string; audience: Exclude<Audience, "all">; event_id?: string; volunteer_ids?: string[] }) =>
    request<SmsSendResult>("POST", "/api/admin/sms", body),

  messages: (channel?: "push" | "sms") =>
    request<OutboundMessage[]>("GET", `/api/admin/messages${channel ? `?channel=${channel}` : ""}`),
};
