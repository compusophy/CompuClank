'use client';

import { Activity, Bell, Code, Network, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HowItWorksModal } from '@/components/HowItWorksModal';
import Link from 'next/link';

type ViewTab = 'graph' | 'search';

interface FooterProps {
  onActivityClick?: () => void;
  viewTab?: ViewTab;
  onViewTabChange?: (tab: ViewTab) => void;
}

export function Footer({ onActivityClick, viewTab = 'graph', onViewTabChange }: FooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 glass-golden border-t border-primary/10 h-14">
      {/* Left corner - absolute */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <HowItWorksModal />
        <Link href="/old-home">
          <Button variant="ghost" size="icon" className="rounded-full opacity-50 hover:opacity-100" title="Legacy Cabals">
            <Code className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      
      {/* Center - absolute, true center of viewport */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8">
        <Button 
          variant="ghost" 
          size="icon" 
          className={`rounded-full ${viewTab === 'graph' ? 'bg-primary/20 text-primary' : ''}`}
          onClick={() => onViewTabChange?.('graph')}
          title="Graph View"
        >
          <Network className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full"
          onClick={onActivityClick}
          title="Activity"
        >
          <Activity className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`rounded-full ${viewTab === 'search' ? 'bg-primary/20 text-primary' : ''}`}
          onClick={() => onViewTabChange?.('search')}
          title="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Right corner - absolute */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
        <Button variant="ghost" size="icon" className="rounded-full relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full pulse-sacred glow-golden-subtle" />
        </Button>
      </div>
    </footer>
  );
}
