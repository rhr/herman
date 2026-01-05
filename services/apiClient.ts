/**
 * API Client for Herbarium Pro FastAPI Backend
 */

import { Specimen, Pile, Annotation } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

class ApiClient {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // ========================================
  // Authentication
  // ========================================

  async register(email: string, password: string, name?: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await this.handleResponse<LoginResponse>(response);
    localStorage.setItem('authToken', data.access_token);
    return data;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await this.handleResponse<LoginResponse>(response);
    localStorage.setItem('authToken', data.access_token);
    return data;
  }

  logout(): void {
    localStorage.removeItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  async getCurrentUser() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeader(),
    });

    return this.handleResponse(response);
  }

  // ========================================
  // Specimens
  // ========================================

  async getAllSpecimens(
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortBy?: string,
    sortDirection?: 'asc' | 'desc'
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
    let url = `${API_BASE_URL}/specimens?page=${page}&page_size=${pageSize}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (sortBy) {
      url += `&sort_by=${encodeURIComponent(sortBy)}`;
    }
    if (sortDirection) {
      url += `&sort_direction=${sortDirection}`;
    }
    const response = await fetch(url, {
      headers: this.getAuthHeader(),
    });

    const data = await this.handleResponse<{
      specimens: any[];
      pagination: {
        page: number;
        page_size: number;
        total: number;
        total_pages: number;
        has_next: boolean;
        has_prev: boolean;
      };
    }>(response);

    // Transform backend format (snake_case) to frontend format (camelCase)
    const specimens = data.specimens.map(s => ({
      id: s.id,
      code: s.code,
      scientificName: s.scientific_name,
      family: s.family,
      genus: s.genus,
      collector: s.collector,
      collectorNumber: s.collector_number,
      collectionDate: s.collection_date,
      description: s.description,
      microhabitat: s.microhabitat,
      // Locality fields (flattened)
      country: s.country,
      stateProvince: s.state_province,
      countyCity: s.county_city,
      localityDescription: s.locality_description,
      latitude: s.latitude,     // Verbatim string
      longitude: s.longitude,   // Verbatim string
      latdd: s.latdd,          // Decimal degrees
      londd: s.londd,          // Decimal degrees
      elevation: s.elevation,  // Elevation
      habitat: s.habitat,
      // Relationships
      imageUrls: s.images?.map((img: any) => img.url) || [],
      images: s.images?.map((img: any) => ({
        id: img.id,
        filename: img.filename,
        url: img.url,
        caption: img.caption,
        position: img.position,
      })) || [],
      annotations: s.annotations?.map((anno: any) => ({
        id: anno.id,
        text: anno.text,
        author: anno.author || 'Unknown',
        timestamp: new Date(anno.timestamp || anno.created_at).getTime(),
      })) || [],
      tags: s.tags || [],
      // Timestamps
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return {
      specimens,
      pagination: {
        page: data.pagination.page,
        pageSize: data.pagination.page_size,
        total: data.pagination.total,
        totalPages: data.pagination.total_pages,
        hasNext: data.pagination.has_next,
        hasPrev: data.pagination.has_prev,
      },
    };
  }

  async getSpecimen(id: number): Promise<Specimen> {
    const response = await fetch(`${API_BASE_URL}/specimens/${id}`, {
      headers: this.getAuthHeader(),
    });

    const s = await this.handleResponse<any>(response);

    return {
      id: s.id,
      code: s.code,
      scientificName: s.scientific_name,
      family: s.family,
      genus: s.genus,
      collector: s.collector,
      collectorNumber: s.collector_number,
      collectionDate: s.collection_date,
      description: s.description,
      microhabitat: s.microhabitat,
      // Locality fields (flattened)
      country: s.country,
      stateProvince: s.state_province,
      countyCity: s.county_city,
      localityDescription: s.locality_description,
      latitude: s.latitude,     // Verbatim string
      longitude: s.longitude,   // Verbatim string
      latdd: s.latdd,          // Decimal degrees
      londd: s.londd,          // Decimal degrees
      elevation: s.elevation,  // Elevation
      habitat: s.habitat,
      // Relationships
      imageUrls: s.images?.map((img: any) => img.url) || [],
      images: s.images?.map((img: any) => ({
        id: img.id,
        filename: img.filename,
        url: img.url,
        caption: img.caption,
        position: img.position,
      })) || [],
      annotations: s.annotations?.map((anno: any) => ({
        id: anno.id,
        text: anno.text,
        author: anno.author || 'Unknown',
        timestamp: new Date(anno.timestamp || anno.created_at).getTime(),
      })) || [],
      tags: s.tags || [],
      // Timestamps
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  }

  async createSpecimen(formData: FormData): Promise<{ id: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/specimens`, {
      method: 'POST',
      headers: this.getAuthHeader(),
      body: formData,
    });

    return this.handleResponse(response);
  }

  async updateSpecimen(id: number, formData: FormData): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/specimens/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeader(),
      body: formData,
    });

    await this.handleResponse(response);
  }

  async deleteSpecimen(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/specimens/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    await this.handleResponse(response);
  }

  async setPrimaryImage(imageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/set-primary`, {
      method: 'PUT',
      headers: this.getAuthHeader(),
    });

    await this.handleResponse(response);
  }

  async updateImageCaption(imageId: number, caption: string): Promise<void> {
    const formData = new FormData();
    formData.append('caption', caption);

    const response = await fetch(`${API_BASE_URL}/images/${imageId}/caption`, {
      method: 'PUT',
      headers: this.getAuthHeader(),
      body: formData,
    });

    await this.handleResponse(response);
  }

  async deleteImage(imageId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/images/${imageId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    await this.handleResponse(response);
  }

  // ========================================
  // Piles
  // ========================================

  async getAllPiles(): Promise<Pile[]> {
    const response = await fetch(`${API_BASE_URL}/piles`, {
      headers: this.getAuthHeader(),
    });

    const piles = await this.handleResponse<any[]>(response);

    return piles.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      specimenIds: p.specimen_ids || p.specimenIds || [],
      createdAt: new Date(p.created_at).getTime(),
    }));
  }

  async createPile(name: string, description: string): Promise<Pile> {
    const response = await fetch(`${API_BASE_URL}/piles`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    const p = await this.handleResponse<any>(response);

    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      specimenIds: p.specimen_ids || [],
      createdAt: new Date(p.created_at).getTime(),
    };
  }

  async updatePile(id: number, name: string, description: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/piles/${id}`, {
      method: 'PUT',
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    await this.handleResponse(response);
  }

  async deletePile(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/piles/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    await this.handleResponse(response);
  }

  async addSpecimenToPile(pileId: number, specimenId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/piles/${pileId}/specimens/${specimenId}`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    await this.handleResponse(response);
  }

  async removeSpecimenFromPile(pileId: number, specimenId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/piles/${pileId}/specimens/${specimenId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    await this.handleResponse(response);
  }

  // Note: Pile reordering would need a new endpoint on backend
  async savePiles(piles: Pile[]): Promise<void> {
    // For now, this is a no-op since the backend doesn't have a bulk update endpoint
    // You could implement a PUT /api/piles endpoint that accepts an array
    console.warn('Pile reordering not yet implemented on backend');
  }

  // ========================================
  // Annotations
  // ========================================

  async addAnnotation(specimenId: number, annotation: Omit<Annotation, 'id' | 'timestamp'>): Promise<Annotation> {
    const response = await fetch(`${API_BASE_URL}/specimens/${specimenId}/annotations`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: annotation.text }),
    });

    const anno = await this.handleResponse<any>(response);

    return {
      id: anno.id,
      text: anno.text,
      author: anno.author || 'Current User',
      timestamp: new Date(anno.timestamp).getTime(),
    };
  }

  async deleteAnnotation(annotationId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/annotations/${annotationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    // Don't try to parse response body for DELETE - just check if it succeeded
  }
}

export const apiClient = new ApiClient();
