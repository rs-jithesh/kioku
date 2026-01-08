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
    ai_memory!: Table<Memory>;
    chat_messages!: Table<ChatMessage>;
    conversations!: Table<Conversation>;

    constructor() {
        super('KiokuDB');
        this.version(10).stores({
            notes: '++id, title, createdAt, updatedAt, *tags, pinned',
            reminders: '++id, text, dueAt, completed',
            memories: null,
            user_profile: null, // Retire problematic store
            ai_memory: 'key, updatedAt',
            chat_messages: '++id, conversationId, timestamp',
            conversations: '++id, updatedAt'
        });
    }
}

export const db = new AppDatabase();
