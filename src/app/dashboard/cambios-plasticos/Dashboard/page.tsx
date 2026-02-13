'use client';

import { useEffect, useState } from 'react';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { addDays } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import { servicioService } from '@/services/servicio.service';
import type {
  LogCambioPlasticos,
  CambioPorTipo,
  CambioPorSolicitante,
} from '@/types/interfaces';
import MetricasCard from '../components/MetricasCard';
import ProcesosPorAreaSection from '../components/ProcesosPorAreaSection';
import ActividadRecienteSection from '../components/ActividadRecienteSection';
import CambiosPorTipoSection from '../components/CambiosPorTipoSection';
import TendenciaCambios from '../components/TendenciaCambios';
import VolumenPorSolicitante from '../components/VolumenPorSolicitante';

export default function CambiosPlasticosDashboard() {
  // General Dashboard Data
  const [ultimosCambios, setUltimosCambios] = useState<LogCambioPlasticos[]>([]);
  const [procesosPorTipo, setProcesosPorTipo] = useState<CambioPorTipo[]>([]);
  const [cambiosPorSolicitante, setCambiosPorSolicitante] = useState<CambioPorSolicitante[]>([]);

  // Filtered Dashboard Data
  const [rawFilteredCambios, setRawFilteredCambios] = useState<LogCambioPlasticos[]>([]); // Datos sin filtrar por material
  const [filteredCambios, setFilteredCambios] = useState<LogCambioPlasticos[]>([]);
  const [filteredProcesosPorTipo, setFilteredProcesosPorTipo] = useState<CambioPorTipo[]>([]);
  const [filteredCambiosPorSolicitante, setFilteredCambiosPorSolicitante] = useState<CambioPorSolicitante[]>([]);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materiales, setMateriales] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'filtrado'>('general');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [dateRange, setDateRange] = useState([
    {
      startDate: addDays(new Date(), -30),
      endDate: new Date(),
      key: 'selection',
    },
  ]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Cargar datos iniciales del dashboard general
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [cambios, tipos, solicitantes, materialesResp] = await Promise.all([
          servicioService.getUltimosCambios(),
          servicioService.getProcesosPorTipoCambio(),
          servicioService.getCambiosPorSolicitante(),
          servicioService.getMaterialesCambiados(),
        ]);

        setUltimosCambios(cambios.data || []);
        setProcesosPorTipo(tipos.data || []);
        setCambiosPorSolicitante(solicitantes.data || []);
        setMateriales(materialesResp?.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar datos';
        setError(message);
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper to convert date to Ecuador timezone
  const convertToEcuadorTZ = (date: Date): Date => {
    const ecuadorTZ = 'America/Guayaquil';
    const ecuadorDate = new Date(date.toLocaleString('en-US', { timeZone: ecuadorTZ }));
    return ecuadorDate;
  };

  // Handle date range change
  const handleDateRangeChange = (ranges: any) => {
    setDateRange([ranges.selection]);
  };

  // Filtrar automáticamente cuando cambia el material
  useEffect(() => {
    if (rawFilteredCambios.length === 0) return;

    let cambiosData = [...rawFilteredCambios];

    // Filtrar por material si está seleccionado
    if (selectedMaterial) {
      cambiosData = cambiosData.filter(
        (item: any) => item.material_cambio === selectedMaterial
      );
    }

    setFilteredCambios(cambiosData);

    // === Replicar SP sp_GetResumenCambiosPlastico ===
    const tiposMap: Record<string, { cantidad: number; unidades: string }> = {};
    cambiosData.forEach((item: any) => {
      const tipo = item.tipo_cambio || 'OTRO';
      const qty = Number(item.material_cambio_cantidad ?? 0);
      const unidades = item.material_cambio_unidad || 'KG';
      
      if (!tiposMap[tipo]) {
        tiposMap[tipo] = { cantidad: 0, unidades };
      }
      tiposMap[tipo].cantidad += qty;
    });

    const nuevosPorTipo: CambioPorTipo[] = Object.entries(tiposMap).map(([tipo, data]) => ({
      tipo_cambio: tipo,
      cantidad: data.cantidad,
      Unidades: data.unidades,
    }));
    setFilteredProcesosPorTipo(nuevosPorTipo);

    // === Replicar SP sp_GetProcesosPorSolicitante ===
    const productoMap: Record<string, any> = {};
    cambiosData.forEach((item: any) => {
      const productoId = item.identificacion_producto;
      if (!productoMap[productoId] || new Date(item.fecha_cambio) > new Date(productoMap[productoId].fecha_cambio)) {
        productoMap[productoId] = item;
      }
    });

    const solicitantesMap: Record<string, number> = {};
    Object.values(productoMap).forEach((item: any) => {
      const solicitante = item.solicitante || 'SIN SOLICITANTE';
      solicitantesMap[solicitante] = (solicitantesMap[solicitante] || 0) + 1;
    });

    const nuevosPorSolicitante: CambioPorSolicitante[] = Object.entries(solicitantesMap).map(
      ([solicitante, total]) => ({
        solicitante,
        total_ordenes: total,
      })
    );
    setFilteredCambiosPorSolicitante(nuevosPorSolicitante);
  }, [selectedMaterial, rawFilteredCambios]);

  // Buscar por intervalo de fechas
  const handleSearchByDateRange = async () => {
    try {
      const startDate = convertToEcuadorTZ(dateRange[0].startDate);
      const endDate = convertToEcuadorTZ(dateRange[0].endDate);

      // Llamar al servicio para obtener datos crudos
      const response = await servicioService.getCambiosPorIntervaloDeFechas(startDate, endDate);
      let cambiosData = response.data || [];

      // Guardar datos crudos SIN filtrar por material
      setRawFilteredCambios(cambiosData);
      // El useEffect de filtrado automático se encargará del resto

      console.log('Datos cargados. Total registros:', cambiosData.length);
      setIsDatePickerOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar datos por fecha';
      setError(message);
      console.error('Error fetching data by date range:', err);
    }
  };

  // Calcular métricas para Dashboard General
  const generalTotalReprocesos =
    procesosPorTipo.find((p) => p.tipo_cambio === 'REPROCESO')?.cantidad || 0;
  const generalTotalDobleplastico =
    procesosPorTipo.find((p) => p.tipo_cambio === 'DOBLE PLASTICO')?.cantidad || 0;
  const generalTotalRegistros = ultimosCambios.length;

  // Calcular métricas para Dashboard Filtrado
  const filteredTotalReprocesos = filteredCambios
    .filter((item) => item.tipo_cambio === 'REPROCESO')
    .reduce((sum, item) => sum + (Number(item.material_cambio_cantidad) || 0), 0);

  const filteredTotalDobleplastico = filteredCambios
    .filter((item) => item.tipo_cambio === 'DOBLE PLASTICO')
    .reduce((sum, item) => sum + (Number(item.material_cambio_cantidad) || 0), 0);

  const filteredTotalRegistros = filteredCambios.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Cambios de Plásticos</h1>
          <p className="text-gray-600 mt-2">
            Monitoreo de cambios de materiales en procesos de producción
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-300">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-3 font-medium border-b-2 transition ${
                activeTab === 'general'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard General
            </button>
            <button
              onClick={() => setActiveTab('filtrado')}
              className={`px-6 py-3 font-medium border-b-2 transition ${
                activeTab === 'filtrado'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard Filtrado
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Dashboard General */}
        {activeTab === 'general' && (
          <>
            {/* Métricas Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricasCard
                title="REPROCESOS"
                value={Math.round(generalTotalReprocesos * 100) / 100}
                unit="KG"
                icon="warning"
                color="yellow"
              />
              <MetricasCard
                title="DOBLE PLÁSTICO"
                value={Math.round(generalTotalDobleplastico * 100) / 100}
                unit="KG"
                icon="box"
                color="blue"
              />
              <MetricasCard
                title="TOTAL REGISTROS"
                value={generalTotalRegistros}
                unit=""
                icon="clock"
                color="green"
              />
            </div>

            {/* Primera fila de gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <CambiosPorTipoSection data={procesosPorTipo} />
              <TendenciaCambios data={ultimosCambios} />
            </div>

            {/* Segunda fila */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <ProcesosPorAreaSection data={cambiosPorSolicitante} />
              </div>
              <div>
                <ActividadRecienteSection data={ultimosCambios} />
              </div>
            </div>

            {/* Tercera fila - Volumen */}
            <div>
              <VolumenPorSolicitante data={cambiosPorSolicitante} />
            </div>
          </>
        )}

        {/* Dashboard Filtrado */}
        {activeTab === 'filtrado' && (
          <>
            {/* Filtros */}
            <div className="mb-8 bg-white p-6 rounded-lg shadow">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label htmlFor="material-select" className="text-sm text-gray-700 font-medium block mb-2">
                    Material:
                  </label>
                  <select
                    id="material-select"
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="w-full border rounded px-3 py-2 bg-white text-sm"
                  >
                    <option value="">Todos los materiales</option>
                    {materiales.map((m: any) => {
                      const code = m?.codes ?? m?.code ?? m?.codigo ?? m?.material ?? '';
                      const name =
                        m?.nombre ?? m?.nombre_material ?? m?.material_cambio_nombre ?? '';
                      return (
                        <option key={`${code}`} value={code}>{`${code} - ${name}`}</option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex-1 relative">
                  <label htmlFor="date-picker-button" className="text-sm text-gray-700 font-medium block mb-2">
                    Rango de Fechas:
                  </label>
                  <button
                    id="date-picker-button"
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="w-full border rounded px-3 py-2 bg-white text-sm flex items-center gap-2 hover:bg-gray-50"
                  >
                    📅{' '}
                    {dateRange[0]?.startDate
                      ? `${dateRange[0].startDate.toLocaleDateString('es-EC')} - ${dateRange[0].endDate.toLocaleDateString('es-EC')}`
                      : 'Seleccionar fechas'}
                    <span className="text-xs">▼</span>
                  </button>

                  {isDatePickerOpen && (
                    <div className="absolute left-0 top-full mt-2 bg-white border rounded shadow-lg z-50">
                      <DateRange
                        ranges={dateRange}
                        onChange={handleDateRangeChange}
                        editableDateInputs={true}
                        moveRangeOnFirstSelection={false}
                        months={1}
                        direction="horizontal"
                        locale={esLocale}
                      />
                      <div className="flex gap-2 p-3 border-t">
                        <button
                          onClick={handleSearchByDateRange}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 font-medium"
                        >
                          Buscar
                        </button>
                        <button
                          onClick={() => setIsDatePickerOpen(false)}
                          className="flex-1 bg-gray-300 text-gray-800 px-3 py-2 rounded text-sm hover:bg-gray-400"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Métricas Cards Filtradas */}
            {filteredCambios.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <MetricasCard
                    title="REPROCESOS"
                    value={Math.round(filteredTotalReprocesos * 100) / 100}
                    unit="KG"
                    icon="warning"
                    color="yellow"
                  />
                  <MetricasCard
                    title="DOBLE PLÁSTICO"
                    value={Math.round(filteredTotalDobleplastico * 100) / 100}
                    unit="KG"
                    icon="box"
                    color="blue"
                  />
                  <MetricasCard
                    title="TOTAL REGISTROS"
                    value={filteredTotalRegistros}
                    unit=""
                    icon="clock"
                    color="green"
                  />
                </div>

                {/* Primera fila de gráficas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <CambiosPorTipoSection data={filteredProcesosPorTipo} />
                  <TendenciaCambios data={filteredCambios} />
                </div>

                {/* Segunda fila */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  <div className="lg:col-span-2">
                    <ProcesosPorAreaSection data={filteredCambiosPorSolicitante} />
                  </div>
                  <div>
                    <ActividadRecienteSection data={filteredCambios} />
                  </div>
                </div>

                {/* Tercera fila - Volumen */}
                <div>
                  <VolumenPorSolicitante data={filteredCambiosPorSolicitante} />
                </div>
              </>
            )}

            {filteredCambios.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg">
                <p className="text-gray-500">
                  Selecciona un rango de fechas y haz clic en "Buscar" para ver los datos filtrados.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
