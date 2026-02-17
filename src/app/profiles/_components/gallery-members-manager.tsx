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

export function GalleryMembersManager({ galleryProfileId, userId }: GalleryMembersManagerProps) {
  const [members, setMembers] = useState<GalleryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadMembers();
    checkPermissions();
  }, [galleryProfileId, userId]);

  async function loadMembers() {
    setLoading(true);
    try {
      const { data, error } = await getGalleryMembers(galleryProfileId);
      if (error) {
        toast.error(error);
      } else if (data) {
        setMembers(data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  async function checkPermissions() {
    try {
      const can = await canManageGallery(userId, galleryProfileId);
      setCanManage(can);
    } catch (error) {
      console.error('Error checking permissions:', error);
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
        toast.error(error || 'Failed to invite member');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite member');
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
        toast.error(error || 'Failed to remove member');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
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
        toast.error(error || 'Failed to update role');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
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
              Team Members
            </CardTitle>
            <CardDescription className="font-serif">
              Manage who can post and manage content for this gallery
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
                  <DialogTitle className="font-display text-wine">Invite Team Member</DialogTitle>
                  <DialogDescription className="font-serif">
                    Invite a user by their email address to join this gallery team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-serif">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
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
                        <SelectItem value="member">Member - Can post and manage content</SelectItem>
                        <SelectItem value="admin">Admin - Can manage members and content</SelectItem>
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
              You are a member of this gallery. Only owners and admins can manage team members.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
