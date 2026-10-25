import React, { useState, useEffect } from 'react';
import { getDashboardMetrics, type DashboardMetrics } from '../../services/supabase/reports';
import { BarChart3, Download, RefreshCw } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-[#0b3b60]" />
            <span>AICTE Grievance Resolution & Bureau Performance Analytics</span>
          </h2>
          <p className="text-xs text-slate-500">
            Statutory report for Departmental Monitoring & Inter-Bureau Coordination
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchReports}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-600"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded flex items-center space-x-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* Grid of Analytical Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Status Distribution */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
            Complaint Pipeline Status Breakdown
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-sky-800">Newly Received</span>
                <span className="font-mono font-bold">{metrics?.receivedCount ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-sky-600 h-2 rounded-full"
                  style={{ width: `${metrics?.totalComplaints ? (metrics.receivedCount / metrics.totalComplaints) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-purple-800">Under Preliminary Review</span>
                <span className="font-mono font-bold">{metrics?.underReviewCount ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${metrics?.totalComplaints ? (metrics.underReviewCount / metrics.totalComplaints) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-blue-800">In Active Inquiry</span>
                <span className="font-mono font-bold">{metrics?.inProgressCount ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${metrics?.totalComplaints ? (metrics.inProgressCount / metrics.totalComplaints) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-emerald-800">Resolved / Relief Accorded</span>
                <span className="font-mono font-bold">{metrics?.resolvedCount ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full"
                  style={{ width: `${metrics?.totalComplaints ? (metrics.resolvedCount / metrics.totalComplaints) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-red-800">Overdue (Exceeded Mandated SLA)</span>
                <span className="font-mono font-bold text-red-700">{metrics?.overdueCount ?? 0}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${metrics?.totalComplaints ? (metrics.overdueCount / metrics.totalComplaints) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bureau Summary */}
        <div className="bg-white border border-slate-200 rounded p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
            Bureau Clearance Performance Summary
          </h3>

          <div className="space-y-4">
            {metrics?.departmentWorkload.map((d) => (
              <div key={d.departmentId} className="border border-slate-200 rounded p-3 bg-slate-50 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                  <span>{d.departmentName} ({d.departmentCode})</span>
                  <span className="font-mono text-[#0b3b60]">{d.total} Cases</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mt-2">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    Pending Inquiry: <strong className="text-amber-700 font-mono">{d.pending}</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    Resolved: <strong className="text-emerald-700 font-mono">{d.resolved}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
