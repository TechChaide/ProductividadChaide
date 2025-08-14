import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment.prod";
import { Observable } from "rxjs";
import { BodyListResponse } from "src/app/@core/models/general/body-list-response";
import { BodyResponse } from "src/app/@core/models/general/body-response";
import { OrdenEmpleadoDecimal } from "src/app/@core/models/inventario/interfaces"; // Ajusta esta ruta si es necesario

const API_URL = environment.apiURL;

@Injectable({
  providedIn: 'root',
})
export class OrdenEmpleadoDecimalService {

  constructor(private http: HttpClient) { }

  getAll(): Observable<BodyListResponse<OrdenEmpleadoDecimal>> {
    return this.http.get<BodyListResponse<OrdenEmpleadoDecimal>>(API_URL + '/api/ORDEN-EMPLEADO-DECIMAL');
  }

  save(data: OrdenEmpleadoDecimal): Observable<BodyResponse<OrdenEmpleadoDecimal>> {
    return this.http.post<BodyResponse<OrdenEmpleadoDecimal>>(API_URL + '/api/ORDEN-EMPLEADO-DECIMAL', data);
  }

  getById(id: number | string): Observable<BodyResponse<OrdenEmpleadoDecimal>> {
    return this.http.get<BodyResponse<OrdenEmpleadoDecimal>>(API_URL + '/api/ORDEN-EMPLEADO-DECIMAL/' + id);
  }

  delete(id: number | string): Observable<BodyResponse<OrdenEmpleadoDecimal>> {
    return this.http.delete<BodyResponse<OrdenEmpleadoDecimal>>(API_URL + '/api/ORDEN-EMPLEADO-DECIMAL/' + id);
  }
}