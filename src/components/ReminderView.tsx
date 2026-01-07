import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Reminder } from '../services/db';
import { haptics } from '../services/deviceCapabilities';
import './ReminderView.css';

export const ReminderView: React.FC = () => {
    const reminders = useLiveQuery(() => db.reminders.orderBy('dueAt').toArray()) || [];

    const toggleReminder = async (reminder: Reminder) => {
        if (reminder.id) {
            haptics.light();
            await db.reminders.update(reminder.id, { completed: !reminder.completed });
        }
    };

    const deleteReminder = async (id?: number) => {
        if (id && window.confirm('Delete this reminder?')) {
            haptics.medium();
            await db.reminders.delete(id);
        }
    };

    const formatRelativeTime = (timestamp: number) => {
        const now = new Date();
        const date = new Date(timestamp);
        const isToday = now.toDateString() === date.toDateString();

        const tomorrow = new Date();
        tomorrow.setDate(now.getDate() + 1);
        const isTomorrow = tomorrow.toDateString() === date.toDateString();

        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isToday) return `Today at ${timeStr}`;
        if (isTomorrow) return `Tomorrow at ${timeStr}`;
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
    };

    const isOverdue = (timestamp: number, completed: boolean) => {
        return !completed && timestamp < Date.now();
    };

    // Grouping Logic
    const active = reminders.filter(r => !r.completed);
    const completed = reminders.filter(r => r.completed);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const groups = [
        {
            title: 'Overdue',
            items: active.filter(r => r.dueAt < Date.now()),
            className: 'overdue'
        },
        {
            title: 'Today',
            items: active.filter(r => r.dueAt >= Date.now() && r.dueAt <= todayEnd.getTime()),
            className: 'today'
        },
        {
            title: 'Tomorrow',
            items: active.filter(r => r.dueAt > todayEnd.getTime() && r.dueAt <= tomorrowEnd.getTime()),
            className: 'tomorrow'
        },
        {
            title: 'Upcoming',
            items: active.filter(r => r.dueAt > tomorrowEnd.getTime()),
            className: 'upcoming'
        }
    ];

    return (
        <div className="reminder-view">
            <header className="reminder-header">
                <h2>Reminders</h2>
                <p>AI-powered workspace tasks</p>
            </header>

            <div className="reminder-sections">
                {groups.map(group => group.items.length > 0 && (
                    <section key={group.title} className={`reminder-group ${group.className}`}>
                        <h3 className="group-title">{group.title}</h3>
                        {group.items.map(r => (
                            <div key={r.id} className={`reminder-card ${isOverdue(r.dueAt, r.completed) ? 'is-late' : ''}`}>
                                <div className="card-status-indicator"></div>
                                <div className="card-main-content">
                                    <div className="card-text-section" onClick={() => toggleReminder(r)}>
                                        <p className="reminder-text">{r.text}</p>
                                        <div className="reminder-meta">
                                            <span className="material-symbols-rounded">event</span>
                                            {formatRelativeTime(r.dueAt)}
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button className="check-btn" onClick={() => toggleReminder(r)}>
                                            <span className="material-symbols-rounded">
                                                radio_button_unchecked
                                            </span>
                                        </button>
                                        <button className="card-delete-btn" onClick={() => deleteReminder(r.id)}>
                                            <span className="material-symbols-rounded">delete_outline</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                ))}

                {active.length === 0 && (
                    <div className="empty-state-reminders">
                        <span className="material-symbols-rounded">check_circle</span>
                        <p>All caught up!</p>
                    </div>
                )}

                {completed.length > 0 && (
                    <section className="reminder-group completed">
                        <h3 className="group-title">Completed</h3>
                        {completed.map(r => (
                            <div key={r.id} className="reminder-card done">
                                <div className="card-main-content">
                                    <div className="card-text-section" onClick={() => toggleReminder(r)}>
                                        <p className="reminder-text">{r.text}</p>
                                        <div className="reminder-meta">
                                            {formatRelativeTime(r.dueAt)}
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button className="check-btn checked" onClick={() => toggleReminder(r)}>
                                            <span className="material-symbols-rounded">
                                                check_circle
                                            </span>
                                        </button>
                                        <button className="card-delete-btn" onClick={() => deleteReminder(r.id)}>
                                            <span className="material-symbols-rounded">delete_outline</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
};
