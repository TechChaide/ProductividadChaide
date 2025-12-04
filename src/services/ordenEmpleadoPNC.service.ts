
import { environment } from "@/environments/environments.prod";
import type { OrdenEmpleadoDecimal } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/ORDEN-EMPLEADO-PNCs`;

export const ordenEmpleadoPNCService = {
  async getAll(): Promise<BodyListResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch decimal employee orders');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch decimal employee order with id ${id}`);
    }
    return response.json();
  },

  async save(data: OrdenEmpleadoDecimal): Promise<BodyResponse<OrdenEmpleadoDecimal>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to save decimal employee order');
    }
    return response.json();
  },
};
