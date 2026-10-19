export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  has_avatar: boolean;
  must_change_password: boolean;
  language: string;
  organization: Organization;
  organizations: { id: string; name: string }[];
  roles: { id: string; code: string; name: string; level: number }[];
  level: number;
  permissions: string[];
}

export interface Organization {
  id: string; name: string; slug: string; legal_name: string | null; email: string | null; phone: string | null;
  website: string | null; address: string | null; has_logo: boolean;
  default_language_id: string; timezone_id: string; currency_id: string; date_format_id: string;
}

export interface LookupValue {
  id: string; type?: string; code: string; color: string | null; icon: string | null; sort_order: number;
  is_system: boolean; is_active: boolean; is_global: boolean; label: string; labels: Record<string, string>;
}

export interface Language { id: string; code: string; name: string; native_name: string }

export interface MenuNode {
  id: string; code: string; label_key: string | null; label: string | null; icon: string | null; route: string | null; children: MenuNode[];
}

export interface Widget {
  id: string; code: string; name_key: string; type: string; width: number; icon: string | null; color: string | null; data: unknown;
}

export interface RoleRow {
  id: string; code: string; name: string; description: string | null; level: number; color: string | null;
  is_system: boolean; is_active: boolean; users_count?: number; permission_ids?: string[]; widget_ids?: string[];
}

export interface PermissionRow { id: string; code: string; name: string; description: string | null; group: string; group_label: string; group_order: number }

export interface LV { id: string; code: string; label: string; color: string | null }

export interface FileRow {
  id: string; name: string; description: string | null; extension: string | null; mime_type: string | null; size_bytes: number; version_count: number;
  classification: LV; status: LV; owner: { id: string; name: string } | null; legal_hold: boolean; previewable: boolean; is_image: boolean;
  created_at: string; updated_at: string;
  can: { download: boolean; replace: boolean; edit: boolean; archive: boolean; restore: boolean; request_deletion: boolean; decide_deletion: boolean; legal_hold: boolean };
}

export interface FileDetail extends FileRow {
  versions: { id: string; number: number; name: string; size_bytes: number; mime_type: string | null; uploaded_by: string | null; created_at: string; sha256: string; available: boolean }[];
  links: { type: string; id: string }[];
  pending_deletion: { id: string; requested_by: string | null; reason: string | null; created_at: string } | null;
}
