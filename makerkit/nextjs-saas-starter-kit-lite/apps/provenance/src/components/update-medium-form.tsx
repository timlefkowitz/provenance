'use client';

import { useState, useTransition, useEffect } from 'react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { updateMedium } from '~/app/settings/_actions/update-medium';

export function UpdateMediumForm({ 
  currentMedium = '' 
}: { 
  currentMedium?: string;
}) {
  const [medium, setMedium] = useState(currentMedium);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Update state when currentMedium prop changes
  useEffect(() => {
    setMedium(currentMedium);
  }, [currentMedium]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const result = await updateMedium(medium);
        
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        }
      } catch (e) {
        setError('Something went wrong. Please try again.');
        console.error(e);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>Medium updated successfully!</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="medium">Default Medium</Label>
        <Input
          id="medium"
          value={medium}
          onChange={(e) => setMedium(e.target.value)}
          placeholder="e.g., Oil on Canvas, Acrylic on Paper, Digital Art"
          className="font-serif"
        />
        <p className="text-sm text-ink/60 font-serif">
          This will be automatically filled in when you create new artworks
        </p>
      </div>

      <Button
        type="submit"
        disabled={pending}
        className="bg-wine text-parchment hover:bg-wine/90 font-serif"
      >
        {pending ? 'Saving...' : 'Save Medium'}
      </Button>
    </form>
  );
}

