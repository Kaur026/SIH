import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardMetrics, type DashboardMetrics } from '../../services/supabase/reports';
import {
  AlertTriangle,
  Clock,
  Building2,
  ArrowRight,
  RefreshCw,
  MessageSquareReply,
  Sparkles
} from 'lucide-react';

// Helper to format JSON metadata into clean, human-readable text
const formatActionParticulars = (details: unknown): string => {
  if (!details) return '—';
  let data: Record<string, unknown> = {};

  if (typeof details === 'string') {
    try {
      data = JSON.parse(details);
    } catch {
      return details;
    }
  } else if (typeof details === 'object' && details !== null) {
    data = details as Record<string, unknown>;
  } else {
    return String(details);
  }

  if (data.title && typeof data.title === 'string') return data.title;
  if (data.preview && typeof data.preview === 'string') return data.preview;
  if (data.new_status) {
    return data.old_status
      ? `Status changed from ${data.old_status} to ${data.new_status}`
      : `Status set to ${data.new_status}`;
  }
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.note && typeof data.note === 'string') return data.note;

  const parts = Object.entries(data)
    .filter(([_, val]) => val !== null && val !== undefined && typeof val !== 'object')
    .map(([key, val]) => `${key.replace(/_/g, ' ')}: ${val}`);

  return parts.length > 0 ? parts.join(' | ') : '—';
};

interface DashboardProps {
  onNavigateTab: (tab: string) => void;
  onSelectComplaint?: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateTab }) => {
  const { profile, isAdmin, departmentCode } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bureauDeptId = !isAdmin ? (profile?.department_id || undefined) : undefined;
  const bureauName = profile?.departments?.name || (departmentCode === 'RB' ? 'Regulation Bureau' : departmentCode === 'PGRC' ? 'Public Grievance Redressal Cell' : 'Assigned Bureau');

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const data = await getDashboardMetrics(bureauDeptId);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [bureauDeptId]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Refresh */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              isAdmin 
                ? 'bg-red-100 text-red-800 border border-red-300' 
                : 'bg-blue-100 text-[#0b3b60] border border-blue-200'
            }`}>
              {isAdmin ? 'Central Vigilance & Oversight' : `${departmentCode || 'BUREAU'} OPERATIONAL DESK`}
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {isAdmin 
              ? 'AICTE Inter-Bureau Case Monitoring Executive Dashboard'
              : `AICTE ${bureauName} Case Monitoring Dashboard`}
          </h2>
          <p className="text-xs text-slate-500">
            {isAdmin 
              ? 'Real-time regulatory grievance metrics consolidated across Regulation Bureau, PGRC, Approval Bureau, and P&AP'
              : `Authorized operational workspace for ${bureauName} (${departmentCode || 'Bureau'}). Filtered to your bureau's active cases.`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchMetrics}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-600"
            title="Refresh database metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateTab('overlap')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-900" />
            <span>AI Overlap Intelligence</span>
          </button>
          <button
            onClick={() => onNavigateTab('respond')}
            className="px-3.5 py-1.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <MessageSquareReply className="w-3.5 h-3.5" />
            <span>Respond to Grievance</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Total Intake
          </div>
          <div className="text-2xl font-extrabold text-[#0b3b60] mt-1 font-mono">
            {metrics?.totalComplaints ?? '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {isAdmin ? 'All bureaus' : `${departmentCode || 'Bureau'} Active Queue`}
          </div>
        </div>

        {/* Received */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-sky-800 uppercase tracking-wide">
            Newly Received
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-1 font-mono">
            {metrics?.receivedCount ?? '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Awaiting review</div>
        </div>

        {/* Under Review */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-purple-800 uppercase tracking-wide">
            Under Review
          </div>
          <div className="text-2xl font-extrabold text-purple-700 mt-1 font-mono">
            {metrics?.underReviewCount ?? '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Preliminary examination</div>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
            Active Inquiry
          </div>
          <div className="text-2xl font-extrabold text-blue-700 mt-1 font-mono">
            {metrics?.inProgressCount ?? '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Investigation ongoing</div>
        </div>

        {/* Resolved */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
            Resolved
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
            {metrics?.resolvedCount ?? '--'}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Orders/Relief issued</div>
        </div>

        {/* Overdue */}
        <div className="bg-red-50 border border-red-200 rounded p-4 shadow-sm">
          <div className="text-[11px] font-bold text-red-800 uppercase tracking-wide flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            <span>Overdue Target</span>
          </div>
          <div className="text-2xl font-extrabold text-red-700 mt-1 font-mono">
            {metrics?.overdueCount ?? '--'}
          </div>
          <div className="text-[10px] text-red-600 font-semibold mt-1">Requires hearing</div>
        </div>
      </div>

      {/* Bureau Workload Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bureau Workload Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded shadow-sm p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#0b3b60]" />
              <span>{isAdmin ? 'Departmental Workload & Distribution' : `${departmentCode || 'Bureau'} Desk Workload & Disposal Summary`}</span>
            </h3>
            <span className="text-[11px] text-slate-400">Live Database Aggregation</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold text-[11px] uppercase border-b border-slate-200">
                  <th className="py-2.5 px-3">Bureau / Cell</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3 text-center">Total Assigned</th>
                  <th className="py-2.5 px-3 text-center">Pending Inquiry</th>
                  <th className="py-2.5 px-3 text-center">Resolved Cases</th>
                  <th className="py-2.5 px-3 text-right">Clearance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics?.departmentWorkload.map((dept) => {
                  const rate = dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0;
                  return (
                    <tr key={dept.departmentId} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {dept.departmentName}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 font-bold">
                        {dept.departmentCode}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                        {dept.total}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                        {dept.pending}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                        {dept.resolved}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          rate >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Audit Activities Feed */}
        <div className="bg-white border border-slate-200 rounded shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-[#0b3b60]" />
                <span>Recent System Activities</span>
              </h3>
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-[11px] text-[#0b3b60] hover:underline font-semibold"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {metrics?.recentActivity.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No recent activities recorded.
                </div>
              ) : (
                metrics?.recentActivity.slice(0, 5).map((log) => (
                  <div key={log.id} className="text-xs p-2.5 rounded bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                      <span className="font-bold text-[#0b3b60] font-sans uppercase">
                        {log.action_type}
                      </span>
                      <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="text-slate-800 font-medium">
                      {log.actor?.full_name || 'System Operator'}
                    </div>
                    <div 
                      className="text-slate-600 text-[11px] truncate mt-0.5 font-sans"
                      title={typeof log.details === 'object' ? JSON.stringify(log.details) : undefined}
                    >
                      {formatActionParticulars(log.details)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('complaints')}
            className="w-full mt-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center justify-center space-x-1.5 transition-colors"
          >
            <span>Open All Complaints Registry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
