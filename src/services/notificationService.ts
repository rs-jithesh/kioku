import { db } from './db';
import { showNotification, canNotify } from './deviceCapabilities';

class ReminderMonitor {
    private intervalId: number | null = null;
    private notifiedIds: Set<number> = new Set();

    start() {
        if (this.intervalId) return;

        // Run every 30 seconds
        this.intervalId = window.setInterval(() => this.checkReminders(), 30000);
        // Run immediately on start
        this.checkReminders();
        console.log('Reminder monitor started');
    }

    stop() {
        if (this.intervalId) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async checkReminders() {
        if (!canNotify()) return;

        const now = Date.now();
        try {
            // Find uncompleted reminders that are due
            const dueReminders = await db.reminders
                .where('dueAt')
                .belowOrEqual(now)
                .and(r => !r.completed)
                .toArray();

            for (const reminder of dueReminders) {
                if (reminder.id && !this.notifiedIds.has(reminder.id)) {
                    this.triggerNotification(reminder);
                    this.notifiedIds.add(reminder.id);
                }
            }
        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    private triggerNotification(reminder: any) {
        showNotification('Kioku Reminder ⏰', {
            body: reminder.text,
            tag: `reminder-${reminder.id}`,
            data: { reminderId: reminder.id }
        });
    }
}

export const reminderMonitor = new ReminderMonitor();
