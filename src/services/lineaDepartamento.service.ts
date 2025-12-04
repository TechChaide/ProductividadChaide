
import { environment } from "@/environments/environments.prod";
import type { LineaDepartamento } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/linea-departamentos`;

export const lineaDepartamentoService = {
  async getAll(): Promise<BodyListResponse<LineaDepartamento>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch linea-departamentos');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<LineaDepartamento>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch linea-departamento with id ${id}`);
    }
    return response.json();
  },
async getByDepartamento(codigo_departamento: number): Promise<BodyListResponse<LineaDepartamento>> {
    const response = await fetch(`${API_URL}/departamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_departamento }),
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorBody.message || `Failed to fetch lineas for departamento ${codigo_departamento}`);
    }
    return response.json();
},

  async save(data: LineaDepartamento): Promise<BodyResponse<LineaDepartamento>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save linea-departamento');
    }
    return response.json();
  },

  async deactivate(id: number | string): Promise<BodyResponse<LineaDepartamento>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to deactivate linea-departamento with id ${id}`);
    }
    return response.json();
  },
};
