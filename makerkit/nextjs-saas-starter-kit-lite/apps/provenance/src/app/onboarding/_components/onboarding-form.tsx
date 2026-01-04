'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Label } from '@kit/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';

import { updateUserRole } from '../_actions/update-user-role';

const ROLES = [
  { value: 'collector', label: 'Collector' },
  { value: 'artist', label: 'Artist' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'shop', label: 'Shop' },
];

export function OnboardingForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!role) {
      setError('Please select a role.');
      return;
    }

    startTransition(async () => {
      try {
        await updateUserRole(role);
        router.refresh();
        router.push('/');
      } catch (e) {
        setError('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="role">I am a...</Label>
        <Select onValueChange={setRole} value={role}>
          <SelectTrigger>
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving...' : 'Continue'}
      </Button>
    </form>
  );
}


