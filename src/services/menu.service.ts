import type { Menu } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiMenuURL}/api/menus`;

export const menuService = {
  async getUserProfiles(codigo_empleado: string): Promise<BodyListResponse<Menu>> {
    const response = await fetch(environment.apiMenuURL + "/api/usuarios/usuarioByCodigoEmpleado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_empleado: codigo_empleado }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(
        errorBody.message || `Failed to fetch menu with codigo ${codigo_empleado}`
      );
    }
    return response.json();
  },

  async getAplicationProfiles(codigo_aplicacion: string): Promise<BodyListResponse<any>> {
    const response = await fetch(environment.apiMenuURL + "/api/tipo-usuario-aplicacions/by_aplicacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_aplicacion: codigo_aplicacion }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(
        errorBody.message || `Failed to fetch menu with codigo ${codigo_aplicacion}`
      );
    }
    return response.json();
  },

  async getAll(): Promise<BodyListResponse<Menu>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to fetch menus");
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<Menu>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(
        errorBody.message || `Failed to fetch menu with id ${id}`
      );
    }
    return response.json();
  },

  async getMenuByCodigoTipoUsuario(
    codigo: number | string
  ): Promise<BodyResponse<Menu>> {
    const response = await fetch(API_URL + "/menu-tree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_tipo_usuario: codigo }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(
        errorBody.message || `Failed to fetch menu with codigo ${codigo}`
      );
    }
    return response.json();
  },

  async getMenuCodigoAplicacion(
    codigo: string
  ): Promise<BodyListResponse<Menu>> {
    const response = await fetch(`${API_URL}/by-aplicacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo_aplicacion: codigo }),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(
        errorBody.message || `Failed to fetch menu with codigo ${codigo}`
      );
    }
    return response.json();
  },

  async save(data: Menu): Promise<BodyResponse<Menu>> {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(errorBody.message || "Failed to save menu");
    }
    return response.json();
  },

  async delete(id: number | string): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error desconocido" }));
      throw new Error(
        errorBody.message || `Failed to delete menu with id ${id}`
      );
    }
  },
};
