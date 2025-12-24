'use client';

import { Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HowItWorksModal } from '@/components/HowItWorksModal';

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 glass-golden border-t border-primary/10">
      <div className="page-container">
        <div className="flex items-center justify-between h-14">
          {/* Left side - How It Works */}
          <HowItWorksModal />
          
          {/* Center - Profile */}
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
          </Button>
          
          {/* Right side - Notifications */}
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="h-5 w-5" />
            {/* Notification dot - golden glow */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full pulse-sacred glow-golden-subtle" />
          </Button>
        </div>
      </div>
    </footer>
  );
}
