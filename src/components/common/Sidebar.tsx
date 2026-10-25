import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  MessageSquareReply,
  Sparkles,
  Users,
  BarChart3,
  History,
  ShieldAlert,
  Building
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { profile, isAdmin, departmentCode } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Portal Dashboard',
      icon: LayoutDashboard,
      description: 'Metrics & department workload',
    },
    {
      id: 'complaints',
      label: 'All Complaints',
      icon: FileText,
      description: 'Search, filter & review cases',
    },
    {
      id: 'overlap',
      label: 'AI Overlap Engine',
      icon: Sparkles,
      description: 'Cross-bureau conflict discovery',
    },
    {
      id: 'respond',
      label: 'Respond to Complaint',
      icon: MessageSquareReply,
      description: 'Manual response & email dispatch',
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: BarChart3,
      description: 'Bilateral & overdue analysis',
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: History,
      description: 'Immutable system event log',
    },
  ];

  // Administrative reallocation & user privilege management
  if (isAdmin) {
    navItems.push({
      id: 'assignments',
      label: 'Assignment Desk',
      icon: Users,
      description: 'Case transfers & bureau reallocation',
    });
    navItems.push({
      id: 'users',
      label: 'User Management',
      icon: ShieldAlert,
      description: 'Officer roles & bureau privileges',
    });
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-4.5rem)]">
      {/* Bureau Info Card */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          <Building className="w-3.5 h-3.5 text-[#0b3b60]" />
          <span>Active Bureau / Desk</span>
        </div>
        <div className="text-sm font-bold text-[#0b3b60]">
          {isAdmin ? 'Administrator' : profile?.departments?.name || 'Central Coordination'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          Desk Code: <span className="font-mono font-semibold text-slate-700">{isAdmin ? 'ADMIN' : departmentCode || 'CENTRAL'}</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-start space-x-3 px-3 py-2.5 rounded text-left transition-colors ${
                isActive
                  ? 'bg-[#0b3b60] text-white font-medium shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
              <div>
                <div className="text-xs font-semibold leading-tight">{item.label}</div>
                <div className={`text-[10px] leading-tight mt-0.5 ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

    </aside>
  );
};
