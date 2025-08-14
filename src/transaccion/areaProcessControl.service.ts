import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "src/environments/environment.prod";
import { Observable } from "rxjs";
import { BodyListResponse } from "src/app/@core/models/general/body-list-response";
import { BodyResponse } from "src/app/@core/models/general/body-response";
import { AreaProcessControl } from "src/app/@core/models/inventario/interfaces"; // Ajusta esta ruta si es necesario

const API_URL = environment.apiURL;

@Injectable({
  providedIn: 'root',
})
export class AreaProcessControlService {

  constructor(private http: HttpClient) { }

  getAll(): Observable<BodyListResponse<AreaProcessControl>> {
    return this.http.get<BodyListResponse<AreaProcessControl>>(API_URL + '/api/area-process-control');
  }

  save(data: AreaProcessControl): Observable<BodyResponse<AreaProcessControl>> {
    return this.http.post<BodyResponse<AreaProcessControl>>(API_URL + '/api/area-process-control', data);
  }

  getById(id: number | string): Observable<BodyResponse<AreaProcessControl>> {
    return this.http.get<BodyResponse<AreaProcessControl>>(API_URL + '/api/area-process-control/' + id);
  }

  delete(id: number | string): Observable<BodyResponse<AreaProcessControl>> {
    return this.http.delete<BodyResponse<AreaProcessControl>>(API_URL + '/api/area-process-control/' + id);
  }
}