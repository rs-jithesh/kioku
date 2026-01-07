/**
 * Device Capabilities Service
 * Central service for all PWA device APIs
 */

// Types
export interface LocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export interface DeviceInfo {
    time: Date;
    timezone: string;
    online: boolean;
    battery?: {
        level: number;
        charging: boolean;
    };
    memory?: number;
}

export interface ShareData {
    title?: string;
    text?: string;
    url?: string;
}

// Geolocation
export async function getLocation(): Promise<LocationData | null> {
    if (!('geolocation' in navigator)) {
        console.warn('Geolocation not supported');
        return null;
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                console.warn('Geolocation error:', error.message);
                resolve(null);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // Cache for 5 minutes
            }
        );
    });
}

export async function requestLocationPermission(): Promise<boolean> {
    try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') return true;
        if (result.state === 'denied') return false;

        // Prompt by requesting location
        const location = await getLocation();
        return location !== null;
    } catch {
        return false;
    }
}

// Web Share API
export function canShare(): boolean {
    return 'share' in navigator;
}

export async function shareContent(data: ShareData): Promise<boolean> {
    if (!canShare()) {
        console.warn('Web Share not supported');
        return false;
    }

    try {
        await navigator.share(data);
        return true;
    } catch (error) {
        // User cancelled or error
        if ((error as Error).name !== 'AbortError') {
            console.error('Share failed:', error);
        }
        return false;
    }
}

// Vibration/Haptics
export function vibrate(pattern: number | number[] = 50): boolean {
    if (!('vibrate' in navigator)) {
        return false;
    }

    try {
        navigator.vibrate(pattern);
        return true;
    } catch {
        return false;
    }
}

// Haptic feedback patterns
export const haptics = {
    light: () => vibrate(10),
    medium: () => vibrate(50),
    heavy: () => vibrate(100),
    success: () => vibrate([50, 50, 50]),
    error: () => vibrate([100, 50, 100]),
};

// Device Info
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const info: DeviceInfo = {
        time: new Date(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        online: navigator.onLine,
    };

    // Memory (Chrome only)
    if ('deviceMemory' in navigator) {
        info.memory = (navigator as any).deviceMemory;
    }

    // Battery Status
    if ('getBattery' in navigator) {
        try {
            const battery = await (navigator as any).getBattery();
            info.battery = {
                level: battery.level,
                charging: battery.charging
            };
        } catch {
            // Battery API not available
        }
    }

    return info;
}

// Notifications
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return false;
    }

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

export function canNotify(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
}

export function showNotification(title: string, options?: NotificationOptions): void {
    if (!canNotify()) return;

    new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options
    });
}

// Online/Offline status listener
export function onNetworkChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}

// Clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        haptics.light();
        return true;
    } catch {
        return false;
    }
}

export async function readFromClipboard(): Promise<string | null> {
    try {
        return await navigator.clipboard.readText();
    } catch {
        return null;
    }
}
