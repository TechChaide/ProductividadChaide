import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment.prod";
import { Observable } from "rxjs";
import { BodyListResponse } from "src/app/@core/models/general/body-list-response";
import { BodyResponse } from "src/app/@core/models/general/body-response";
import { OrdenEmpleado } from "src/app/@core/models/inventario/interfaces"; // Ajusta esta ruta si es necesario

const API_URL = environment.apiURL;

@Injectable({
  providedIn: 'root',
})
export class OrdenEmpleadoService {

  constructor(private http: HttpClient) { }

  getAll(): Observable<BodyListResponse<OrdenEmpleado>> {
    return this.http.get<BodyListResponse<OrdenEmpleado>>(API_URL + '/api/ORDEN-EMPLEADO');
  }

  save(data: OrdenEmpleado): Observable<BodyResponse<OrdenEmpleado>> {
    return this.http.post<BodyResponse<OrdenEmpleado>>(API_URL + '/api/ORDEN-EMPLEADO', data);
  }

  getById(id: number | string): Observable<BodyResponse<OrdenEmpleado>> {
    return this.http.get<BodyResponse<OrdenEmpleado>>(API_URL + '/api/ORDEN-EMPLEADO/' + id);
  }

  delete(id: number | string): Observable<BodyResponse<OrdenEmpleado>> {
    return this.http.delete<BodyResponse<OrdenEmpleado>>(API_URL + '/api/ORDEN-EMPLEADO/' + id);
  }
}