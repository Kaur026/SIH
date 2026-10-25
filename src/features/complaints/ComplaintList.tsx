import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getComplaints, type ComplaintFilterOptions } from '../../services/supabase/complaints';
import { getDepartments, type Department } from '../../services/supabase/departments';
import type { ComplaintWithRelations, ComplaintStatus } from '../../types/database.types';
import {
  Search,
  ArrowUpDown,
  Building2,
  Calendar,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface ComplaintListProps {
  onSelectComplaint: (complaintId: string) => void;
  onNewComplaint?: () => void;
}

export const ComplaintList: React.FC<ComplaintListProps> = ({
  onSelectComplaint,
}) => {
  const { profile, isAdmin, departmentCode } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintWithRelations[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters (Urgency levels removed)
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>(
    isAdmin ? 'ALL' : (profile?.department_id || 'ALL')
  );
  const [status, setStatus] = useState<ComplaintStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'due_date'>('recent');

  // Enforce bureau isolation for non-administrators
  useEffect(() => {
    if (!isAdmin && profile?.department_id) {
      setDepartmentId(profile.department_id);
    }
  }, [isAdmin, profile?.department_id]);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const effectiveDeptId = isAdmin
        ? (departmentId !== 'ALL' ? departmentId : undefined)
        : (profile?.department_id || undefined);

      const options: ComplaintFilterOptions = {
        search: search.trim() || undefined,
        departmentId: effectiveDeptId,
        status: status !== 'ALL' ? status : undefined,
        sortBy,
      };

      const result = await getComplaints(options);
      setComplaints(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('Error fetching complaints list:', err);
    } finally {
      setIsLoading(false);
    }
  }, [search, departmentId, status, sortBy, isAdmin, profile?.department_id]);

  useEffect(() => {
    getDepartments().then(setDepartments).catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchComplaints();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchComplaints]);

  const getStatusBadge = (s: ComplaintStatus) => {
    switch (s) {
      case 'Received':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">Received</span>;
      case 'Under Review':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">Under Review</span>;
      case 'In Progress':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">In Progress</span>;
      case 'On Hold':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">On Hold</span>;
      case 'Resolved':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Resolved</span>;
      case 'Closed':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">Closed</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">{s}</span>;
    }
  };

  const isOverdue = (c: ComplaintWithRelations) => {
    if (!c.due_at || ['Resolved', 'Closed'].includes(c.status)) return false;
    return new Date(c.due_at) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar (Register New Grievance removed from officer side) */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>{isAdmin ? 'Central Grievance Registry' : `${departmentCode || 'Bureau'} Grievance Registry`}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200 font-mono font-medium">
              {totalCount} {isAdmin ? 'Total Cases' : 'Desk Cases'}
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            {isAdmin 
              ? 'Consolidated institution complaints across Regulation Bureau (RB), PGRC, and affiliated cells'
              : `Authorized case files assigned strictly to ${profile?.departments?.name || departmentCode || 'your bureau'}. Other bureau files are restricted.`}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={fetchComplaints}
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-600 transition flex items-center space-x-1 text-xs"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Registry</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by case # (e.g. AICTE-2026-01001), keywords..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0b3b60] bg-white text-slate-900"
            />
          </div>

          {/* Bureau Filter */}
          <div>
            {isAdmin ? (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0b3b60] bg-white text-slate-900"
              >
                <option value="ALL">All Bureaus &amp; Cells</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full py-2 px-3 text-xs border border-slate-200 rounded bg-slate-100 text-slate-700 font-semibold flex items-center justify-between">
                <span>{departmentCode || 'Bureau'}: {profile?.departments?.name || 'Active Desk'}</span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Locked
                </span>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ComplaintStatus | 'ALL')}
              className="w-full py-2 px-3 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#0b3b60] bg-white text-slate-900"
            >
              <option value="ALL">All Statuses</option>
              <option value="Received">Received</option>
              <option value="Under Review">Under Review</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Secondary Bar: Sorting (Urgency levels removed) */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-xs text-slate-600 gap-2">
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'due_date')}
              className="py-1 px-2 border border-slate-300 rounded text-xs bg-white text-slate-800"
            >
              <option value="recent">Most Recent Intake</option>
              <option value="due_date">Target Deadline (Earliest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints Data Table (Priority Column Removed) */}
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-[#0b3b60] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading complaints registry from database...
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No complaints matching filter criteria.</p>
            <p className="text-slate-400 mt-0.5">Try clearing your search keyword or selecting "All Bureaus".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Case Number</th>
                  <th className="py-3 px-4">Institution &amp; Details</th>
                  <th className="py-3 px-4">Grievance Subject</th>
                  <th className="py-3 px-4">Assigned Bureau</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Resolution Target</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => {
                  const overdue = isOverdue(c);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelectComplaint(c.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Case Number */}
                      <td className="py-3 px-4 font-mono font-bold text-[#0b3b60] whitespace-nowrap">
                        {c.complaint_number}
                      </td>

                      {/* Institution */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 line-clamp-1 max-w-[200px]">
                          {c.institution?.institution_name || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {c.institution?.aicte_permanent_id || 'Pending'} • {c.institution?.state}
                        </div>
                      </td>

                      {/* Title & Category */}
                      <td className="py-3 px-4 max-w-[260px]">
                        <div className="font-medium text-slate-900 line-clamp-1">
                          {c.title}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {c.category}
                        </div>
                      </td>

                      {/* Bureau & Officer */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">
                          {c.department?.code}
                        </span>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                          {c.assigned_officer?.full_name || 'Unassigned Desk'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {getStatusBadge(c.status)}
                      </td>

                      {/* Due Date & Overdue Tag */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {c.due_at ? (
                          <div className={`flex items-center space-x-1 text-[11px] ${
                            overdue ? 'text-red-700 font-bold' : 'text-slate-600'
                          }`}>
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{new Date(c.due_at).toLocaleDateString()}</span>
                            {overdue && (
                              <span className="inline-flex items-center text-[10px] bg-red-100 text-red-800 px-1 py-0.2 rounded font-bold ml-1">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                OVERDUE
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No deadline</span>
                        )}
                      </td>

                      {/* Action Chevron */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center text-[#0b3b60] hover:text-[#072a45] font-semibold text-[11px] group-hover:underline">
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
