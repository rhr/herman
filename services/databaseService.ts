
import { Specimen, Annotation, Locality } from '../types';

/**
 * DATABASE SERVICE (Simulated MySQL Interface)
 * In a production environment, these methods would call a backend API (Node.js/PHP/Python)
 * that executes the SQL provided in /database/schema.sql.
 */

const STORAGE_KEYS = {
  SPECIMENS: 'db_specimens',
  LOCALITIES: 'db_localities',
  ANNOTATIONS: 'db_annotations'
};

// Helper to simulate network latency
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class DatabaseService {
  private static getFromStorage<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private static saveToStorage<T>(key: string, data: T[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * EQUIVALENT TO: 
   * SELECT s.*, l.* FROM specimens s 
   * LEFT JOIN localities l ON s.id = l.specimen_id
   */
  static async getAllSpecimens(): Promise<Specimen[]> {
    await delay(300); // Simulate API call
    const specimensBase = this.getFromStorage<any>(STORAGE_KEYS.SPECIMENS);
    const localities = this.getFromStorage<any>(STORAGE_KEYS.LOCALITIES);
    
    // Fix: Use any[] to retrieve annotations since the storage version contains specimen_id
    // which is not part of the Annotation interface but is required for relational filtering.
    const annotations = this.getFromStorage<any>(STORAGE_KEYS.ANNOTATIONS);

    return specimensBase.map(s => {
      const locality = localities.find((l: any) => l.specimen_id === s.id) || {};
      
      // Fix: Filter annotations using the specimen_id property present in storage
      const specimenAnnotations = annotations.filter((a: any) => a.specimen_id === s.id);
      
      return {
        ...s,
        locality: {
          country: locality.country || '',
          // Fix: Map properties to match the snake_case keys used in the saveSpecimen operation
          stateProvince: locality.state_province || '',
          countyCity: locality.county_city || '',
          description: locality.locality_description || '',
          latitude: locality.latitude,
          longitude: locality.longitude,
          habitat: locality.habitat || ''
        },
        annotations: specimenAnnotations,
        tags: [] // Tags could be a separate join table
      };
    });
  }

  /**
   * EQUIVALENT TO:
   * START TRANSACTION;
   * INSERT INTO specimens ...;
   * INSERT INTO localities ...;
   * COMMIT;
   */
  static async saveSpecimen(specimen: Specimen): Promise<void> {
    await delay(500);
    
    // 1. Save to Specimens table
    const specimens = this.getFromStorage<any>(STORAGE_KEYS.SPECIMENS);
    const { locality, annotations, ...specimenBase } = specimen;
    specimens.unshift(specimenBase);
    this.saveToStorage(STORAGE_KEYS.SPECIMENS, specimens);

    // 2. Save to Localities table (normalized)
    const localities = this.getFromStorage<any>(STORAGE_KEYS.LOCALITIES);
    localities.push({
      specimen_id: specimen.id,
      country: locality.country,
      state_province: locality.stateProvince,
      county_city: locality.countyCity,
      locality_description: locality.description,
      latitude: locality.latitude,
      longitude: locality.longitude,
      habitat: locality.habitat
    });
    this.saveToStorage(STORAGE_KEYS.LOCALITIES, localities);
  }

  /**
   * EQUIVALENT TO:
   * INSERT INTO annotations (id, specimen_id, text, author, timestamp) VALUES (...)
   */
  static async addAnnotation(specimenId: string, annotation: Annotation): Promise<void> {
    await delay(200);
    const annotations = this.getFromStorage<any>(STORAGE_KEYS.ANNOTATIONS);
    annotations.unshift({ ...annotation, specimen_id: specimenId });
    this.saveToStorage(STORAGE_KEYS.ANNOTATIONS, annotations);
  }

  /**
   * EQUIVALENT TO:
   * DELETE FROM specimens WHERE id = ?
   * (Foreign keys handle cascade to localities and annotations)
   */
  static async deleteSpecimen(id: string): Promise<void> {
    await delay(400);
    const specimens = this.getFromStorage<any>(STORAGE_KEYS.SPECIMENS).filter((s: any) => s.id !== id);
    const localities = this.getFromStorage<any>(STORAGE_KEYS.LOCALITIES).filter((l: any) => l.specimen_id !== id);
    const annotations = this.getFromStorage<any>(STORAGE_KEYS.ANNOTATIONS).filter((a: any) => a.specimen_id !== id);
    
    this.saveToStorage(STORAGE_KEYS.SPECIMENS, specimens);
    this.saveToStorage(STORAGE_KEYS.LOCALITIES, localities);
    this.saveToStorage(STORAGE_KEYS.ANNOTATIONS, annotations);
  }
}
