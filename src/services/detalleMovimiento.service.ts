import { environment } from "@/environments/environments.prod";
import type { DetalleMovimiento } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/detalle_movimiento`;

export const detalleMovimientoService = {
  async getAll(): Promise<BodyListResponse<DetalleMovimiento>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch detalle movimientos');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<DetalleMovimiento>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch detalle movimiento with id ${id}`);
    }
    return response.json();
  },

  async save(data: DetalleMovimiento): Promise<BodyResponse<DetalleMovimiento>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save detalle movimiento');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<DetalleMovimiento>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete detalle movimiento with id ${id}`);
    }
    return response.json();
  },
};
