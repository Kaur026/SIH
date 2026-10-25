import { supabase } from './client';
import type { Database } from '../../types/database.types';

export type Notification = Database['public']['Tables']['notifications']['Row'];

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching notifications for ${userId}:`, error.message);
    throw error;
  }

  return data || [];
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error(`Error marking notification ${notificationId} as read:`, error.message);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error(`Error marking all notifications as read for ${userId}:`, error.message);
    throw error;
  }
}
