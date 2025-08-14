import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment.prod";
import { Observable } from "rxjs";
import { BodyListResponse } from "src/app/@core/models/general/body-list-response";
import { BodyResponse } from "src/app/@core/models/general/body-response";
import { Linea } from "src/app/@core/models/inventario/interfaces"; // Ajusta esta ruta si es necesario

const API_URL = environment.apiURL;

@Injectable({
  providedIn: 'root',
})
export class LineaService {

  constructor(private http: HttpClient) { }

  getAll(): Observable<BodyListResponse<Linea>> {
    return this.http.get<BodyListResponse<Linea>>(API_URL + '/api/linea');
  }

  save(data: Linea): Observable<BodyResponse<Linea>> {
    return this.http.post<BodyResponse<Linea>>(API_URL + '/api/linea', data);
  }

  getById(id: number | string): Observable<BodyResponse<Linea>> {
    return this.http.get<BodyResponse<Linea>>(API_URL + '/api/linea/' + id);
  }

  delete(id: number | string): Observable<BodyResponse<Linea>> {
    return this.http.delete<BodyResponse<Linea>>(API_URL + '/api/linea/' + id);
  }
}