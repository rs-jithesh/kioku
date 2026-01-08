import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { MDCard } from './common/MDCard';
import './MemoryView.css';
import { haptics } from '../services/deviceCapabilities';
import { MDDialog } from './common/MDDialog';

export const MemoryView: React.FC = () => {
    const memories = useLiveQuery(() => db.ai_memory.orderBy('updatedAt').reverse().toArray()) || [];
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);

    const handleDelete = async () => {
        if (memoryToDelete) {
            await db.ai_memory.delete(memoryToDelete);
            haptics.success();
            setDeleteDialogOpen(false);
            setMemoryToDelete(null);
        }
    };

    const confirmDelete = (key: string) => {
        setMemoryToDelete(key);
        setDeleteDialogOpen(true);
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
                        <MDCard key={memory.key} className="memory-item">
                            <div className="memory-item-content">
                                <span className="memory-key">{memory.key.replace(/_/g, ' ')}</span>
                                <p className="memory-value">{memory.value}</p>
                                <div className="memory-footer">
                                    <small>{new Date(memory.updatedAt).toLocaleDateString()}</small>
                                    <button className="icon-btn-tiny" onClick={() => confirmDelete(memory.key)}>
                                        <span className="material-symbols-rounded">delete</span>
                                    </button>
                                </div>
                            </div>
                        </MDCard>
                    ))}
                </div>
            )}

            <MDDialog
                isOpen={deleteDialogOpen}
                onClose={() => {
                    setDeleteDialogOpen(false);
                    setMemoryToDelete(null);
                }}
                title="Clear Memory?"
                message={`Are you sure you want to forget this fact about yourself: "${memoryToDelete?.replace(/_/g, ' ')}"?`}
                icon="psychology_alt"
                variant="confirm"
                confirmText="ForgetRequest"
                cancelText="Keep Fact"
                onConfirm={handleDelete}
            />
        </div>
    );
};
