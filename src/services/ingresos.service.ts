import { environment } from "@/environments/environments.prod";
import type { Ingreso } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/ingresos`;

export const ingresosService = {
  async getAll(): Promise<BodyListResponse<Ingreso>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch ingresos');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Ingreso>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch ingreso with id ${id}`);
    }
    return response.json();
  },

  async save(data: Ingreso): Promise<BodyResponse<Ingreso>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save ingreso');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<Ingreso>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete ingreso with id ${id}`);
    }
    return response.json();
  },

  async getByQR(qr_bmp: string): Promise<BodyListResponse<Ingreso>> {
    const response = await fetch(`${API_URL}/byQR`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_bmp }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || errorBody.error || 'Failed to search ingreso by QR');
    }
    return response.json();
  },
};
