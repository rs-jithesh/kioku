import Dexie, { type Table } from 'dexie';

export interface Note {
    id?: number;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    tags: string[];
    pinned?: boolean;
}

export interface Reminder {
    id?: number;
    text: string;
    dueAt: number;
    completed: boolean;
}

export interface Memory {
    id?: number;
    key: string;
    value: string;
    updatedAt: number;
}

export interface Conversation {
    id?: number;
    title: string;
    updatedAt: number;
    lastSynthesizedMsgCount?: number; // Track rolling synthesis progress
}

export interface ChatMessage {
    id?: number;
    conversationId: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export class AppDatabase extends Dexie {
    notes!: Table<Note>;
    reminders!: Table<Reminder>;
    memories!: Table<Memory>;
    user_profile!: Table<Memory>; // New name to avoid primary key upgrade error
    chat_messages!: Table<ChatMessage>;
    conversations!: Table<Conversation>;

    constructor() {
        super('KiokuDB');
        this.version(8).stores({
            notes: '++id, title, createdAt, updatedAt, *tags, pinned',
            reminders: '++id, text, dueAt, completed',
            memories: null, // Delete old problematic store
            user_profile: '++id, &key, updatedAt',
            chat_messages: '++id, conversationId, timestamp',
            conversations: '++id, updatedAt'
        });
    }
}

export const db = new AppDatabase();
