
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import type { Configuracion, Usuario } from "@/types/interfaces";

const API_URL = `${environment.apiURL_Guard}/api/configuracion`;

export const configuracionService = {
  async getConfiguraciones(): Promise<BodyListResponse<Configuracion>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch configuraciones');
    }
    return response.json();
  },

  async save(configuracion: Configuracion): Promise<BodyResponse<Configuracion>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(configuracion),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido al guardar configuracion.' }));
      throw new Error(errorBody.message || 'Failed to save configuracion');
    }
    return response.json();
  },

  async getConfiguracionById(id: string): Promise<BodyResponse<Configuracion>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch configuracion with id ${id}`);
    }
    return response.json();
  },

  async delete(id: string): Promise<BodyResponse<Configuracion>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete user with id ${id}`);
    }
    return response.json();
  },

  async getConfigrucacionesByCodigoAplicacion(): Promise<BodyListResponse<Configuracion>> {
    const response = await fetch(API_URL + '/by-codigo-aplicacion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },


      body: JSON.stringify({ codigo_aplicacion : environment.nombreAplicacion}),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido al guardar configuracion.' }));
      throw new Error(errorBody.message || 'Failed to save configuracion');
    }
    return response.json();
  },
};
