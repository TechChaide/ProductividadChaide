
import { environment } from "@/environments/environments.prod";
import type { LogOrdenes } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";

const API_URL = `${environment.apiURL}/api/log-ordenes`;

export const logOrdenesService = {
  async getAll(): Promise<BodyListResponse<LogOrdenes>> {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch order logs');
    }
    return response.json();
  },

  async getById(id: number | string): Promise<BodyResponse<LogOrdenes>> {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch order log with id ${id}`);
    }
    return response.json();
  },

  async save(data: LogOrdenes): Promise<BodyResponse<LogOrdenes>> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to save order log');
    }
    return response.json();
  },
};
