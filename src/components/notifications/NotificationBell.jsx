import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function NotificationBell({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
  if (!userEmail) {
    setNotifications([]);
    return;
  }

  loadNotifications();

  const unsubscribe = base44.entities.Notification.subscribe((event) => {
    const changedRow = event?.new || event?.old || event?.data;

    if (changedRow?.user_email === userEmail) {
      loadNotifications();
    }
  });

  return () => {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  };
}, [userEmail]);

const loadNotifications = async () => {
  if (!userEmail) {
    setNotifications([]);
    return;
  }

  try {
    const allNotifs = await base44.entities.Notification.filter(
      { user_email: userEmail },
      "-created_date",
      20
    );

    setNotifications(Array.isArray(allNotifs) ? allNotifs : []);
  } catch (error) {
    console.error("Failed to load notifications:", error);
    setNotifications([]);
  }
};

  const markAsRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    loadNotifications();
  };

  const deleteNotification = async (id) => {
    await base44.entities.Notification.delete(id);
    loadNotifications();
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    for (const id of unreadIds) {
      await base44.entities.Notification.update(id, { is_read: true });
    }
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-600">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-[#1fd655] hover:text-[#1bd64d]"
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 border-b hover:bg-slate-50 transition-colors ${
                  !notif.is_read ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900 mb-1">
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-600 mb-2">{notif.message}</p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(notif.created_date), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => markAsRead(notif.id)}
                        className="h-7 w-7"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteNotification(notif.id)}
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}