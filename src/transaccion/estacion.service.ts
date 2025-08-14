import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment.prod";
import { Observable } from "rxjs";
import { BodyListResponse } from "src/app/@core/models/general/body-list-response";
import { BodyResponse } from "src/app/@core/models/general/body-response";
import { Estacion } from "src/app/@core/models/inventario/interfaces"; // Ajusta esta ruta si es necesario

const API_URL = environment.apiURL;

@Injectable({
  providedIn: 'root',
})
export class EstacionService {

  constructor(private http: HttpClient) { }

  getAll(): Observable<BodyListResponse<Estacion>> {
    return this.http.get<BodyListResponse<Estacion>>(API_URL + '/api/estacion');
  }

  save(data: Estacion): Observable<BodyResponse<Estacion>> {
    return this.http.post<BodyResponse<Estacion>>(API_URL + '/api/estacion', data);
  }

  getById(id: number | string): Observable<BodyResponse<Estacion>> {
    return this.http.get<BodyResponse<Estacion>>(API_URL + '/api/estacion/' + id);
  }

  delete(id: number | string): Observable<BodyResponse<Estacion>> {
    return this.http.delete<BodyResponse<Estacion>>(API_URL + '/api/estacion/' + id);
  }
}