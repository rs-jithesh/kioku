import React, { useState, useRef } from 'react';
import { db, type Note } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MDButton } from './common/MDButton';
import { MDCard } from './common/MDCard';
import { MDInput } from './common/MDInput';
import { vectorStore } from '../services/vectorStore';
import { shareContent, canShare, haptics } from '../services/deviceCapabilities';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MDFab } from './common/MDFab';
import './NoteEditor.css';

export const NoteEditor: React.FC = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'pinned'>('all');
    const [previewMode, setPreviewMode] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const allNotes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray()) || [];
    const pinnedNotes = allNotes.filter(n => n.pinned);
    const displayedNotes = activeTab === 'all' ? allNotes : pinnedNotes;

    const handleSave = async () => {
        if (!title.trim() && !content.trim()) return;

        const noteData = {
            title,
            content,
            updatedAt: Date.now()
        };

        if (editId !== null) {
            await db.notes.update(editId, noteData);
            await vectorStore.indexNote({
                id: editId.toString(),
                ...noteData
            });
        } else {
            const id = await db.notes.add({
                ...noteData,
                createdAt: Date.now(),
                tags: [],
                pinned: false
            });
            await vectorStore.indexNote({
                id: id.toString(),
                ...noteData
            });
        }

        resetForm();
    };

    const resetForm = () => {
        setTitle('');
        setContent('');
        setIsEditing(false);
        setEditId(null);
        setPreviewMode(false);
    };

    const handleEdit = (note: Note) => {
        setTitle(note.title);
        setContent(note.content);
        setEditId(note.id || null);
        setIsEditing(true);
    };

    const handleDelete = async (id?: number) => {
        if (id && window.confirm('Delete this note?')) {
            await db.notes.delete(id);
        }
    };

    const togglePin = async (note: Note) => {
        if (note.id) {
            await db.notes.update(note.id, { pinned: !note.pinned });
        }
    };

    const insertFormat = (prefix: string, suffix: string = '') => {
        if (!textareaRef.current) return;

        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = textareaRef.current.value;
        const selection = text.substring(start, end);

        const newText = text.substring(0, start) + prefix + selection + suffix + text.substring(end);
        setContent(newText);

        // Refocus and set cursor
        setTimeout(() => {
            textareaRef.current?.focus();
            const newPos = start + prefix.length + selection.length + suffix.length;
            textareaRef.current?.setSelectionRange(newPos, newPos);
        }, 0);
    };

    return (
        <div className="note-view-container">
            {/* Tabs */}
            <div className="notes-tabs">
                <button
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All Notes
                </button>
                <button
                    className={`tab-btn ${activeTab === 'pinned' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pinned')}
                >
                    Pinned
                </button>
            </div>

            {/* Scrollable Grid */}
            <div className="notes-scroll-area">
                <div className="notes-grid">
                    {displayedNotes.map(note => (
                        <MDCard key={note.id} className={`note-item ${note.pinned ? 'pinned' : ''}`}>
                            <div className="note-card-header">
                                <div className="note-title-group" onClick={() => handleEdit(note)}>
                                    <h3>{note.title || 'Untitled Note'}</h3>
                                    <small>{new Date(note.updatedAt).toLocaleDateString()}</small>
                                </div>
                                <div className="note-card-actions">
                                    {canShare() && (
                                        <button className="icon-btn-small" onClick={() => {
                                            haptics.light();
                                            shareContent({
                                                title: note.title,
                                                text: note.content,
                                                url: window.location.href
                                            });
                                        }}>
                                            <span className="material-symbols-rounded">share</span>
                                        </button>
                                    )}
                                    <button
                                        className={`icon-btn-small pin-btn ${note.pinned ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); togglePin(note); }}
                                        title={note.pinned ? "Unpin" : "Pin"}
                                    >
                                        <span className="material-symbols-rounded">
                                            {note.pinned ? 'keep' : 'keep_off'}
                                        </span>
                                    </button>
                                    <button className="icon-btn-small" onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }} title="Delete">
                                        <span className="material-symbols-rounded">delete</span>
                                    </button>
                                </div>
                            </div>
                            <div className="note-content-preview" onClick={() => handleEdit(note)}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content}
                                </ReactMarkdown>
                            </div>
                        </MDCard>
                    ))}
                    {displayedNotes.length === 0 && (
                        <div className="empty-state">
                            <span className="material-symbols-rounded">sticky_note_2</span>
                            <p>No notes found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Button */}
            <div className="fab-container">
                <MDFab icon="add" onClick={() => setIsEditing(true)} />
            </div>

            {/* Modal Editor */}
            {isEditing && (
                <div className="note-modal-overlay" onClick={resetForm}>
                    <div className="note-modal-content" onClick={e => e.stopPropagation()}>
                        <header className="modal-header">
                            <div className="modal-title-area">
                                <h2>{editId ? 'Edit Note' : 'New Note'}</h2>
                                <div className="preview-toggle">
                                    <button
                                        className={`toggle-btn ${!previewMode ? 'active' : ''}`}
                                        onClick={() => setPreviewMode(false)}
                                    >
                                        Write
                                    </button>
                                    <button
                                        className={`toggle-btn ${previewMode ? 'active' : ''}`}
                                        onClick={() => setPreviewMode(true)}
                                    >
                                        Preview
                                    </button>
                                </div>
                            </div>
                            <button className="icon-btn" onClick={resetForm}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </header>

                        {!previewMode && (
                            <div className="editor-toolbar">
                                <button onClick={() => insertFormat('**', '**')} title="Bold">
                                    <span className="material-symbols-rounded">format_bold</span>
                                </button>
                                <button onClick={() => insertFormat('_', '_')} title="Italic">
                                    <span className="material-symbols-rounded">format_italic</span>
                                </button>
                                <button onClick={() => insertFormat('\n- ')} title="List">
                                    <span className="material-symbols-rounded">format_list_bulleted</span>
                                </button>
                                <button onClick={() => insertFormat('[', '](url)')} title="Link">
                                    <span className="material-symbols-rounded">link</span>
                                </button>
                                <button onClick={() => insertFormat('\n### ')} title="Heading">
                                    <span className="material-symbols-rounded">format_size</span>
                                </button>
                                <button onClick={() => insertFormat('\n```\n', '\n```')} title="Code">
                                    <span className="material-symbols-rounded">code</span>
                                </button>
                            </div>
                        )}

                        <div className="modal-body">
                            <MDInput
                                label="Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                autoFocus={!editId}
                            />

                            {previewMode ? (
                                <div className="note-preview-area">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {content || '*No content yet*'}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <textarea
                                    ref={textareaRef}
                                    className="note-textarea"
                                    placeholder="Start typing your thoughts using Markdown..."
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                />
                            )}
                        </div>
                        <footer className="modal-footer">
                            <MDButton variant="filled" icon="save" onClick={handleSave}>
                                {editId ? 'Update' : 'Create'}
                            </MDButton>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};
