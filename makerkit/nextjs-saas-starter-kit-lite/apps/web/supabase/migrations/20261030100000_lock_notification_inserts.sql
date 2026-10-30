/*
 * -------------------------------------------------------
 * Lock notification inserts to the server
 * The original notifications_insert policy was `with check (true)`, so any
 * signed-in user could use the public anon key to write a notification (any
 * title, message, type, artwork link) into any other user's inbox, and the
 * push trigger would deliver it to their iPhone.
 *
 * Notifications are now written only by the service role (createNotification
 * in src/lib/notifications.ts, crons, webhooks) and by security definer
 * triggers such as notify_gallery_member_added. Signed-in users keep read and
 * mark-as-read on their own rows.
 *
 * ORDER: deploy the app change that moves createNotification to the admin
 * client before applying this, or in-app notifications from the old build
 * fail until the deploy lands.
 *
 * Data-safe: drops one policy and one grant; no rows are touched.
 * -------------------------------------------------------
 */

drop policy if exists notifications_insert on public.notifications;

revoke insert on table public.notifications from authenticated, anon;
