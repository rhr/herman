
import { Specimen, Annotation, Locality, Pile } from '../types';

/**
 * DATABASE SERVICE (Simulated MySQL Interface)
 */

const STORAGE_KEYS = {
  SPECIMENS: 'db_specimens',
  LOCALITIES: 'db_localities',
  ANNOTATIONS: 'db_annotations',
  IMAGES: 'db_specimen_images',
  PILES: 'db_piles'
};

const SEED_DATA = {
  specimens: [
    {
      id: 'sample_1',
      scientificName: 'Adiantum capillus-veneris',
      family: 'Pteridaceae',
      genus: 'Adiantum',
      collector: 'Julian Steyermark',
      collectionDate: '2022-05-14',
      description: 'Delicate fern with black stipes and fan-shaped pinnules. Growing on damp limestone.',
      tags: ['fern', 'calciphile']
    },
    {
      id: 'sample_2',
      scientificName: 'Protea cynaroides',
      family: 'Proteaceae',
      genus: 'Protea',
      collector: 'E. Esterhuysen',
      collectionDate: '2023-09-22',
      description: 'The King Protea. Large flower head with pinkish-red involucral bracts. Woody shrub.',
      tags: ['fynbos', 'shrub']
    },
    {
      id: 'sample_3',
      scientificName: 'Drosera capensis',
      family: 'Droseraceae',
      genus: 'Drosera',
      collector: 'Charles Darwin (Simulated)',
      collectionDate: '2024-01-10',
      description: 'Carnivorous plant with strap-shaped leaves covered in glandular tentacles.',
      tags: ['carnivorous', 'wetland']
    },
    {
      id: 'sample_4',
      scientificName: 'Eucalyptus globulus',
      family: 'Myrtaceae',
      genus: 'Eucalyptus',
      collector: 'Ferdinand von Mueller',
      collectionDate: '2021-11-05',
      description: 'Juvenile foliage, glaucous and sessile. Strong aromatic scent of cineole.',
      tags: ['tree', 'aromatic']
    }
  ],
  localities: [
    {
      specimen_id: 'sample_1',
      country: 'USA',
      state_province: 'California',
      county_city: 'Mariposa County',
      locality_description: 'Yosemite Valley, near Mist Trail, on dripping vertical cliff face.',
      latitude: 37.7275,
      longitude: -119.5442,
      habitat: 'Wet limestone cliffs'
    },
    {
      specimen_id: 'sample_2',
      country: 'South Africa',
      state_province: 'Western Cape',
      county_city: 'Cape Town',
      locality_description: 'Table Mountain National Park, lower slopes of Devil\'s Peak.',
      latitude: -33.9482,
      longitude: 18.4411,
      habitat: 'Mountain Fynbos'
    },
    {
      specimen_id: 'sample_3',
      country: 'South Africa',
      state_province: 'Western Cape',
      county_city: 'Betty\'s Bay',
      locality_description: 'Harold Porter Botanical Garden, seep area along the Leopard\'s Kloof trail.',
      latitude: -34.3501,
      longitude: 18.8167,
      habitat: 'Permanently wet hillside seep'
    },
    {
      specimen_id: 'sample_4',
      country: 'Australia',
      state_province: 'Victoria',
      county_city: 'Otway Ranges',
      locality_description: 'Great Otway National Park, edge of temperate rainforest.',
      latitude: -38.7423,
      longitude: 143.5121,
      habitat: 'Sclerophyll forest'
    }
  ],
  images: [
    { specimen_id: 'sample_1', url: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_1', url: 'https://images.unsplash.com/photo-1536147116438-62679a5e01f2?auto=format&fit=crop&q=80&w=800', position: 1 },
    { specimen_id: 'sample_2', url: 'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_3', url: 'https://images.unsplash.com/photo-1614594805323-e5a73277e4e0?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_4', url: 'https://images.unsplash.com/photo-1544158942-82463e258462?auto=format&fit=crop&q=80&w=800', position: 0 }
  ],
  piles: [
    {
      id: 'pile_1',
      name: 'Fern Study 2024',
      description: 'Collection of pteridophytes for morphological analysis.',
      specimenIds: ['sample_1'],
      createdAt: Date.now()
    },
    {
      id: 'pile_2',
      name: 'Southern Hemisphere Flora',
      description: 'Specimens collected from Australia and South Africa.',
      specimenIds: ['sample_2', 'sample_3', 'sample_4'],
      createdAt: Date.now()
    }
  ]
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export class DatabaseService {
  private static getFromStorage<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private static saveToStorage<T>(key: string, data: T[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  private static seedIfEmpty() {
    if (!localStorage.getItem(STORAGE_KEYS.SPECIMENS)) {
      this.saveToStorage(STORAGE_KEYS.SPECIMENS, SEED_DATA.specimens);
      this.saveToStorage(STORAGE_KEYS.LOCALITIES, SEED_DATA.localities);
      this.saveToStorage(STORAGE_KEYS.IMAGES, SEED_DATA.images);
      this.saveToStorage(STORAGE_KEYS.PILES, SEED_DATA.piles);
      this.saveToStorage(STORAGE_KEYS.ANNOTATIONS, []);
    }
  }

  static async getAllSpecimens(): Promise<Specimen[]> {
    this.seedIfEmpty();
    await delay(300);
    const specimensBase = this.getFromStorage<any>(STORAGE_KEYS.SPECIMENS);
    const localities = this.getFromStorage<any>(STORAGE_KEYS.LOCALITIES);
    const annotations = this.getFromStorage<any>(STORAGE_KEYS.ANNOTATIONS);
    const images = this.getFromStorage<any>(STORAGE_KEYS.IMAGES);

    return specimensBase.map(s => {
      const locality = localities.find((l: any) => l.specimen_id === s.id) || {};
      const specimenAnnotations = annotations.filter((a: any) => a.specimen_id === s.id);
      const specimenImages = images
        .filter((img: any) => img.specimen_id === s.id)
        .sort((a: any, b: any) => a.position - b.position)
        .map((img: any) => img.url);
      
      return {
        ...s,
        locality: {
          country: locality.country || '',
          stateProvince: locality.state_province || '',
          countyCity: locality.county_city || '',
          description: locality.locality_description || '',
          latitude: locality.latitude,
          longitude: locality.longitude,
          habitat: locality.habitat || ''
        },
        imageUrls: specimenImages.length > 0 ? specimenImages : (s.imageUrl ? [s.imageUrl] : []),
        annotations: specimenAnnotations,
        tags: s.tags || []
      };
    });
  }

  static async saveSpecimen(specimen: Specimen): Promise<void> {
    await delay(500);
    const specimens = this.getFromStorage<any>(STORAGE_KEYS.SPECIMENS);
    const { locality, annotations, imageUrls, ...specimenBase } = specimen;
    specimens.unshift(specimenBase);
    this.saveToStorage(STORAGE_KEYS.SPECIMENS, specimens);

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

    const images = this.getFromStorage<any>(STORAGE_KEYS.IMAGES);
    imageUrls.forEach((url, index) => {
      images.push({
        specimen_id: specimen.id,
        url: url,
        position: index
      });
    });
    this.saveToStorage(STORAGE_KEYS.IMAGES, images);
  }

  static async updateSpecimen(specimen: Specimen): Promise<void> {
    await delay(500);
    // Remove existing records for this ID first
    await this.deleteSpecimen(specimen.id);
    // Save as "new" (but with same ID)
    await this.saveSpecimen(specimen);
  }

  static async addAnnotation(specimenId: string, annotation: Annotation): Promise<void> {
    await delay(200);
    const annotations = this.getFromStorage<any>(STORAGE_KEYS.ANNOTATIONS);
    annotations.unshift({ ...annotation, specimen_id: specimenId });
    this.saveToStorage(STORAGE_KEYS.ANNOTATIONS, annotations);
  }

  static async deleteSpecimen(id: string): Promise<void> {
    await delay(400);
    const specimens = this.getFromStorage<any>(STORAGE_KEYS.SPECIMENS).filter((s: any) => s.id !== id);
    const localities = this.getFromStorage<any>(STORAGE_KEYS.LOCALITIES).filter((l: any) => l.specimen_id !== id);
    const annotations = this.getFromStorage<any>(STORAGE_KEYS.ANNOTATIONS).filter((a: any) => a.specimen_id !== id);
    const images = this.getFromStorage<any>(STORAGE_KEYS.IMAGES).filter((img: any) => img.specimen_id !== id);
    
    this.saveToStorage(STORAGE_KEYS.SPECIMENS, specimens);
    this.saveToStorage(STORAGE_KEYS.LOCALITIES, localities);
    this.saveToStorage(STORAGE_KEYS.ANNOTATIONS, annotations);
    this.saveToStorage(STORAGE_KEYS.IMAGES, images);
  }

  static async getAllPiles(): Promise<Pile[]> {
    this.seedIfEmpty();
    await delay(200);
    return this.getFromStorage<Pile>(STORAGE_KEYS.PILES);
  }

  static async savePile(pile: Pile): Promise<void> {
    await delay(300);
    const piles = this.getFromStorage<Pile>(STORAGE_KEYS.PILES);
    const existingIndex = piles.findIndex(p => p.id === pile.id);
    if (existingIndex > -1) {
      piles[existingIndex] = pile;
    } else {
      piles.unshift(pile);
    }
    this.saveToStorage(STORAGE_KEYS.PILES, piles);
  }

  static async deletePile(id: string): Promise<void> {
    await delay(300);
    const piles = this.getFromStorage<Pile>(STORAGE_KEYS.PILES).filter(p => p.id !== id);
    this.saveToStorage(STORAGE_KEYS.PILES, piles);
  }

  static async addSpecimenToPile(pileId: string, specimenId: string): Promise<void> {
    const piles = this.getFromStorage<Pile>(STORAGE_KEYS.PILES);
    const pile = piles.find(p => p.id === pileId);
    if (pile && !pile.specimenIds.includes(specimenId)) {
      pile.specimenIds.push(specimenId);
      this.saveToStorage(STORAGE_KEYS.PILES, piles);
    }
  }

  static async removeSpecimenFromPile(pileId: string, specimenId: string): Promise<void> {
    const piles = this.getFromStorage<Pile>(STORAGE_KEYS.PILES);
    const pile = piles.find(p => p.id === pileId);
    if (pile) {
      pile.specimenIds = pile.specimenIds.filter(id => id !== specimenId);
      this.saveToStorage(STORAGE_KEYS.PILES, piles);
    }
  }
}
