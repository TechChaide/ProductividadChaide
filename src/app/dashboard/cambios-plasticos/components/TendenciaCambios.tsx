'use client';

import React from 'react';
import type { LogCambioPlasticos } from '@/types/interfaces';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TendenciaCambiosProps {
  data: LogCambioPlasticos[];
}

export default function TendenciaCambios({ data }: TendenciaCambiosProps) {
  // Agrupar por fecha
  const cambiosPorFecha = data.reduce((acc, item) => {
    const fecha = new Date(item.fecha_cambio).toLocaleDateString('es-CO');
    const existing = acc.find(f => f.fecha === fecha);
    
    if (existing) {
      existing.cantidad += 1;
      existing.reprocesos += item.tipo_cambio === 'REPROCESO' ? 1 : 0;
      existing.doble += item.tipo_cambio === 'DOBLE PLASTICO' ? 1 : 0;
    } else {
      acc.push({
        fecha,
        cantidad: 1,
        reprocesos: item.tipo_cambio === 'REPROCESO' ? 1 : 0,
        doble: item.tipo_cambio === 'DOBLE PLASTICO' ? 1 : 0,
      });
    }
    
    return acc;
  }, [] as Array<{ fecha: string; cantidad: number; reprocesos: number; doble: number }>);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">
        TENDENCIA DE CAMBIOS
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={cambiosPorFecha}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="fecha" 
            tick={{ fill: '#6b7280', fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Line
            type="monotone"
            dataKey="cantidad"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Total"
          />
          <Line
            type="monotone"
            dataKey="reprocesos"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ fill: '#f59e0b', r: 4 }}
            activeDot={{ r: 6 }}
            name="Reprocesos"
          />
          <Line
            type="monotone"
            dataKey="doble"
            stroke="#ec4899"
            strokeWidth={2}
            dot={{ fill: '#ec4899', r: 4 }}
            activeDot={{ r: 6 }}
            name="Doble Plástico"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-gray-700">Total</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-700">Reprocesos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500" />
          <span className="text-gray-700">Doble Plástico</span>
        </div>
      </div>
    </div>
  );
}
