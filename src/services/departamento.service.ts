
import { environment } from "@/environments/environments.prod";
import type { Departamento, Linea } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/departamentos`;

export const departamentoService = {
  async getAll(): Promise<BodyListResponse<Departamento>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch departamentos');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Departamento>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch departamento with id ${id}`);
    }
    return response.json();
  },

  async save(data: Departamento): Promise<BodyResponse<Departamento>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save linea');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<Departamento>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete linea with id ${id}`);
    }
    return response.json();
  },
};
