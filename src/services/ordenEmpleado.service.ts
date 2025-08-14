
import { environment } from "@/environments/environments.prod";
import type { OrdenEmpleado } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/ORDEN-EMPLEADOs`;

export const ordenEmpleadoService = {
  async getAll(): Promise<BodyListResponse<OrdenEmpleado>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch employee orders');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<OrdenEmpleado>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch employee order with id ${id}`);
    }
    return response.json();
  },

  async save(data: OrdenEmpleado): Promise<BodyResponse<OrdenEmpleado>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || 'Failed to save employee order');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<OrdenEmpleado>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || `Failed to delete employee order with id ${id}`);
    }
    return response.json();
  },
};
