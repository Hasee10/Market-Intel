'server-only';

import { createClient } from '@/lib/supabase/server';

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
};

// Read-side counterpart to lib/notifications/notify.ts. RLS
// (seller_notifications_select_own, 014) already scopes this to the
// calling seller.
export async function listNotifications(sellerId: string, limit = 50): Promise<Notification[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('seller_notifications')
    .select('id, type, title, message, metadata, is_read, created_at')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    metadata: row.metadata,
    isRead: row.is_read,
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(notificationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('seller_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw new Error(error.message);
}

// Clearing a feed one row at a time is N round trips for what is one
// UPDATE. Scoped by seller_id as well as is_read: RLS
// (seller_notifications_select_own, 014) already confines this to the
// caller, but an unfiltered update is the kind of thing that only stays
// safe as long as the policy does.
export async function markAllNotificationsRead(sellerId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('seller_notifications')
    .update({ is_read: true })
    .eq('seller_id', sellerId)
    .eq('is_read', false);

  if (error) throw new Error(error.message);
}
