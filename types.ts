
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

export interface Specimen {
  id: string;
  scientificName: string;
  family: string;
  genus: string;
  collector: string;
  collectionDate: string;
  locality: Locality;
  imageUrl: string;
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
  image?: File;
}
