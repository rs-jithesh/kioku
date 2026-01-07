import { create, insert, search } from '@orama/orama';

export interface IndexableNote {
    id: string;
    title: string;
    content: string;
    updatedAt: number;
}

class VectorStore {
    private db: any = null;

    async initialize() {
        if (this.db) return;

        this.db = await create({
            schema: {
                id: 'string',
                title: 'string',
                content: 'string',
                updatedAt: 'number'
            }
        });
        console.log('Orama Vector Store Initialized');
    }

    async indexNote(note: IndexableNote) {
        if (!this.db) await this.initialize();

        // Orama doesn't have an "upsert" by ID in the basic sense for custom IDs without extra plugins,
        // but for our MVP, we'll just insert. Future: handle deletions/updates correctly.
        await insert(this.db, {
            id: note.id,
            title: note.title,
            content: note.content,
            updatedAt: note.updatedAt
        });
    }

    async searchNotes(query: string) {
        if (!this.db) await this.initialize();

        const results = await search(this.db, {
            term: query,
            properties: ['title', 'content'],
            tolerance: 1, // Allow some fuzziness
        });

        return results.hits.map(hit => hit.document);
    }
}

export const vectorStore = new VectorStore();
