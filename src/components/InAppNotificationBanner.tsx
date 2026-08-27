import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, X, Volume2, ShieldAlert, Sparkles } from 'lucide-react';
import {
  onInAppNotification,
  getNotificationPermissionStatus,
  requestPushPermission
} from '../utils/notifications';
import { audioAlert } from '../utils/audio';

export interface InAppAlertItem {
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
}

interface InAppNotificationBannerProps {
  onConfirmDose: (payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'taken' | 'skipped' | 'pending';
    notes?: string;
  }) => Promise<void>;
  onOpenSkipModal: (payload: {
    therapyId: string;
    patientId: string;
    scheduledDate: string;
    scheduledTime: string;
    medicationName?: string;
    patientName?: string;
  }) => void;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  onConfirmDose,
  onOpenSkipModal
}) => {
  const [alerts, setAlerts] = useState<InAppAlertItem[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [permissionDismissed, setPermissionDismissed] = useState(false);

  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus());

    const unsubscribe = onInAppNotification((notif) => {
      audioAlert.playUrgentChime();
      setAlerts(prev => {
        // Prevent duplicate alerts with same tag
        if (notif.tag && prev.some(a => a.tag === notif.tag)) {
          return prev;
        }
        return [notif, ...prev.slice(0, 4)];
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleQuickTake = async (alert: InAppAlertItem) => {
    if (alert.therapyId && alert.patientId && alert.scheduledDate && alert.scheduledTime) {
      await onConfirmDose({
        therapyId: alert.therapyId,
        patientId: alert.patientId,
        scheduledDate: alert.scheduledDate,
        scheduledTime: alert.scheduledTime,
        status: 'taken'
      });
    }
    handleDismiss(alert.id);
  };

  const handleQuickSkip = (alert: InAppAlertItem) => {
    if (alert.therapyId && alert.patientId && alert.scheduledDate && alert.scheduledTime) {
      onOpenSkipModal({
        therapyId: alert.therapyId,
        patientId: alert.patientId,
        scheduledDate: alert.scheduledDate,
        scheduledTime: alert.scheduledTime,
        medicationName: alert.medicationName,
        patientName: alert.patientName
      });
    }
    handleDismiss(alert.id);
  };

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2 pointer-events-none">
      
      {/* Browser Notification Permission Prompt */}
      {permissionStatus === 'default' && !permissionDismissed && (
        <div className="bg-sky-900 text-white p-3.5 rounded-2xl shadow-xl border border-sky-700 pointer-events-auto flex items-start gap-3 animate-fade-in">
          <div className="p-2 bg-sky-800 rounded-xl shrink-0 mt-0.5">
            <Bell className="w-4 h-4 text-sky-200 animate-bounce" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold">Attiva Notifiche Push</p>
            <p className="text-sky-200 text-[11px] mt-0.5 leading-snug">
              Ricevi promemoria e solleciti anche a schermo spento o in background.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleEnablePush}
                className="px-3 py-1 bg-white text-sky-900 font-bold rounded-lg text-xs hover:bg-sky-50 transition-colors shadow-2xs"
              >
                Attiva Ora
              </button>
              <button
                onClick={() => setPermissionDismissed(true)}
                className="px-2 py-1 text-sky-200 hover:text-white text-xs"
              >
                Dopo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Dose In-App Popups */}
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="bg-white text-slate-900 rounded-2xl shadow-2xl border-2 border-rose-400 p-4 pointer-events-auto animate-fade-in flex flex-col gap-2.5 ring-4 ring-rose-100"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl animate-pulse">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-rose-900">{alert.title}</h4>
                {alert.scheduledTime && (
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Orario: {alert.scheduledTime}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              title="Chiudi avviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            {alert.body}
          </p>

          {/* Quick Action buttons right in the pop-up */}
          {alert.therapyId && alert.patientId && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => handleQuickTake(alert)}
                className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Somministrato</span>
              </button>
              <button
                onClick={() => handleQuickSkip(alert)}
                className="py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Non Somministrato</span>
              </button>
            </div>
          )}
        </div>
      ))}

    </div>
  );
};
