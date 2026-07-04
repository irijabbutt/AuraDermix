import React, { useState, useEffect } from "react";
import { Bell, BellOff, Clock, Sparkles, Check, Play, AlertCircle, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SkincareReminder } from "../types";

interface RemindersProps {
  reminders: SkincareReminder[];
  onUpdateReminders: (reminders: SkincareReminder[]) => void;
}

export default function Reminders({ reminders, onUpdateReminders }: RemindersProps) {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [inAppToast, setInAppToast] = useState<{ title: string; body: string } | null>(null);
  
  // New Reminder form states
  const [newLabel, setNewLabel] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("08:00");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Read initial permission status
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      showToast("Compatibility Note", "Push Notifications are unsupported on this browser. Aura Dermix will use In-App reminders.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        showToast("System Link Established", "Real browser push notifications have been activated successfully!");
      }
    } catch (err) {
      console.warn("Notification request rejected:", err);
      setNotificationPermission("denied");
    }
  };

  const showToast = (title: string, body: string) => {
    setInAppToast({ title, body });
    // Sound cue simulation
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // high chime
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio context might be blocked or unavailable, ignore
    }
  };

  // Check reminder matching background loop (runs once per minute in prod, simulated here)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      
      const currentDayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];

      reminders.forEach((rem) => {
        if (rem.active && rem.time === currentTimeStr && rem.days.includes(currentDayShort)) {
          triggerReminderNotification(rem);
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [reminders]);

  const triggerReminderNotification = (reminder: SkincareReminder) => {
    const title = `Aura Dermix Routine: ${reminder.label}`;
    const body = `It's ${reminder.time}! Take 3 minutes to nurture your skin health and update your progress diary.`;

    // Trigger real system push notification if allowed
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico"
        });
      } catch (e) {
        console.warn("Iframe blocked native notification constructor, invoking in-app notification:", e);
      }
    }

    // Always trigger beautiful in-app toast notification
    showToast(title, body);
  };

  // Test triggers for user immediate confirmation
  const testReminder = (reminder: SkincareReminder) => {
    triggerReminderNotification(reminder);
  };

  const handleToggleReminder = (id: string) => {
    const updated = reminders.map((r) => {
      if (r.id === id) return { ...r, active: !r.active };
      return r;
    });
    onUpdateReminders(updated);
  };

  const handleDeleteReminder = (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    onUpdateReminders(updated);
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const newRem: SkincareReminder = {
      id: "rem_" + Math.random().toString(36).substr(2, 9),
      label: newLabel,
      time: newTime,
      days: [...selectedDays],
      active: true
    };

    onUpdateReminders([...reminders, newRem]);
    setNewLabel("");
    showToast("Reminder Set", `"${newRem.label}" has been successfully scheduled for ${newRem.time}.`);
  };

  const toggleDaySelection = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-2 space-y-8" id="reminders-root">
      
      {/* Interactive Floating Reminders Toast */}
      <AnimatePresence>
        {inAppToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-brand-charcoal text-brand-cream px-6 py-4 rounded-2xl shadow-2xl border border-brand-lilac/30 max-w-md w-[90%] flex items-start gap-3.5"
            id="notification-alert-box"
          >
            <Bell className="text-brand-lilac w-6 h-6 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1">
              <h5 className="font-serif font-bold text-sm text-brand-lilac">{inAppToast.title}</h5>
              <p className="text-xs text-gray-300 mt-1">{inAppToast.body}</p>
              <button 
                onClick={() => setInAppToast(null)}
                className="mt-3 text-[10px] uppercase font-mono tracking-wider font-semibold bg-brand-purple text-brand-lilac px-2.5 py-1 rounded-md hover:bg-brand-purple/80 transition-colors"
                id="btn-dismiss-toast"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Scheduled Reminders List */}
        <div className="md:col-span-7 bg-brand-card rounded-3xl p-6 shadow-sm border border-brand-darkcream/40 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-xl font-bold text-brand-charcoal flex items-center gap-2">
              <Clock className="text-brand-purple w-5 h-5" />
              Skincare Alarms
            </h3>
            
            {/* Permission Link Action */}
            {notificationPermission !== "granted" ? (
              <button 
                onClick={requestPermission}
                className="text-xs font-semibold text-brand-purple hover:text-brand-purple/80 border border-brand-purple/20 px-3 py-1.5 rounded-xl bg-brand-lilac/10 hover:bg-brand-lilac/25 transition-all cursor-pointer"
                id="btn-grant-push-permission"
              >
                Enable Push Alerts
              </button>
            ) : (
              <span className="text-[10px] font-mono text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Push Engaged
              </span>
            )}
          </div>

          <div className="space-y-4">
            {reminders.length === 0 ? (
              <div className="text-center py-8 text-brand-charcoal/50 text-sm italic">
                No active routines scheduled. Add one on the right to trigger notifications.
              </div>
            ) : (
              reminders.map((rem) => (
                <div 
                  key={rem.id} 
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    rem.active ? "bg-brand-cream/30 border-brand-darkcream/60" : "bg-gray-100/40 border-gray-200 opacity-60"
                  }`}
                  id={`reminder-${rem.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-base font-bold text-brand-charcoal">{rem.label}</span>
                      <span className="text-xs font-mono bg-brand-darkcream px-2 py-0.5 rounded-lg text-brand-purple font-semibold">
                        {rem.time}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {daysOfWeek.map((d) => (
                        <span 
                          key={d} 
                          className={`text-[9px] px-1 rounded-sm ${
                            rem.days.includes(d) ? "bg-brand-lilac text-brand-purple font-semibold" : "text-brand-charcoal/40"
                          }`}
                        >
                          {d[0]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Run test trigger button */}
                    <button
                      onClick={() => testReminder(rem)}
                      className="p-2 rounded-xl hover:bg-brand-lilac/20 text-brand-charcoal/60 hover:text-brand-purple transition-all cursor-pointer"
                      title="Simulate push notice now"
                      id={`btn-test-alert-${rem.id}`}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>

                    {/* On/Off Switch */}
                    <button
                      onClick={() => handleToggleReminder(rem.id)}
                      className={`w-10 h-6 rounded-full p-1 transition-colors relative cursor-pointer ${
                        rem.active ? "bg-brand-green" : "bg-brand-charcoal/20"
                      }`}
                      id={`toggle-switch-${rem.id}`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        rem.active ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>

                    {/* Delete reminder */}
                    <button 
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="p-2 rounded-xl hover:bg-brand-orange/10 text-brand-charcoal/40 hover:text-brand-orange transition-colors cursor-pointer"
                      id={`btn-del-reminder-${rem.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Schedule Builder Form */}
        <div className="md:col-span-5 bg-brand-card rounded-3xl p-6 shadow-sm border border-brand-darkcream/40">
          <h3 className="font-serif text-lg font-bold text-brand-charcoal mb-4 flex items-center gap-2">
            <Plus className="text-brand-purple w-5 h-5" />
            Add Skincare Alarm
          </h3>
          <form onSubmit={handleAddReminder} className="space-y-4">
            
            <div>
              <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-1.5">Routine Label</label>
              <input 
                type="text" 
                placeholder="e.g., Morning hydration lock, Retinol treatment" 
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full bg-brand-cream border border-brand-darkcream/60 rounded-xl px-4 py-2.5 text-sm text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-purple/50"
                id="input-reminder-label"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-1.5">Trigger Time</label>
                <input 
                  type="time" 
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-brand-cream border border-brand-darkcream/60 rounded-xl px-4 py-2 text-sm text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-purple/50"
                  id="input-reminder-time"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-brand-charcoal/60 mb-2">Repeat Days</label>
              <div className="flex flex-wrap gap-1.5">
                {daysOfWeek.map((day) => {
                  const isSel = selectedDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDaySelection(day)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        isSel ? "bg-brand-purple border-brand-purple text-brand-cream font-semibold" : "bg-brand-cream border-brand-darkcream text-brand-charcoal/70 hover:bg-brand-darkcream/40"
                      }`}
                      id={`day-btn-${day}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-brand-lilac text-brand-purple font-bold text-sm py-3 rounded-xl hover:bg-brand-lilac-dark transition-all cursor-pointer shadow-sm mt-2"
              id="btn-save-reminder"
            >
              Add Scheduled Reminder
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
