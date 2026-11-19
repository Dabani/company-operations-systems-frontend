export const CHAT_POLL_MS = 4000;
export const CHAT_MAX = 1000;

export interface ChatMessage { id: string; name: string; is_guest: boolean; host: boolean; body: string | null; removed: boolean; at: string; mine: boolean }
export interface ChatResponse { data: ChatMessage[]; meta: { last_id: string | null; can_post: boolean; can_remove: boolean } }
export interface PollOption { id: string; label: string; votes?: number; percent?: number; leader?: boolean }
export interface Poll {
  id: string; question: string; status: 'open' | 'closed'; multiple: boolean; max_choices: number; anonymous: boolean; guests_vote: boolean; agenda_item: string | null; created_at: string; closed_at: string | null;
  voters: number | null; has_voted: boolean; my_options: string[]; can_vote: boolean; options: PollOption[]; voter_names?: { name: string; options: string[] }[];
}
export interface PollsResponse { data: Poll[]; meta: { can_create: boolean } }

/** Same rules as the server: 1 to 1000 characters after trimming. */
export const messageOk = (s: string): boolean => { const n = s.trim().length; return n >= 1 && n <= CHAT_MAX; };

/** A poll form is valid with a question of 3 to 300 characters and 2 to 10 different, non-empty options. */
export function pollFormOk(question: string, options: string[]): boolean {
  const q = question.trim().length;
  const labels = options.map((o) => o.trim());
  if (q < 3 || q > 300 || labels.length < 2 || labels.length > 10) return false;
  if (labels.some((l) => l === '' || l.length > 150)) return false;
  return new Set(labels.map((l) => l.toLowerCase())).size === labels.length;
}

/** Whether the number of ticked options is allowed (single choice: exactly one; multiple: 1 up to the maximum, 0 = no limit). */
export function choicesOk(selected: number, multiple: boolean, maxChoices: number, optionCount: number): boolean {
  if (selected < 1 || selected > optionCount) return false;
  return multiple ? maxChoices === 0 || selected <= maxChoices : selected === 1;
}

/** Whether the list should scroll to the newest message: the reader is already near the bottom, or sent the last message. */
export const shouldStick = (scrollTop: number, clientHeight: number, scrollHeight: number): boolean => scrollHeight - (scrollTop + clientHeight) < 80;
