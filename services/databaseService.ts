
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
      microhabitat: 'Shaded dripping rock face with constant moisture, pH 7.5-8.0',
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
      microhabitat: 'South-facing slope with well-drained sandy soil, full sun exposure',
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
      microhabitat: 'Nutrient-poor peat bog with standing water, pH 4.5-5.5',
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
      microhabitat: 'Edge of forest clearing, deep loamy soil with seasonal fog influence',
      tags: ['tree', 'aromatic']
    },
    {
      id: 'sample_5',
      scientificName: 'Rafflesia arnoldii',
      family: 'Rafflesiaceae',
      genus: 'Rafflesia',
      collector: 'Joseph Arnold',
      collectionDate: '2023-06-18',
      description: 'World\'s largest individual flower, up to 1 meter in diameter. Parasitic, no leaves or stems. Strong carrion smell.',
      microhabitat: 'Parasitic on Tetrastigma vine roots in deep shade, forest floor leaf litter',
      tags: ['parasitic', 'rare', 'endangered']
    },
    {
      id: 'sample_6',
      scientificName: 'Welwitschia mirabilis',
      family: 'Welwitschiaceae',
      genus: 'Welwitschia',
      collector: 'Friedrich Welwitsch',
      collectionDate: '2022-08-30',
      description: 'Ancient gymnosperm with only two leaves that grow continuously. Estimated age of specimen: 500+ years.',
      microhabitat: 'Gravel plains with coastal fog influence, deep tap root accessing groundwater',
      tags: ['gymnosperm', 'desert', 'endemic']
    },
    {
      id: 'sample_7',
      scientificName: 'Nepenthes rajah',
      family: 'Nepenthaceae',
      genus: 'Nepenthes',
      collector: 'Hugh Low',
      collectionDate: '2024-03-12',
      description: 'Giant tropical pitcher plant. Largest pitchers can hold 3.5 liters. Endemic to Mount Kinabalu.',
      microhabitat: 'Ultramafic substrate ridge top, exposed to afternoon mist, serpentine soil',
      tags: ['carnivorous', 'tropical', 'endemic']
    },
    {
      id: 'sample_8',
      scientificName: 'Lithops aucampiae',
      family: 'Aizoaceae',
      genus: 'Lithops',
      collector: 'M. L. Aucampiae',
      collectionDate: '2023-11-22',
      description: 'Living stone succulent with mimicry adaptation. Window-like translucent leaf tops.',
      microhabitat: 'Partially buried in quartzite gravel, cryptic among stones, minimal soil cover',
      tags: ['succulent', 'mimicry', 'xerophyte']
    },
    {
      id: 'sample_9',
      scientificName: 'Sequoiadendron giganteum',
      family: 'Cupressaceae',
      genus: 'Sequoiadendron',
      collector: 'John Muir',
      collectionDate: '2022-07-04',
      description: 'Giant sequoia bark sample and foliage. From specimen estimated 2,200 years old. Fire-resistant bark.',
      microhabitat: 'West-facing slope with seasonal snowmelt, thick duff layer, fire-adapted stand',
      tags: ['tree', 'ancient', 'endemic']
    },
    {
      id: 'sample_10',
      scientificName: 'Victoria amazonica',
      family: 'Nymphaeaceae',
      genus: 'Victoria',
      collector: 'Richard Schomburgk',
      collectionDate: '2023-12-08',
      description: 'Giant Amazonian water lily. Leaf pads can reach 3 meters diameter and support up to 45kg.',
      microhabitat: 'Slow-moving oxbow lake with warm water (28-30°C), muddy bottom at 1-2m depth',
      tags: ['aquatic', 'giant', 'tropical']
    },
    {
      id: 'sample_11',
      scientificName: 'Edelweiss leontopodium',
      family: 'Asteraceae',
      genus: 'Leontopodium',
      collector: 'Hans Kerner',
      collectionDate: '2024-07-20',
      description: 'Alpine flower with woolly white bracts. Symbol of the Alps. Found at 2,800m elevation.',
      microhabitat: 'Limestone scree above treeline, northeast-facing slope with late-melting snow',
      tags: ['alpine', 'rare', 'protected']
    },
    {
      id: 'sample_12',
      scientificName: 'Dionaea muscipula',
      family: 'Droseraceae',
      genus: 'Dionaea',
      collector: 'John Ellis',
      collectionDate: '2023-04-15',
      description: 'Venus flytrap with active snap-trap mechanism. Trigger hairs require two stimulations within 20 seconds.',
      microhabitat: 'Open savanna with frequent fire regime, acidic sandy soil with high water table',
      tags: ['carnivorous', 'endemic', 'endangered']
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
    },
    {
      specimen_id: 'sample_5',
      country: 'Indonesia',
      state_province: 'Sumatra',
      county_city: 'Bengkulu',
      locality_description: 'Kerinci Seblat National Park, lowland tropical rainforest floor.',
      latitude: -3.7327,
      longitude: 102.2633,
      habitat: 'Tropical rainforest'
    },
    {
      specimen_id: 'sample_6',
      country: 'Namibia',
      state_province: 'Erongo',
      county_city: 'Swakopmund District',
      locality_description: 'Namib Desert, approximately 100km inland from coast on gravel plains.',
      latitude: -22.5609,
      longitude: 14.5268,
      habitat: 'Hyper-arid desert'
    },
    {
      specimen_id: 'sample_7',
      country: 'Malaysia',
      state_province: 'Sabah',
      county_city: 'Ranau',
      locality_description: 'Mount Kinabalu National Park, ultramafic soils at 2,400m elevation.',
      latitude: 6.0752,
      longitude: 116.5583,
      habitat: 'Montane tropical forest'
    },
    {
      specimen_id: 'sample_8',
      country: 'South Africa',
      state_province: 'Northern Cape',
      county_city: 'Namaqualand',
      locality_description: 'Goegap Nature Reserve, rocky quartzite outcrop.',
      latitude: -29.6833,
      longitude: 17.9833,
      habitat: 'Succulent Karoo'
    },
    {
      specimen_id: 'sample_9',
      country: 'USA',
      state_province: 'California',
      county_city: 'Tulare County',
      locality_description: 'Sequoia National Park, Giant Forest, western slope of Sierra Nevada.',
      latitude: 36.5854,
      longitude: -118.7729,
      habitat: 'Mixed conifer forest'
    },
    {
      specimen_id: 'sample_10',
      country: 'Brazil',
      state_province: 'Amazonas',
      county_city: 'Manaus',
      locality_description: 'Amazon River oxbow lake, slow-moving backwater near Rio Negro confluence.',
      latitude: -3.1190,
      longitude: -60.0217,
      habitat: 'Amazonian freshwater'
    },
    {
      specimen_id: 'sample_11',
      country: 'Switzerland',
      state_province: 'Valais',
      county_city: 'Zermatt',
      locality_description: 'Matterhorn region, alpine meadow above treeline.',
      latitude: 45.9763,
      longitude: 7.6586,
      habitat: 'Alpine grassland'
    },
    {
      specimen_id: 'sample_12',
      country: 'USA',
      state_province: 'North Carolina',
      county_city: 'Pender County',
      locality_description: 'Green Swamp Preserve, longleaf pine savanna with seepage bog.',
      latitude: 34.1886,
      longitude: -78.0642,
      habitat: 'Coastal plain pocosin'
    }
  ],
  images: [
    { specimen_id: 'sample_1', url: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_1', url: 'https://images.unsplash.com/photo-1536147116438-62679a5e01f2?auto=format&fit=crop&q=80&w=800', position: 1 },
    { specimen_id: 'sample_2', url: 'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_3', url: 'https://images.unsplash.com/photo-1614594805323-e5a73277e4e0?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_4', url: 'https://images.unsplash.com/photo-1544158942-82463e258462?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_5', url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_6', url: 'https://images.unsplash.com/photo-1509937528035-ad76254b0356?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_7', url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_8', url: 'https://images.unsplash.com/photo-1459156212016-c812468e2115?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_9', url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_10', url: 'https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_11', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=800', position: 0 },
    { specimen_id: 'sample_12', url: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&q=80&w=800', position: 0 }
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
      specimenIds: ['sample_2', 'sample_3', 'sample_4', 'sample_8'],
      createdAt: Date.now()
    },
    {
      id: 'pile_3',
      name: 'Carnivorous Plants',
      description: 'Fascinating collection of carnivorous plant species with various trapping mechanisms.',
      specimenIds: ['sample_3', 'sample_7', 'sample_12'],
      createdAt: Date.now()
    },
    {
      id: 'pile_4',
      name: 'Extreme Environments',
      description: 'Plants adapted to harsh conditions: deserts, alpine zones, and ancient survivors.',
      specimenIds: ['sample_6', 'sample_9', 'sample_11'],
      createdAt: Date.now()
    },
    {
      id: 'pile_5',
      name: 'Tropical Treasures',
      description: 'Rare and remarkable specimens from tropical rainforests.',
      specimenIds: ['sample_5', 'sample_7', 'sample_10'],
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

  static async savePiles(piles: Pile[]): Promise<void> {
    await delay(300);
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
