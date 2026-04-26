'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Image as ImageIcon, FileText, Link as LinkIcon } from 'lucide-react';
import { Button } from '@kit/ui/button';

export default function ShareTargetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sharedData, setSharedData] = useState<{
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get shared data from URL params (for GET requests)
    const title = searchParams.get('title') || undefined;
    const text = searchParams.get('text') || undefined;
    const url = searchParams.get('url') || undefined;

    if (title || text || url) {
      setSharedData({ title, text, url });
      setIsLoading(false);
    } else {
      // No data shared
      setIsLoading(false);
    }
  }, [searchParams]);

  const handleAddToCollection = () => {
    // Build query params for the add artwork page
    const params = new URLSearchParams();
    if (sharedData?.title) params.set('title', sharedData.title);
    if (sharedData?.text) params.set('description', sharedData.text);
    if (sharedData?.url) params.set('source', sharedData.url);
    
    router.push(`/artworks/add?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-viewport flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-wine" />
      </div>
    );
  }

  if (!sharedData || (!sharedData.title && !sharedData.text && !sharedData.url && !sharedData.files?.length)) {
    return (
      <div className="min-h-viewport flex flex-col items-center justify-center px-6 text-center">
        <FileText className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-display text-foreground mb-2">Nothing Shared</h1>
        <p className="text-muted-foreground mb-6">
          No content was received. Try sharing again from another app.
        </p>
        <Button onClick={() => router.push('/')}>
          Go Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-viewport px-6 py-8 pt-safe">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-display text-foreground mb-2">
            Content Received
          </h1>
          <p className="text-muted-foreground">
            Add this to your collection or save for later
          </p>
        </div>

        {/* Shared content preview */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {sharedData.title && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Title</p>
                <p className="text-foreground font-medium">{sharedData.title}</p>
              </div>
            </div>
          )}

          {sharedData.text && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                <p className="text-foreground">{sharedData.text}</p>
              </div>
            </div>
          )}

          {sharedData.url && (
            <div className="flex items-start gap-3">
              <LinkIcon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Link</p>
                <a 
                  href={sharedData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-wine hover:underline break-all"
                >
                  {sharedData.url}
                </a>
              </div>
            </div>
          )}

          {sharedData.files && sharedData.files.length > 0 && (
            <div className="flex items-start gap-3">
              <ImageIcon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Files</p>
                <p className="text-foreground">
                  {sharedData.files.length} file{sharedData.files.length > 1 ? 's' : ''} received
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            onClick={handleAddToCollection}
            className="w-full bg-wine hover:bg-wine/90 text-white"
            size="lg"
          >
            Add to Collection
          </Button>
          <Button 
            onClick={() => router.push('/')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
