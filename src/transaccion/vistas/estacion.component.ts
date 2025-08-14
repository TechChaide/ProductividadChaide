import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { catchError, delay, tap } from 'rxjs';

// Reemplaza estas importaciones con las rutas correctas en tu proyecto
import { Estacion } from 'src/app/@core/models/inventario/interfaces';
import { EstacionService } from 'src/app/@shared/services/inventario/estacion/estacion.service';
import { ToastService } from 'ng-devui'; // O tu servicio de notificaciones preferido
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/@core/services/auth.service'; // O tu servicio de autenticación

@Component({
  selector: 'app-estacion',
  templateUrl: './estacion.component.html',
  styleUrls: ['./estacion.component.scss'],
})
export class EstacionComponent implements OnInit {
  
  public listado: Estacion[] = [];
  public formulario!: FormGroup;
  public banderaMostrarDetalles: boolean = false;
  public banderaEditar: boolean = false;
  
  // Permisos de ejemplo
  public canRead: boolean = true;
  public canCreate: boolean = true;
  public canUpdate: boolean = true;
  public canDelete: boolean = true;

  // Configuración de la tabla
  displayedColumns: string[] = ['codigo_estacion', 'nombre_estacion', 'estado', 'usuario_modificacion', 'fecha_modificacion', 'codigo_linea', 'Acciones'];
  dataSource = new MatTableDataSource<Estacion>([]);
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private fb: FormBuilder,
    private estacionService: EstacionService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastService, // O tu servicio de notificaciones
    private authService: AuthService // O tu servicio de autenticación
  ) {}

  ngOnInit() {
    this.formulario = this.fb.group({
      codigo_estacion: [null, [Validators.required]],
      nombre_estacion: [null, [Validators.required]],
      estado: [null, [Validators.required]],
      usuario_modificacion: [null, [Validators.required]],
      fecha_modificacion: [null, [Validators.required]],
      codigo_linea: [null, [Validators.required]],
    });
    this.formulario.get('codigo_estacion')!.setValue(0);
    this.getAllRecords();
  }
  
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  getAllRecords() {
    this.estacionService.getAll().pipe(
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
    const data = this.formulario.value as Estacion;
    this.estacionService.save(data).pipe(
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
  
  editar(element: Estacion) {
    this.formulario.patchValue(element);
    this.banderaEditar = true;
    this.banderaMostrarDetalles = false;
    this.mensajeWarning('Modo Edición activado');
  }

  resetForm() {
    this.formulario.reset();
    this.formulario.get('codigo_estacion')!.setValue(0);
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