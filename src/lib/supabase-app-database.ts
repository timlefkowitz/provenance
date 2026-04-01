import type { Database, Json } from '@kit/supabase/database';
import type { UserProfile } from '~/app/profiles/_actions/get-user-profiles';

/**
 * Starter-kit `Database` only ships `accounts` in public.Tables.
 * Merge app tables so browser/server clients can type `.from('…')` correctly.
 */
export type AppDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      user_profiles: {
        Row: UserProfile;
        Insert: Omit<UserProfile, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string | null;
          artwork_id: string | null;
          related_user_id: string | null;
          metadata: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message?: string | null;
          artwork_id?: string | null;
          related_user_id?: string | null;
          metadata?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          read: boolean;
          title: string;
          message: string | null;
          metadata: Json;
        }>;
        Relationships: [];
      };
    };
  };
};
