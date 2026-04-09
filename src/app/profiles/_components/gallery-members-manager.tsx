'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kit/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@kit/ui/avatar';
import { Badge } from '@kit/ui/badge';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@kit/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@kit/ui/alert-dialog';
import { UserPlus, Trash2, Shield, User, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isStaleServerActionError } from '~/lib/stale-server-action';
import { 
  getGalleryMembers, 
  inviteGalleryMember, 
  removeGalleryMember, 
  updateGalleryMemberRole,
  canManageGallery,
  type GalleryMember 
} from '../_actions/gallery-members';

interface GalleryMembersManagerProps {
  galleryProfileId: string;
  userId: string;
}

function staleServerActionToast() {
  toast.error(
    'This page is out of sync with the server. Hard-refresh (Cmd/Ctrl+Shift+R) to reload.',
    { id: 'stale-server-actions-gallery' },
  );
}

export function GalleryMembersManager({ galleryProfileId, userId }: GalleryMembersManagerProps) {
  const [members, setMembers] = useState<GalleryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        await loadMembers();
        if (!cancelled) await checkPermissions();
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[GalleryMembersManager] useEffect error:', msg, error);
        toast.error('Failed to load team members');
        setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [galleryProfileId, userId]);

  async function loadMembers() {
    setLoading(true);
    try {
      const { data, error } = await getGalleryMembers(galleryProfileId);
      if (error) {
        console.error('[GalleryMembersManager] getGalleryMembers error:', error);
        toast.error(error);
      } else if (data) {
        setMembers(data);
      }
    } catch (error: unknown) {
      if (isStaleServerActionError(error)) {
        console.error(
          '[GalleryMembersManager] Server action missing — stale JS after deploy?',
          error,
        );
        staleServerActionToast();
      } else {
        const msg = error instanceof Error ? error.message : 'Failed to load members';
        console.error('[GalleryMembersManager] loadMembers error', error);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function checkPermissions() {
    try {
      const can = await canManageGallery(userId, galleryProfileId);
      setCanManage(can);
    } catch (error) {
      if (isStaleServerActionError(error)) {
        console.error(
          '[GalleryMembersManager] checkPermissions stale server action',
          error,
        );
        staleServerActionToast();
      } else {
        console.error('[GalleryMembersManager] checkPermissions error', error);
      }
      setCanManage(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setInviting(true);
    try {
      const { success, error } = await inviteGalleryMember(
        galleryProfileId,
        inviteEmail.trim(),
        inviteRole
      );

      if (success) {
        toast.success(`Invited ${inviteEmail} to join the gallery`);
        setInviteEmail('');
        setInviteRole('member');
        setInviteDialogOpen(false);
        loadMembers();
      } else {
        console.error('[GalleryMembersManager] inviteGalleryMember error:', error);
        toast.error(error || 'Failed to invite member');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to invite member';
      console.error('[GalleryMembersManager] handleInvite error:', msg, error);
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(memberUserId: string, memberName: string) {
    try {
      const { success, error } = await removeGalleryMember(galleryProfileId, memberUserId);

      if (success) {
        toast.success(`Removed ${memberName} from the gallery`);
        loadMembers();
      } else {
        console.error('[GalleryMembersManager] removeGalleryMember error:', error);
        toast.error(error || 'Failed to remove member');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to remove member';
      console.error('[GalleryMembersManager] handleRemove error:', msg, error);
      toast.error(msg);
    }
  }

  async function handleRoleUpdate(memberUserId: string, newRole: 'owner' | 'admin' | 'member') {
    try {
      const { success, error } = await updateGalleryMemberRole(
        galleryProfileId,
        memberUserId,
        newRole
      );

      if (success) {
        toast.success('Member role updated');
        loadMembers();
      } else {
        console.error('[GalleryMembersManager] updateGalleryMemberRole error:', error);
        toast.error(error || 'Failed to update role');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update role';
      console.error('[GalleryMembersManager] handleRoleUpdate error:', msg, error);
      toast.error(msg);
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="default" className="bg-wine text-parchment">Owner</Badge>;
      case 'admin':
        return <Badge variant="secondary" className="bg-ink/10 text-ink">Admin</Badge>;
      default:
        return <Badge variant="outline" className="border-ink/20 text-ink/70">Member</Badge>;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Shield className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card className="border-wine/20 bg-parchment/60">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-wine" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display text-xl text-wine">
              Team members
            </CardTitle>
            <CardDescription className="font-serif">
              Add people who can manage this gallery&apos;s collection, post Certificates of Show, and manage exhibitions. They must already have a Provenance account.
            </CardDescription>
          </div>
          {canManage && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display text-wine">Add team member</DialogTitle>
                  <DialogDescription className="font-serif">
                    Enter the email of someone who already has a Provenance account. They will be able to manage collections, post Certificates of Show, and manage exhibitions for this gallery.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-serif">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="font-serif"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="font-serif">Role</Label>
                    <Select value={inviteRole} onValueChange={(v: 'admin' | 'member') => setInviteRole(v)}>
                      <SelectTrigger id="role" className="font-serif">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member – Can manage collections, post certificates, and manage exhibitions</SelectItem>
                        <SelectItem value="admin">Admin – Can do everything Members can, plus add or remove team members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                    className="font-serif"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim()}
                    className="bg-wine text-parchment hover:bg-wine/90 font-serif"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-ink/60 font-serif mb-4">
              No team members yet
            </p>
            {canManage && (
              <Button
                onClick={() => setInviteDialogOpen(true)}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Your First Member
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isCurrentUser = member.user_id === userId;
              const canEditRole = canManage && !isCurrentUser && member.role !== 'owner';
              const canRemove = canManage && !isCurrentUser;

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border border-ink/10 rounded-lg bg-parchment/40"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.picture_url || undefined} />
                      <AvatarFallback className="bg-wine/10 text-wine font-serif">
                        {member.user?.name?.[0]?.toUpperCase() || member.user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="font-serif font-medium text-ink truncate">
                          {member.user?.name || member.user?.email || 'Unknown User'}
                        </p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      {member.user?.email && member.user?.name && (
                        <p className="text-sm text-ink/60 font-serif truncate">
                          {member.user.email}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {getRoleBadge(member.role)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {canEditRole && (
                      <Select
                        value={member.role}
                        onValueChange={(v: 'owner' | 'admin' | 'member') => 
                          handleRoleUpdate(member.user_id, v)
                        }
                      >
                        <SelectTrigger className="w-32 font-serif">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {canRemove && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-display text-wine">
                              Remove Team Member
                            </AlertDialogTitle>
                            <AlertDialogDescription className="font-serif">
                              Are you sure you want to remove {member.user?.name || member.user?.email} from this gallery? 
                              They will no longer be able to post or manage content.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="font-serif">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemove(
                                member.user_id,
                                member.user?.name || member.user?.email || 'this member'
                              )}
                              className="bg-red-600 hover:bg-red-700 font-serif"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!canManage && members.length > 0 && (
          <Alert className="mt-4 border-ink/20 bg-parchment/40">
            <AlertDescription className="font-serif text-sm text-ink/70">
              You can manage this gallery&apos;s collections and certificates. Only owners and admins can add or remove team members.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
