'use client';

const KEY = 'bliep:mailbox:v1';
const EVENT = 'bliep:mailbox-changed';

export interface MailItem {
  id: string;
  type: 'chest' | 'system' | 'reward';
  title: string;
  body: string;
  coins?: number;
  receivedAt: number;
  read: boolean;
}

export interface MailboxState {
  items: MailItem[];
}

function empty(): MailboxState {
  return { items: [] };
}

export function loadMailbox(): MailboxState {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MailboxState;
  } catch { /* ignore */ }
  return empty();
}

export function saveMailbox(state: MailboxState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function addMailItem(item: Omit<MailItem, 'id' | 'receivedAt' | 'read'>): MailItem {
  const full: MailItem = {
    ...item,
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    receivedAt: Date.now(),
    read: false,
  };
  const state = loadMailbox();
  state.items = [full, ...state.items].slice(0, 50);
  saveMailbox(state);
  return full;
}

export function markAllRead() {
  const state = loadMailbox();
  state.items = state.items.map(i => ({ ...i, read: true }));
  saveMailbox(state);
}

export function unreadCount(): number {
  return loadMailbox().items.filter(i => !i.read).length;
}

export const MAILBOX_CHANGED_EVENT = EVENT;
