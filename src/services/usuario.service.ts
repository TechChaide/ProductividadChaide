
import { environment } from "@/environments/environments.prod";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import type { Usuario } from "@/types/interfaces";

const API_URL = `${environment.apiURL}/api/usuarios`;

export const usuarioService = {
  async getUsuarios(): Promise<BodyListResponse<Usuario>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },

  async guardarUsuario(usuario: Usuario): Promise<BodyResponse<Usuario>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(usuario),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Error desconocido al guardar usuario.' }));
        throw new Error(errorBody.message || 'Failed to save user');
    }
    return response.json();
  },

  async getUsuarioById(id: string): Promise<BodyResponse<Usuario>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user with id ${id}`);
    }
    return response.json();
  },

  async eliminarUsuario(id: string): Promise<BodyResponse<Usuario>> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });
     if (!response.ok) {
      throw new Error(`Failed to delete user with id ${id}`);
    }
    return response.json();
  },
};
