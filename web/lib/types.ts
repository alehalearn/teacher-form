// Types matching the Supabase schema. Kept hand-written so the project
// doesn't depend on `supabase gen types` running.

export type ApplicantStatus = 'New' | 'In Review' | 'Active' | 'Stopped' | 'On Hold';

export interface Applicant {
  id: string;
  created_at: string;

  // Form-fed
  full_name: string;
  district: string;
  place: string;
  qualification: string;
  age: number;
  offline_exp: string;
  online_exp: string;
  subject: string[];
  syllabus: string;
  syllabus_other: string | null;
  medium: string;
  connectivity: string;
  phone: string;
  whatsapp: string | null;
  email: string;
  gadgets: string[];
  photo_url: string | null;

  // Manual enrichment
  code: string | null;
  status: ApplicantStatus;
  gender: string | null;
  dob: string | null;
  marital_status: string | null;
  university: string | null;
  preferred_time: string | null;
  foreign_ready: string | null;
  languages: string[] | null;
  ms_office: string | null;
  alt_number: string | null;
  address: string | null;
  future_pref: string | null;
  skills: string | null;
  father_name: string | null;
  father_occ: string | null;
  father_contact: string | null;
  mother_name: string | null;
  mother_occ: string | null;
  mother_contact: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  bank_holder: string | null;
  id_proof_path: string | null;
  declaration: string | null;
  declaration_at: string | null;
  preferred_syllabus: string | null;
  demo_attend: number | null;
  demo_convert: number | null;
  rating: number | null;
  youtube_link: string | null;
  section_apt: string | null;
  subject_apt: string | null;
  medium_apt: string | null;
  remark: string | null;
  interviewer: string | null;

  legacy_drive_url: string | null;
  legacy_sheet_code: string | null;

  updated_at: string | null;
  updated_by: string | null;
}

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: 'staff' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  applicant_id: string;
  staff_id: string;
  staff_email: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

// Whitelist of fields that staff can edit via the admin panel.
// Form-fed fields are intentionally NOT here — once an applicant submits,
// those are immutable from the staff UI.
export const EDITABLE_STAFF_FIELDS = [
  'code', 'status', 'gender', 'dob', 'marital_status', 'university',
  'preferred_time', 'foreign_ready', 'languages', 'ms_office',
  'alt_number', 'address', 'future_pref', 'skills',
  'father_name', 'father_occ', 'father_contact',
  'mother_name', 'mother_occ', 'mother_contact',
  'bank_account', 'bank_ifsc', 'bank_branch', 'bank_holder',
  'id_proof_path', 'declaration', 'declaration_at',
  'preferred_syllabus', 'demo_attend', 'demo_convert', 'rating',
  'youtube_link', 'section_apt', 'subject_apt', 'medium_apt',
  'remark', 'interviewer',
  // Photo URL — staff can replace the public photo if the original is bad
  'photo_url'
] as const;

export type EditableField = typeof EDITABLE_STAFF_FIELDS[number];