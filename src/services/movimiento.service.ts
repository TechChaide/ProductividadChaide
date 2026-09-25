import { environment } from "@/environments/environments.prod";
import type { Movimiento } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/movimiento`;

export const movimientoService = {
  async getAll(): Promise<BodyListResponse<Movimiento>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch movimientos');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Movimiento>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch movimiento with id ${id}`);
    }
    return response.json();
  },

  async save(data: Movimiento): Promise<BodyResponse<Movimiento>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save movimiento');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<Movimiento>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete movimiento with id ${id}`);
    }
    return response.json();
  },
};
