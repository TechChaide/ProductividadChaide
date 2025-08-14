
import { environment } from "@/environments/environments.prod";
import type { Estacion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/estacions`;

export const estacionService = {
  async getAll(): Promise<BodyListResponse<Estacion>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch estaciones');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Estacion>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch estacion with id ${id}`);
    }
    return response.json();
  },

  async save(data: Estacion): Promise<BodyResponse<Estacion>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save estacion');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<Estacion>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete estacion with id ${id}`);
    }
    return response.json();
  },
};
