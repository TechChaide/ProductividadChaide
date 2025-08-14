
import { environment } from "@/environments/environments.prod";
import type { Sesion } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/sesions`;

export const sesionService = {
  async getAll(): Promise<BodyListResponse<Sesion>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to fetch sesiones');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Sesion>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to fetch sesion with id ${id}`);
    }
    return response.json();
  },

  async getByCodigoOperador(codigoOperador: string): Promise<BodyListResponse<Sesion>> {
    const response = await fetch(`${API_URL}/as/${codigoOperador}`);
    // If the response is not OK (e.g., 404, 500), throw an error with the server message.
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: `Error al buscar sesiones para el operador ${codigoOperador}` }));
        throw new Error(errorBody.message || `Failed to fetch sessions for operator ${codigoOperador}`);
    }
    // If the response is OK (e.g., 200), return the JSON body.
    // This correctly handles the case where the API returns an empty data array.
    return response.json();
  },

  async save(data: Partial<Sesion>): Promise<BodyResponse<Sesion>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save sesion');
    }
    return response.json();
  },

  async delete(id: number | string): Promise<BodyResponse<Sesion>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || `Failed to delete sesion with id ${id}`);
    }
    return response.json();
  },

  cerrarSesionUsuario: async (codigoEmpleado: string): Promise<BodyResponse<Sesion>> => {
    try {
      const response = await fetch(`${environment.apiURL}/api/sesions/cerrarSUsuario`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          // Add any other headers your API requires, e.g., Authorization
        },
        body: JSON.stringify({ codigoEmpleado: codigoEmpleado }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error al cerrar sesión de usuario' }));
        throw new Error(errorBody.message || `Failed to close session for employee ${codigoEmpleado}`);
      }

      return response.json();
    } catch (error) {
      console.error("Error in cerrarSesionUsuario:", error);
      throw error;
    }
  },
};
