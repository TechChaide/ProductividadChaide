'use client';

import React from 'react';
import type { LogCambioPlasticos } from '@/types/interfaces';
import { ExternalLink } from 'lucide-react';

interface ActividadRecienteSectionProps {
  data: LogCambioPlasticos[];
}

export default function ActividadRecienteSection({
  data,
}: ActividadRecienteSectionProps) {
  const ultimosRegistros = data.slice(0, 8);

  const formatearFecha = (fecha: Date | string) => {
    const date = new Date(fecha);
    return new Intl.DateTimeFormat('es-CO', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getTipoCambioColor = (tipo: string) => {
    switch (tipo) {
      case 'REPROCESO':
        return 'bg-yellow-100 text-yellow-800';
      case 'DOBLE PLASTICO':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">ACTIVIDAD RECIENTE</h2>
        <a
          href="#"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
        >
          VER HISTORIAL
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Activity List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {ultimosRegistros.length > 0 ? (
          ultimosRegistros.map((item) => (
            <div
              key={item.codigo_log_cp}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              {/* Tipo de Cambio Badge */}
              <div className="flex items-start justify-between mb-2">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${getTipoCambioColor(item.tipo_cambio)}`}
                >
                  {item.tipo_cambio}
                </span>
                <span className="text-xs text-gray-500">
                  {formatearFecha(item.fecha_cambio)}
                </span>
              </div>

              {/* Product Info */}
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.nombre_producto}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {item.material_cambio_nombre || item.material_cambio}
                </p>
              </div>

              {/* Material and Quantity */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  {item.material_cambio_cantidad && (
                    <span>
                      {item.material_cambio_cantidad}{' '}
                      {item.material_cambio_unidad || 'KG'}
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium text-gray-700">
                  Est: {item.estacion}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No hay registros recientes.</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {ultimosRegistros.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Mostrando {ultimosRegistros.length} de {data.length} registros
          </p>
        </div>
      )}
    </div>
  );
}
