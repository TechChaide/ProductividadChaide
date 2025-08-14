
import { environment } from "@/environments/environments.prod";
import type { Configuracion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/config`;

export const configuracionService = {
  async getAll(): Promise<BodyListResponse<Configuracion>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch configurations');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Configuracion>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch configuration with id ${id}`);
    }
    return response.json();
  },

  async save(data: Configuracion): Promise<BodyResponse<Configuracion>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to save configuration');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<Configuracion>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete configuration with id ${id}`);
    }
    return response.json();
  },
};
