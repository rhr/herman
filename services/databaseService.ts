/**
 * DATABASE SERVICE - Now using FastAPI Backend
 *
 * This service now delegates all operations to the backend API
 * instead of using localStorage.
 */

import { Specimen, Annotation, Pile } from '../types';
import { apiClient } from './apiClient';

export class DatabaseService {
  /**
   * Get all specimens from the backend with pagination, search, sorting, and pile filtering
   */
  static async getAllSpecimens(
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortBy?: string,
    sortDirection?: 'asc' | 'desc',
    pileId?: number | null
  ): Promise<{
    specimens: Specimen[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      return await apiClient.getAllSpecimens(page, pageSize, search, sortBy, sortDirection, pileId);
    } catch (error) {
      console.error('Failed to fetch specimens:', error);
      throw error;
    }
  }

  /**
   * Save a new specimen to the backend
   */
  static async saveSpecimen(specimen: Specimen & { images?: File[] }): Promise<void> {
    try {
      // Convert specimen data to FormData for multipart upload
      const formData = new FormData();

      formData.append('code', specimen.code || '');
      formData.append('scientific_name', specimen.scientificName);
      formData.append('family', specimen.family || '');
      formData.append('genus', specimen.genus || '');
      formData.append('collector', specimen.collector || '');
      formData.append('collector_number', specimen.collectorNumber || '');
      formData.append('collection_date', specimen.collectionDate || '');
      formData.append('description', specimen.description || '');
      formData.append('microhabitat', specimen.microhabitat || '');

      // Locality data (flattened)
      formData.append('country', specimen.country || '');
      formData.append('state_province', specimen.stateProvince || '');
      formData.append('county_city', specimen.countyCity || '');
      formData.append('locality_description', specimen.localityDescription || '');

      // Verbatim coordinates (strings)
      if (specimen.latitude) {
        formData.append('latitude', specimen.latitude);
      }
      if (specimen.longitude) {
        formData.append('longitude', specimen.longitude);
      }

      // Decimal degrees coordinates (floats)
      if (specimen.latdd !== undefined && specimen.latdd !== null) {
        formData.append('latdd', String(specimen.latdd));
      }
      if (specimen.londd !== undefined && specimen.londd !== null) {
        formData.append('londd', String(specimen.londd));
      }

      formData.append('elevation', specimen.elevation || '');
      formData.append('habitat', specimen.habitat || '');

      // Handle images - prefer File objects if available, otherwise convert from base64
      if (specimen.images && specimen.images.length > 0) {
        for (const file of specimen.images) {
          formData.append('images', file);
        }
      } else if (specimen.imageUrls && specimen.imageUrls.length > 0) {
        for (const imageUrl of specimen.imageUrls) {
          if (imageUrl.startsWith('data:')) {
            // Convert base64 data URL to File object
            const blob = await fetch(imageUrl).then(r => r.blob());
            const file = new File([blob], `image_${Date.now()}.jpg`, { type: 'image/jpeg' });
            formData.append('images', file);
          }
        }
      }

      await apiClient.createSpecimen(formData);
    } catch (error) {
      console.error('Failed to save specimen:', error);
      throw error;
    }
  }

  /**
   * Update an existing specimen
   */
  static async updateSpecimen(specimen: Specimen & { images?: File[] }): Promise<void> {
    try {
      // Convert specimen data to FormData for multipart upload
      const formData = new FormData();

      formData.append('code', specimen.code || '');
      formData.append('scientific_name', specimen.scientificName);
      formData.append('family', specimen.family || '');
      formData.append('genus', specimen.genus || '');
      formData.append('collector', specimen.collector || '');
      formData.append('collector_number', specimen.collectorNumber || '');

      formData.append('collection_date', specimen.collectionDate || '');
      formData.append('description', specimen.description || '');
      formData.append('microhabitat', specimen.microhabitat || '');

      // Locality data (flattened)
      formData.append('country', specimen.country || '');
      formData.append('state_province', specimen.stateProvince || '');
      formData.append('county_city', specimen.countyCity || '');
      formData.append('locality_description', specimen.localityDescription || '');

      // Verbatim coordinates (strings)
      if (specimen.latitude) {
        formData.append('latitude', specimen.latitude);
      }
      if (specimen.longitude) {
        formData.append('longitude', specimen.longitude);
      }

      // Decimal degrees coordinates (floats)
      if (specimen.latdd !== undefined && specimen.latdd !== null) {
        formData.append('latdd', String(specimen.latdd));
      }
      if (specimen.londd !== undefined && specimen.londd !== null) {
        formData.append('londd', String(specimen.londd));
      }

      formData.append('elevation', specimen.elevation || '');
      formData.append('habitat', specimen.habitat || '');

      // Handle NEW images (File objects) - only send new images, not existing ones
      if (specimen.images && specimen.images.length > 0) {
        for (const file of specimen.images) {
          formData.append('images', file);
        }
      }

      await apiClient.updateSpecimen(specimen.id, formData);
    } catch (error) {
      console.error('Failed to update specimen:', error);
      throw error;
    }
  }

  /**
   * Delete a specimen
   */
  static async deleteSpecimen(id: number): Promise<void> {
    try {
      await apiClient.deleteSpecimen(id);
    } catch (error) {
      console.error('Failed to delete specimen:', error);
      throw error;
    }
  }

  /**
   * Add an annotation to a specimen
   */
  static async addAnnotation(specimenId: number, annotation: Annotation): Promise<Annotation> {
    try {
      const savedAnnotation = await apiClient.addAnnotation(specimenId, {
        text: annotation.text,
        author: annotation.author,
      });
      return savedAnnotation;
    } catch (error) {
      console.error('Failed to add annotation:', error);
      throw error;
    }
  }

  /**
   * Get all piles
   */
  static async getAllPiles(): Promise<Pile[]> {
    try {
      return await apiClient.getAllPiles();
    } catch (error) {
      console.error('Failed to fetch piles:', error);
      throw error;
    }
  }

  /**
   * Save a new pile
   */
  static async savePile(pile: Pile): Promise<void> {
    try {
      await apiClient.createPile(pile.name, pile.description);
    } catch (error) {
      console.error('Failed to save pile:', error);
      throw error;
    }
  }

  /**
   * Save multiple piles (for reordering)
   */
  static async savePiles(piles: Pile[]): Promise<void> {
    // Note: This is a simplified version
    // For proper implementation, you'd need a bulk update endpoint
    console.log('Pile reordering saved (client-side only for now)');
  }

  /**
   * Delete a pile
   */
  static async deletePile(id: number): Promise<void> {
    try {
      await apiClient.deletePile(id);
    } catch (error) {
      console.error('Failed to delete pile:', error);
      throw error;
    }
  }

  /**
   * Add a specimen to a pile
   */
  static async addSpecimenToPile(pileId: number, specimenId: number): Promise<void> {
    try {
      await apiClient.addSpecimenToPile(pileId, specimenId);
    } catch (error) {
      console.error('Failed to add specimen to pile:', error);
      throw error;
    }
  }

  /**
   * Remove a specimen from a pile
   */
  static async removeSpecimenFromPile(pileId: number, specimenId: number): Promise<void> {
    try {
      await apiClient.removeSpecimenFromPile(pileId, specimenId);
    } catch (error) {
      console.error('Failed to remove specimen from pile:', error);
      throw error;
    }
  }
}
