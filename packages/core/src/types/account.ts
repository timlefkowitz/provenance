export interface Account {
  id: string;
  name: string;
  email: string | null;
  picture_url: string | null;
  public_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}
