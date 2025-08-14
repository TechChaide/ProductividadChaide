
import { environment } from "@/environments/environments.prod";
import type { OrdenEmpleadoDecimal } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/ORDEN-EMPLEADO-DECIMALs`;

export const ordenEmpleadoDecimalService = {
  async getAll(): Promise<BodyListResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch decimal employee orders');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch decimal employee order with id ${id}`);
    }
    return response.json();
  },

  async save(data: OrdenEmpleadoDecimal): Promise<BodyResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || 'Failed to save decimal employee order');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || `Failed to delete decimal employee order with id ${id}`);
    }
    return response.json();
  },
};
