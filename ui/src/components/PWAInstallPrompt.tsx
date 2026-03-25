import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Download, X } from 'lucide-react';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Install Paperclip</h3>
          <p className="text-sm text-muted-foreground">
            Install our app for quick access and offline support
          </p>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleInstall} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Install
            </Button>
            <Button variant="ghost" onClick={handleDismiss} size="sm">
              <X className="w-4 h-4 mr-2" />
              Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
