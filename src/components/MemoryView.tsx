import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { MDCard } from './common/MDCard';
import './MemoryView.css';

export const MemoryView: React.FC = () => {
    const memories = useLiveQuery(() => db.user_profile.orderBy('updatedAt').reverse().toArray()) || [];

    const handleDelete = async (id?: number) => {
        if (id && window.confirm('Clear this memory?')) {
            await db.user_profile.delete(id);
        }
    };

    return (
        <div className="memory-view-container">
            <div className="memory-header">
                <h2>Digital Brain 🧠</h2>
                <p>Facts the AI has learned about you through conversation.</p>
            </div>

            {memories.length === 0 ? (
                <div className="empty-memory">
                    <span className="material-symbols-rounded">psychology_alt</span>
                    <p>No memories yet. Start chatting to build your profile!</p>
                </div>
            ) : (
                <div className="memory-grid">
                    {memories.map(memory => (
                        <MDCard key={memory.id} className="memory-item">
                            <div className="memory-item-content">
                                <span className="memory-key">{memory.key.replace(/_/g, ' ')}</span>
                                <p className="memory-value">{memory.value}</p>
                                <div className="memory-footer">
                                    <small>{new Date(memory.updatedAt).toLocaleDateString()}</small>
                                    <button className="icon-btn-tiny" onClick={() => handleDelete(memory.id)}>
                                        <span className="material-symbols-rounded">close</span>
                                    </button>
                                </div>
                            </div>
                        </MDCard>
                    ))}
                </div>
            )}
        </div>
    );
};
