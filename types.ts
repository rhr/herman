
export interface Locality {
  latitude?: number;
  longitude?: number;
  country: string;
  stateProvince: string;
  countyCity: string;
  description: string;
  habitat?: string;
}

export interface Annotation {
  id: string;
  text: string;
  author: string;
  timestamp: number;
}

export interface Pile {
  id: string;
  name: string;
  description: string;
  specimenIds: string[];
  createdAt: number;
}

export interface Specimen {
  id: string;
  scientificName: string;
  family: string;
  genus: string;
  collector: string;
  collectionDate: string;
  locality: Locality;
  imageUrls: string[];
  description: string;
  annotations: Annotation[];
  tags: string[];
}

export interface SpecimenFormData {
  scientificName: string;
  family: string;
  genus: string;
  collector: string;
  collectionDate: string;
  country: string;
  stateProvince: string;
  countyCity: string;
  localityDescription: string;
  latitude: string;
  longitude: string;
  habitat: string;
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
  id: string;
  type: ActionType;
  description: string;
  timestamp: number;
  data: any; // Context-specific data to facilitate UNDO
}
