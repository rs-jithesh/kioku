import { useState, useEffect } from 'react';

/**
 * Custom hook to handle PWA installation prompt
 */
export function usePWAInstall() {
    const [installPrompt, setInstallPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop' | 'unknown'>('unknown');

    useEffect(() => {
        // Detect Platform
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(userAgent)) {
            setPlatform('ios');
        } else if (/android/.test(userAgent)) {
            setPlatform('android');
        } else {
            setPlatform('desktop');
        }

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
            setIsInstalled(true);
        }

        const handleBeforeInstallPrompt = (e: any) => {
            console.log('Capture beforeinstallprompt event');
            e.preventDefault();
            setInstallPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setInstallPrompt(null);
            console.log('Kioku was installed!');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Debug: Log status
        console.log('PWA status:', {
            installable: !!installPrompt,
            installed: window.matchMedia('(display-mode: standalone)').matches
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const promptInstall = async () => {
        if (platform === 'ios') {
            alert('To install Kioku on iOS, tap the Share icon and select "Add to Home Screen".');
            return;
        }

        if (!installPrompt) {
            console.warn('Install prompt not available');
            return;
        }

        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        setInstallPrompt(null);
    };

    return {
        isInstallable: !!installPrompt || (platform === 'ios' && !isInstalled),
        isInstalled,
        platform,
        promptInstall
    };
}
