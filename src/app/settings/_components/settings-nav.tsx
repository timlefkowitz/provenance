'use client';

import { useEffect, useState } from 'react';
import { cn } from '@kit/ui/utils';
import { User, Palette, CreditCard, Users, LogOut, Layers } from 'lucide-react';

type Section = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const SECTIONS: Section[] = [
  { id: 'account', label: 'Account', icon: <User className="h-4 w-4" /> },
  { id: 'profiles', label: 'Profiles', icon: <Layers className="h-4 w-4" /> },
  { id: 'billing', label: 'Subscription & Billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
  { id: 'teams', label: 'Teams', icon: <Users className="h-4 w-4" /> },
  { id: 'account-actions', label: 'Account Actions', icon: <LogOut className="h-4 w-4" /> },
];

export function SettingsNav({ hasGalleryProfiles }: { hasGalleryProfiles: boolean }) {
  const [activeSection, setActiveSection] = useState('account');

  const visibleSections = SECTIONS.filter(
    (s) => s.id !== 'teams' || hasGalleryProfiles,
  );

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setActiveSection(id);
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );

    for (const section of visibleSections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [visibleSections]);

  function scrollTo(id: string) {
    setActiveSection(id);
    window.history.replaceState(null, '', `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block sticky top-24 self-start w-56 shrink-0">
        <ul className="space-y-1">
          {visibleSections.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => scrollTo(s.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-serif transition-colors',
                  activeSection === s.id
                    ? 'bg-wine/10 text-wine font-medium'
                    : 'text-ink/70 hover:bg-wine/5 hover:text-wine',
                )}
              >
                {s.icon}
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile horizontal tabs */}
      <nav className="lg:hidden sticky top-[65px] z-30 -mx-4 bg-parchment/95 backdrop-blur-sm border-b border-wine/10 px-4 overflow-x-auto">
        <div className="flex gap-1 py-2">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-serif transition-colors',
                activeSection === s.id
                  ? 'bg-wine/10 text-wine font-medium'
                  : 'text-ink/60 hover:bg-wine/5 hover:text-wine',
              )}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
