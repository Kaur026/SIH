import React, { useState, useEffect } from 'react';
import { getProfiles, updateUserRoleOrDept, type UserProfile } from '../../services/supabase/users';
import { getDepartments, type Department } from '../../services/supabase/departments';
import type { UserRole } from '../../types/database.types';
import { ShieldAlert, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('Bureau Officer');
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uList, dList] = await Promise.all([
        getProfiles(),
        getDepartments(),
      ]);
      setProfiles(uList);
      setDepartments(dList);
    } catch (err) {
      console.error('Error fetching user administration data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const startEdit = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditRole(user.role);
    setEditDeptId(user.department_id || '');
    setFeedback(null);
  };

  const handleSave = async (userId: string) => {
    try {
      await updateUserRoleOrDept(userId, editRole, editDeptId || null);
      setFeedback({ text: 'User permissions and bureau desk updated successfully.', type: 'success' });
      setEditingUserId(null);
      await loadData();
    } catch (err: unknown) {
      const error = err as { message?: string };
      setFeedback({ text: error?.message || 'Failed to update user privileges.', type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-red-700" />
            <span>Administrator User & Access Governance Console</span>
          </h2>
          <p className="text-xs text-slate-500">
            Control bureau permissions, assign officers to Regulation Bureau or PGRC, and manage platform roles
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded text-slate-600"
          title="Refresh officer list"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded text-xs flex items-center space-x-2 border ${
          feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading user profiles...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <th className="py-3 px-4">Officer Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Active Bureau</th>
                  <th className="py-3 px-4">Role Classification</th>
                  <th className="py-3 px-4 text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => {
                  const isEditing = editingUserId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.full_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.designation || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editDeptId}
                            onChange={(e) => setEditDeptId(e.target.value)}
                            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-900"
                          >
                            <option value="">-- No Department --</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.code})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {p.departments?.name ? `${p.departments.name} (${p.departments.code})` : 'Unassigned Desk'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-900"
                          >
                            <option value="Bureau Officer">Bureau Officer</option>
                            <option value="Cross-Department Reviewer">Cross-Department Reviewer</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.role === 'Administrator'
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : p.role === 'Cross-Department Reviewer'
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}>
                            {p.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="px-2 py-1 border border-slate-300 rounded text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSave(p.id)}
                              className="px-2.5 py-1 bg-[#0b3b60] text-white rounded font-semibold hover:bg-[#072a45]"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="px-2.5 py-1 bg-white border border-slate-300 hover:border-[#0b3b60] hover:text-[#0b3b60] text-slate-700 rounded font-semibold"
                          >
                            Edit Privileges
                          </button>
                        )}
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
