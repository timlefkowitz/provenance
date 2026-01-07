'use client';

import Link from 'next/link';
import { useUser } from '@kit/supabase/hooks/use-user';
import { Button } from '@kit/ui/button';
import pathsConfig from '~/config/paths.config';
import { ProfileAccountDropdownContainer } from './personal-account-dropdown-container';

export function Navigation() {
  const user = useUser();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-wine/20 bg-parchment/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-8">
        <Link 
          href="/" 
          className="text-2xl font-display font-bold tracking-widest uppercase text-wine hover:text-wine/80 transition-colors"
        >
          Provenance
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link 
            href="/artworks" 
            className="text-ink hover:text-wine transition-colors font-serif"
          >
            Artworks
          </Link>
          <Link 
            href="/registry" 
            className="text-ink hover:text-wine transition-colors font-serif"
          >
            Registry
          </Link>
          <Link 
            href="/about" 
            className="text-ink hover:text-wine transition-colors font-serif"
          >
            About
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {user.data ? (
          <>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Link href="/artworks/add">Add Artwork</Link>
            </Button>
            <ProfileAccountDropdownContainer />
          </>
        ) : (
          <>
            <Button 
              asChild 
              variant="ghost" 
              size="sm"
              className="text-ink hover:text-wine hover:bg-wine/10 font-serif"
            >
              <Link href={pathsConfig.auth.signIn}>Log In</Link>
            </Button>
            <Button 
              asChild 
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Link href={pathsConfig.auth.signUp}>Sign Up</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}

