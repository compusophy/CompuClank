'use client';

import { Briefcase, Bell, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-t">
      <div className="page-container">
        <div className="flex items-center justify-between h-14">
          {/* Left side - Portfolio */}
          <Button variant="ghost" size="icon" className="rounded-full">
            <Briefcase className="h-5 w-5" />
          </Button>
          
          {/* Center - Search */}
          <Button variant="ghost" size="icon" className="rounded-full">
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Right side - Notifications & Profile */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full relative">
              <Bell className="h-5 w-5" />
              {/* Notification dot */}
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
