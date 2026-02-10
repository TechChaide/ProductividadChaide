'use client';

import { useEffect, useState } from 'react';
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
  const [ultimosCambios, setUltimosCambios] = useState<LogCambioPlasticos[]>([]);
  const [procesosPorTipo, setProcesosPorTipo] = useState<CambioPorTipo[]>([]);
  const [cambiosPorSolicitante, setCambiosPorSolicitante] = useState<CambioPorSolicitante[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [cambios, tipos, solicitantes] = await Promise.all([
          servicioService.getUltimosCambios(),
          servicioService.getProcesosPorTipoCambio(),
          servicioService.getCambiosPorSolicitante(),
        ]);

        setUltimosCambios(cambios.data || []);
        setProcesosPorTipo(tipos.data || []);
        setCambiosPorSolicitante(solicitantes.data || []);
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

  // Calculate metrics
  const totalReprocesos = procesosPorTipo.find(
    (p) => p.tipo_cambio === 'REPROCESO'
  )?.cantidad || 0;

  const totalDobleplastico = procesosPorTipo.find(
    (p) => p.tipo_cambio === 'DOBLE PLASTICO'
  )?.cantidad || 0;

  const totalRegistros = ultimosCambios.length;

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
          <h1 className="text-3xl font-bold text-gray-900">
            Gestión de Cambios de Plásticos
          </h1>
          <p className="text-gray-600 mt-2">
            Monitoreo de cambios de materiales en procesos de producción
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Métricas Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricasCard
            title="REPROCESOS"
            value={Math.round(totalReprocesos * 100) / 100}
            unit="KG"
            icon="warning"
            color="yellow"
          />
          <MetricasCard
            title="DOBLE PLÁSTICO"
            value={Math.round(totalDobleplastico * 100) / 100}
            unit="KG"
            icon="box"
            color="blue"
          />
          <MetricasCard
            title="TOTAL REGISTROS"
            value={totalRegistros}
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
      </div>
    </div>
  );
}
