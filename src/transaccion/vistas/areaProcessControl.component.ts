import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { catchError, delay, tap } from 'rxjs';

// Reemplaza estas importaciones con las rutas correctas en tu proyecto
import { AreaProcessControl } from 'src/app/@core/models/inventario/interfaces';
import { AreaProcessControlService } from 'src/app/@shared/services/inventario/areaProcessControl/areaProcessControl.service';
import { ToastService } from 'ng-devui'; // O tu servicio de notificaciones preferido
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/@core/services/auth.service'; // O tu servicio de autenticación

@Component({
  selector: 'app-area-process-control',
  templateUrl: './areaProcessControl.component.html',
  styleUrls: ['./areaProcessControl.component.scss'],
})
export class AreaProcessControlComponent implements OnInit {
  
  public listado: AreaProcessControl[] = [];
  public formulario!: FormGroup;
  public banderaMostrarDetalles: boolean = false;
  public banderaEditar: boolean = false;
  
  // Permisos de ejemplo
  public canRead: boolean = true;
  public canCreate: boolean = true;
  public canUpdate: boolean = true;
  public canDelete: boolean = true;

  // Configuración de la tabla
  displayedColumns: string[] = ['codigo_rcp', 'resp_ctrl_prod', 'estado', 'maquina', 'mac_address', 'Acciones'];
  dataSource = new MatTableDataSource<AreaProcessControl>([]);
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private fb: FormBuilder,
    private areaProcessControlService: AreaProcessControlService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastService, // O tu servicio de notificaciones
    private authService: AuthService // O tu servicio de autenticación
  ) {}

  ngOnInit() {
    this.formulario = this.fb.group({
      codigo_rcp: [null, [Validators.required]],
      resp_ctrl_prod: [null, [Validators.required]],
      estado: [null, [Validators.required]],
      maquina: [null, [Validators.required]],
      mac_address: [null, [Validators.required]],
    });
    this.formulario.get('codigo_rcp')!.setValue(0);
    this.getAllRecords();
  }
  
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  getAllRecords() {
    this.areaProcessControlService.getAll().pipe(
        tap((res) => {
          if (res.data) {
            this.listado = res.data;
            this.dataSource.data = this.listado;
            this.cdr.detectChanges();
          }
        }),
        catchError((err) => {
          this.mensajeError('Error al obtener los registros');
          return [];
        })
      ).subscribe();
  }

  guardar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const data = this.formulario.value as AreaProcessControl;
    this.areaProcessControlService.save(data).pipe(
        tap(() => {
          this.mensajeSuccess('Registro guardado exitosamente');
          this.resetForm();
          this.getAllRecords();
        }),
        catchError((err) => {
          this.mensajeError('Error al guardar el registro');
          return [];
        })
      ).subscribe();
  }
  
  editar(element: AreaProcessControl) {
    this.formulario.patchValue(element);
    this.banderaEditar = true;
    this.banderaMostrarDetalles = false;
    this.mensajeWarning('Modo Edición activado');
  }

  resetForm() {
    this.formulario.reset();
    this.formulario.get('codigo_rcp')!.setValue(0);
    this.banderaEditar = false;
  }
  
  verDetalle() {
    this.banderaMostrarDetalles = !this.banderaMostrarDetalles;
    if (!this.banderaMostrarDetalles) {
      this.resetForm();
    }
  }

  // Funciones de notificación de ejemplo
  mensajeSuccess = (msg: string) => this.toastr.open({ value: [{ severity: 'success', summary: 'Éxito', content: msg }]});
  mensajeError = (msg: string) => this.toastr.open({ value: [{ severity: 'error', summary: 'Error', content: msg }]});
  mensajeWarning = (msg: string) => this.toastr.open({ value: [{ severity: 'warn', summary: 'Advertencia', content: msg }]});
}