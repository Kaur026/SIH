import React, { useState, useEffect, useCallback } from 'react';
import { getComplaints, updateComplaintAssignment } from '../../services/supabase/complaints';
import { getDepartments, type Department } from '../../services/supabase/departments';
import { getOfficersByDepartment, type UserProfile } from '../../services/supabase/users';
import type { ComplaintWithRelations } from '../../types/database.types';
import {
  Users,
  Share2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AssignmentManagement: React.FC<{
  onSelectComplaint: (id: string) => void;
}> = ({ onSelectComplaint }) => {
  const [complaints, setComplaints] = useState<ComplaintWithRelations[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');
  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Reassign Dialog State
  const [activeComplaint, setActiveComplaint] = useState<ComplaintWithRelations | null>(null);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetOfficerId, setTargetOfficerId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [complaintsRes, depts] = await Promise.all([
        getComplaints({
          departmentId: selectedDeptId !== 'ALL' ? selectedDeptId : undefined,
          status: 'ALL',
        }),
        getDepartments(),
      ]);

      setComplaints(complaintsRes.data);
      setDepartments(depts);
    } catch (err) {
      console.error('Error loading assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (targetDeptId) {
      getOfficersByDepartment(targetDeptId).then(setOfficers).catch(console.error);
    } else {
      setOfficers([]);
    }
  }, [targetDeptId]);

  const openReassignModal = (comp: ComplaintWithRelations) => {
    setActiveComplaint(comp);
    setTargetDeptId(comp.assigned_department_id);
    setTargetOfficerId(comp.assigned_officer_id || '');
    setFeedback(null);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComplaint || !targetDeptId) return;

    setIsSaving(true);
    setFeedback(null);

    try {
      await updateComplaintAssignment(
        activeComplaint.id,
        targetDeptId,
        targetOfficerId || null
      );
      setFeedback({ text: `Complaint ${activeComplaint.complaint_number} reallocated successfully.`, type: 'success' });
      setActiveComplaint(null);
      await loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFeedback({ text: error?.message || 'Assignment failed.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#0b3b60]" />
            <span>Bureau Assignment & Workload Desk</span>
          </h2>
          <p className="text-xs text-slate-500">
            Allocate grievances to specific desk officers or execute inter-bureau jurisdiction transfers
          </p>
        </div>

        {/* Filter by Bureau */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-600">Filter Bureau:</label>
          <select
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
          >
            <option value="ALL">All Bureaus & Cells</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded text-xs flex items-center space-x-2 border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Modal / In-page Reassignment Form */}
      {activeComplaint && (
        <form onSubmit={handleSaveAssignment} className="bg-amber-50 border border-amber-300 rounded p-4 shadow-sm text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <span className="font-bold text-amber-950 flex items-center space-x-1.5">
              <Share2 className="w-4 h-4 text-amber-700" />
              <span>
                Assign / Transfer Case: <strong className="font-mono">{activeComplaint.complaint_number}</strong>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setActiveComplaint(null)}
              className="text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Target Bureau / Cell *</label>
              <select
                value={targetDeptId}
                onChange={(e) => setTargetDeptId(e.target.value)}
                required
                className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assigned Officer (Optional)</label>
              <select
                value={targetOfficerId}
                onChange={(e) => setTargetOfficerId(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 bg-white text-slate-900"
              >
                <option value="">-- Unassigned (Bureau General Pool) --</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.full_name} ({o.designation || 'Officer'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveComplaint(null)}
              className="px-3 py-1.5 border border-slate-300 rounded bg-white text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-[#0b3b60] text-white font-semibold rounded hover:bg-[#072a45]"
            >
              {isSaving ? 'Processing Transfer...' : 'Commit Assignment Change'}
            </button>
          </div>
        </form>
      )}

      {/* Assignment Table */}
      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-[#0b3b60] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading case allocation records...
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No complaints found for the selected bureau.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-3 px-4">Case #</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Active Bureau</th>
                  <th className="py-3 px-4">Nodal Officer</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-[#0b3b60]">
                      <button
                        onClick={() => onSelectComplaint(c.id)}
                        className="hover:underline"
                      >
                        {c.complaint_number}
                      </button>
                    </td>
                    <td className="py-3 px-4 max-w-[200px] truncate">
                      {c.institution?.institution_name || 'N/A'}
                    </td>
                    <td className="py-3 px-4 max-w-[240px] truncate text-slate-800">
                      {c.title}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {c.department?.code}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {c.assigned_officer?.full_name ? (
                        <span>{c.assigned_officer.full_name}</span>
                      ) : (
                        <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-semibold">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-[11px] font-medium text-slate-700">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openReassignModal(c)}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:border-[#0b3b60] hover:text-[#0b3b60] text-slate-700 rounded text-xs font-semibold"
                      >
                        Reallocate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
