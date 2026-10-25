// ============================================================================
// Database TypeScript Definitions
// AICTE Cross-Bureau Complaint Coordination Platform (SIH-26264)
// Matches Supabase PostgreSQL Schema exactly
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'Administrator' | 'Bureau Officer' | 'Cross-Department Reviewer';

export type ComplaintPriority = 'Normal' | 'High' | 'Urgent';

export type ComplaintStatus =
  | 'Received'
  | 'Under Review'
  | 'In Progress'
  | 'On Hold'
  | 'Resolved'
  | 'Closed';

export type NotificationType =
  | 'assignment'
  | 'status_change'
  | 'update'
  | 'administrative';

export type AuditActionType =
  | 'CREATE'
  | 'STATUS_CHANGE'
  | 'ASSIGNMENT_CHANGE'
  | 'UPDATE_ADDED'
  | 'ADMIN_ACTION';

export type AuditEntityType =
  | 'complaint'
  | 'assignment'
  | 'profile'
  | 'department'
  | 'institution';

export type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  department_id: string | null;
  role: UserRole;
  designation: string | null;
  contact_number: string | null;
  created_at: string;
  updated_at: string;
};

export type InstitutionRow = {
  id: string;
  institution_name: string;
  aicte_permanent_id: string | null;
  address: string | null;
  state: string;
  district: string | null;
  institution_type: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintRow = {
  id: string;
  complaint_number: string;
  institution_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assigned_department_id: string;
  assigned_officer_id: string | null;
  received_at: string;
  due_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  complainant_name: string | null;
  complainant_email: string | null;
  complainant_phone: string | null;
  complainant_type: string | null;
  student_roll_no: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintUpdateRow = {
  id: string;
  complaint_id: string;
  author_id: string;
  update_text: string;
  created_at: string;
};

export type ComplaintAssignmentRow = {
  id: string;
  complaint_id: string;
  department_id: string;
  officer_id: string | null;
  assigned_by: string;
  assigned_at: string;
  ended_at: string | null;
};

export type NotificationRow = {
  id: string;
  recipient_id: string;
  complaint_id: string | null;
  notification_type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id: string;
  details: Json;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: DepartmentRow;
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          full_name: string;
          department_id?: string | null;
          role?: UserRole;
          designation?: string | null;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          department_id?: string | null;
          role?: UserRole;
          designation?: string | null;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      institutions: {
        Row: InstitutionRow;
        Insert: {
          id?: string;
          institution_name: string;
          aicte_permanent_id?: string | null;
          address?: string | null;
          state: string;
          district?: string | null;
          institution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_name?: string;
          aicte_permanent_id?: string | null;
          address?: string | null;
          state?: string;
          district?: string | null;
          institution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      complaints: {
        Row: ComplaintRow;
        Insert: {
          id?: string;
          complaint_number?: string;
          institution_id: string;
          title: string;
          description: string;
          category: string;
          priority?: ComplaintPriority;
          status?: ComplaintStatus;
          assigned_department_id: string;
          assigned_officer_id?: string | null;
          received_at?: string;
          due_at?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
          complainant_name?: string | null;
          complainant_email?: string | null;
          complainant_phone?: string | null;
          complainant_type?: string | null;
          student_roll_no?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          complaint_number?: string;
          institution_id?: string;
          title?: string;
          description?: string;
          category?: string;
          priority?: ComplaintPriority;
          status?: ComplaintStatus;
          assigned_department_id?: string;
          assigned_officer_id?: string | null;
          received_at?: string;
          due_at?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
          complainant_name?: string | null;
          complainant_email?: string | null;
          complainant_phone?: string | null;
          complainant_type?: string | null;
          student_roll_no?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      complaint_updates: {
        Row: ComplaintUpdateRow;
        Insert: {
          id?: string;
          complaint_id: string;
          author_id: string;
          update_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          author_id?: string;
          update_text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      complaint_assignments: {
        Row: ComplaintAssignmentRow;
        Insert: {
          id?: string;
          complaint_id: string;
          department_id: string;
          officer_id?: string | null;
          assigned_by: string;
          assigned_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          department_id?: string;
          officer_id?: string | null;
          assigned_by?: string;
          assigned_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: {
          id?: string;
          recipient_id: string;
          complaint_id?: string | null;
          notification_type: NotificationType;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          complaint_id?: string | null;
          notification_type?: NotificationType;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: {
          id?: string;
          actor_id?: string | null;
          action_type: AuditActionType;
          entity_type: AuditEntityType;
          entity_id: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action_type?: AuditActionType;
          entity_type?: AuditEntityType;
          entity_id?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Joined types for frontend display
export type ComplaintWithRelations = ComplaintRow & {
  institution?: InstitutionRow;
  department?: DepartmentRow;
  assigned_officer?: ProfileRow | null;
  creator?: ProfileRow;
};

export type ComplaintUpdateWithAuthor = ComplaintUpdateRow & {
  author?: ProfileRow;
};

export type AssignmentWithRelations = ComplaintAssignmentRow & {
  department?: DepartmentRow;
  officer?: ProfileRow | null;
  assigner?: ProfileRow;
};

export type AuditLogWithActor = AuditLogRow & {
  actor?: ProfileRow | null;
};
