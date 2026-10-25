import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  LogOut,
  User as UserIcon,
  Check,
  CheckCheck,
  X,
  ShieldCheck,
  Building2,
  Mail,
  BadgeCheck,
  Lock,
  FileCheck2,
} from 'lucide-react';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead, type Notification } from '../../services/supabase/notifications';

interface HeaderProps {
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { user, profile, role, departmentCode, signOut } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await getUserNotifications(user.id);
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // 30-sec polling
    return () => clearInterval(interval);
  }, [user]);

  // Auto-close notification dropdown when clicking outside or navigating to different pages
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await markAllNotificationsAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  const getRoleBadge = () => {
    if (role === 'Administrator') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-800 text-red-100 uppercase tracking-wider border border-red-700">
          Administrator
        </span>
      );
    }
    if (role === 'Cross-Department Reviewer') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-800 text-purple-100 uppercase tracking-wider border border-purple-700">
          Cross-Bureau Reviewer
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wider">
        {departmentCode ? `Officer (${departmentCode})` : 'Bureau Officer'}
      </span>
    );
  };

  return (
    <header className="bg-[#0b3b60] text-white border-b-4 border-[#e67e22] shadow-sm sticky top-0 z-30 font-sans">
      {/* Top Tricolor Bar */}
      <div className="gov-tricolor-stripe w-full"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Bureau Title */}
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => {
              setShowNotifications(false);
              onNavigate && onNavigate('dashboard');
            }}
          >
            <img
              src="/aicte-emblem.png"
              alt="AICTE Official Emblem"
              className="w-11 h-11 object-contain drop-shadow-md shrink-0"
            />
            <div>
              <div className="text-[10px] tracking-wider uppercase text-amber-200 font-semibold leading-tight">
                AICTE • अखिल भारतीय तकनीकी शिक्षा परिषद
              </div>
              <div className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">
                Complaint Coordination Platform
              </div>
              <div className="text-[10px] text-slate-300 hidden sm:block">
                Inter-Bureau Regulatory &amp; Grievance Cell Portal
              </div>
            </div>
          </div>

          {/* Right Controls: Notifications & User Card */}
          <div className="flex items-center space-x-4">
            
            {/* Notifications Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-full hover:bg-white/10 text-slate-200 hover:text-white transition-colors focus:outline-none"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full border-2 border-[#0b3b60]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-md shadow-xl border border-slate-300 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Notifications ({unreadCount} Unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-[#0b3b60] hover:underline flex items-center space-x-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-500">
                        No notifications registered.
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs transition-colors hover:bg-slate-50 ${
                            !n.is_read ? 'bg-amber-50/70 border-l-4 border-amber-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-slate-800 leading-snug">{n.message}</p>
                            {!n.is_read && (
                              <button
                                onClick={() => handleMarkAsRead(n.id)}
                                title="Mark as read"
                                className="text-slate-400 hover:text-emerald-600 shrink-0 mt-0.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Summary */}
            <div className="flex items-center space-x-3 pl-3 border-l border-white/20">
              {/* Profile Icon button */}
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(false);
                  setShowProfileModal(true);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white border border-white/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-xs"
                title="Click to view officer profile details"
                aria-label="View Officer Profile Details"
              >
                <UserIcon className="w-4 h-4" />
              </button>

              <div
                className="hidden sm:block text-left cursor-pointer"
                onClick={() => {
                  setShowNotifications(false);
                  setShowProfileModal(true);
                }}
              >
                <div className="text-xs font-semibold text-white leading-tight flex items-center space-x-1.5 hover:underline">
                  <span>{profile?.full_name || user?.email?.split('@')[0]}</span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center space-x-1.5 mt-0.5">
                  {getRoleBadge()}
                  {profile?.designation && (
                    <span className="truncate max-w-[130px]">{profile.designation}</span>
                  )}
                </div>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 rounded hover:bg-red-700/60 text-slate-200 hover:text-white transition-colors border border-transparent hover:border-red-500/50"
                title="Sign out of portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* OFFICER PROFILE DETAILS MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#0b3b60] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#e67e22]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    Official Officer Profile Dossier
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    AICTE Central Regulatory &amp; Grievance Redressal Credentials
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 transition"
                aria-label="Close Profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              {/* Primary Identity Card */}
              <div className="flex items-center space-x-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="w-14 h-14 rounded-full bg-[#0b3b60] text-white flex items-center justify-center font-bold text-lg border-2 border-amber-400 shrink-0 shadow-sm">
                  {profile?.full_name ? profile.full_name.charAt(0) : 'O'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {profile?.full_name || 'AICTE Bureau Officer'}
                  </div>
                  <div className="text-xs text-[#0b3b60] font-semibold">
                    {profile?.designation || 'Regulatory Adjudication Officer'}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {getRoleBadge()}
                    <span className="text-[11px] font-mono text-slate-500">
                      ID: {role === 'Administrator' ? 'AICTE-ADM-01' : departmentCode === 'RB' ? 'AICTE-RB-04' : 'AICTE-PGRC-09'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Rows */}
              <div className="border border-slate-200 rounded-md divide-y divide-slate-100 bg-white shadow-xs">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>Assigned Bureau / Cell:</span>
                  </span>
                  <span className="font-bold text-slate-800">
                    {profile?.departments?.name || (departmentCode === 'RB' ? 'Regulation Bureau (RB)' : departmentCode === 'PGRC' ? 'Public Grievance Redressal Cell (PGRC)' : 'Central AICTE Administration')}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center space-x-2">
                    <BadgeCheck className="w-4 h-4 text-slate-400" />
                    <span>Bureau Desk Code:</span>
                  </span>
                  <span className="font-mono font-bold text-[#0b3b60] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {departmentCode || (role === 'Administrator' ? 'ALL / HQ' : 'BUREAU')}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>Official Email Address:</span>
                  </span>
                  <span className="font-mono text-slate-800 select-all font-medium">
                    {user?.email || 'officer@aicte.gov.in'}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Security Clearance:</span>
                  </span>
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {role === 'Administrator' ? 'Level 4 — Complete Inter-Bureau Authority' : 'Level 2 — Bureau Adjudication Clearance'}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center space-x-2">
                    <FileCheck2 className="w-4 h-4 text-slate-400" />
                    <span>Statutory Powers:</span>
                  </span>
                  <span className="text-right text-[11px] text-slate-700 font-medium">
                    Case Inspection, Directives Dispatch, SMS Alerts
                  </span>
                </div>
              </div>

              {/* Security Audit Badge */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px] leading-relaxed">
                <strong>Government Session Notice:</strong> Logged in via National Informatics Centre (NIC) verified credentials. All regulatory case disposals and dispatch actions are immutably logged to the AICTE audit repository.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  signOut();
                }}
                className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-semibold text-xs flex items-center space-x-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-1.5 bg-[#0b3b60] hover:bg-[#072a45] text-white rounded font-semibold text-xs shadow-xs transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
