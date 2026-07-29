'server-only';

import { createAdminClient } from '@/lib/supabase/server';

export type NotificationType = 'price_alert' | 'low_stock' | 'churn_risk';

export type CreateNotificationInput = {
  sellerId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

// Single entry point for every notification-producing job (price alerts now,
// low-stock/churn-risk in Phase 3) so they share one delivery mechanism
// instead of each growing its own read/unread tracking. In-app only for
// now (writes seller_notifications) - email is a deliberate no-op until a
// provider is chosen, per new_implementation_doc.md's "add email next".
export async function createNotification(input: CreateNotificationInput) {
  const supabase = createAdminClient();

  const { error } = await supabase.from('seller_notifications').insert({
    seller_id: input.sellerId,
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
  });

  if (error) throw new Error(`Failed to create notification: ${error.message}`);

  await sendEmailStub(input);
}

// Deliberate no-op: logs instead of sending until an email provider is
// chosen. Kept as a real call site (not just a comment) so wiring in a
// provider later is a one-function change, not a new pipeline.
async function sendEmailStub(input: CreateNotificationInput) {
  void input;
}
