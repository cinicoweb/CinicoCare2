// Browser Push Notification & Multi-channel Alert Utility

type InAppNotificationListener = (notif: {
  id: string;
  title: string;
  body: string;
  tag?: string;
  therapyId?: string;
  patientId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  medicationName?: string;
  patientName?: string;
}) => void;

const inAppListeners: Set<InAppNotificationListener> = new Set();

export function onInAppNotification(listener: InAppNotificationListener) {
  inAppListeners.add(listener);
  return () => {
    inAppListeners.delete(listener);
  };
}

export function dispatchInAppAlert(payload: {
  title: string;
  body: string;
  tag?: string;
  therapyId?: string;
  patientId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  medicationName?: string;
  patientName?: string;
}) {
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...payload
  };
  inAppListeners.forEach(listener => {
    try {
      listener(item);
    } catch (e) {
      console.warn('In-app listener error:', e);
    }
  });
}

export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return false;
    }
  }

  return false;
}

export function showLocalNotification(
  title: string,
  options: NotificationOptions & {
    therapyId?: string;
    patientId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    medicationName?: string;
    patientName?: string;
  } = {}
) {
  // 1. Dispatch in-app banner/modal alert for guaranteed visibility in browser & iframe
  dispatchInAppAlert({
    title,
    body: options.body || '',
    tag: options.tag,
    therapyId: options.therapyId,
    patientId: options.patientId,
    scheduledDate: options.scheduledDate,
    scheduledTime: options.scheduledTime,
    medicationName: options.medicationName,
    patientName: options.patientName
  });

  // 2. Vibration feedback on smartphones
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([250, 100, 250]);
    } catch (e) {
      // Ignore vibration restriction
    }
  }

  // 3. Browser system push notification
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      // Try ServiceWorker first if available (works on Mobile PWA & Android Chrome)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            icon: '/icon.svg',
            badge: '/icon.svg',
            ...options
          });
        }).catch(() => {
          new Notification(title, {
            icon: '/icon.svg',
            badge: '/icon.svg',
            ...options
          });
        });
      } else {
        new Notification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          ...options
        });
      }
    } catch (e) {
      console.warn('System Notification error, displayed via in-app alert instead:', e);
    }
  }
}

export function buildWhatsAppShareUrl(phone: string, text: string): string {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}
