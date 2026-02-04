
export interface Annotation {
  id: number;
  text: string;
  author: string;
  timestamp: number;
}

export interface Image {
  id: number;
  filename: string;
  url: string;
  caption?: string;
  position: number;
}

export interface Pile {
  id: number;
  name: string;
  description: string;
  specimenIds: number[];
  createdAt: number;
}

export interface Specimen {
  id: number;
  code?: string;
  scientificName: string;
  family: string;
  genus: string;
  wcvpId?: string;
  collector: string;
  collectorNumber?: string;
  collectionDate: string;
  // Locality fields (flattened)
  country?: string;
  stateProvince?: string;
  countyCity?: string;
  localityDescription?: string;
  latitude?: string;   // Verbatim latitude (as entered)
  longitude?: string;  // Verbatim longitude (as entered)
  latdd?: number;      // Decimal degrees latitude (for mapping)
  londd?: number;      // Decimal degrees longitude (for mapping)
  elevation?: string;  // Elevation
  habitat?: string;
  // Other fields
  imageUrls: string[];
  images?: Image[];  // Full image objects with IDs for managing primary image
  description: string;
  microhabitat?: string;
  annotations: Annotation[];
  tags: string[];
  createdAt?: string;  // ISO date string from backend
  updatedAt?: string;  // ISO date string from backend
}

export interface SpecimenFormData {
  code: string;
  scientificName: string;
  family: string;
  genus: string;
  wcvpId?: string;
  collector: string;
  collectorNumber: string;
  collectionDate: string;
  country: string;
  stateProvince: string;
  countyCity: string;
  localityDescription: string;
  latitude: string;
  longitude: string;
  elevation: string;
  habitat: string;
  microhabitat: string;
  description: string;
  images?: File[];
}

export type ActionType = 
  | 'ADD_SPECIMEN' 
  | 'DELETE_SPECIMEN' 
  | 'UPDATE_SPECIMEN'
  | 'ADD_PILE' 
  | 'DELETE_PILE' 
  | 'ADD_TO_PILE' 
  | 'REMOVE_FROM_PILE' 
  | 'ADD_ANNOTATION';

export interface HistoryEntry {
  id: number;
  type: ActionType;
  description: string;
  timestamp: number;
  data: any; // Context-specific data to facilitate UNDO
}

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: number | null;
  user_email: string | null;
  timestamp: string; // ISO date string
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface AuditLogStats {
  total_logs: number;
  by_operation: Record<string, number>;
  by_table: Record<string, number>;
  top_users: Array<{ email: string; count: number }>;
  date_range: {
    start: string | null;
    end: string | null;
  };
}
