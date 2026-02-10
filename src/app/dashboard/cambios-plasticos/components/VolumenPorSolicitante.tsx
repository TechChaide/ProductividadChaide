'use client';

import React, { useEffect, useState } from 'react';
import type { CambioPorSolicitante } from '@/types/interfaces';
import { authService } from '@/services/authService';
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts';

interface VolumenPorSolicitanteProps {
  data: CambioPorSolicitante[];
}

interface SolicitanteConNombre extends CambioPorSolicitante {
  nombre: string;
  porcentaje: number;
}

const COLORS = [
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
];

export default function VolumenPorSolicitante({ data }: VolumenPorSolicitanteProps) {
  const [solicitantes, setSolicitantes] = useState<SolicitanteConNombre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const obtenerNombres = async () => {
      try {
        const totalOrdenes = data.reduce((sum, item) => sum + item.total_ordenes, 0);

        const conNombres = await Promise.all(
          data.map(async (item) => {
            try {
              const response = await authService.loginColaborador(item.solicitante);
              const nombre = response.user?.ficha?.NOMBRE || 'Sin Nombre';
              
              return {
                ...item,
                nombre,
                porcentaje: (item.total_ordenes / totalOrdenes) * 100,
              };
            } catch (error) {
              return {
                ...item,
                nombre: `Código ${item.solicitante}`,
                porcentaje: (item.total_ordenes / totalOrdenes) * 100,
              };
            }
          })
        );

        setSolicitantes(conNombres.sort((a, b) => b.total_ordenes - a.total_ordenes));
      } finally {
        setLoading(false);
      }
    };

    if (data.length > 0) {
      obtenerNombres();
    }
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-gray-600 text-sm">Cargando volumen...</p>
          </div>
        </div>
      </div>
    );
  }

  // Transformar para Treemap
  const treemapData = [
    {
      name: 'Volumen por Solicitante',
      children: solicitantes.map((item, index) => ({
        name: item.nombre,
        value: item.total_ordenes,
        porcentaje: item.porcentaje.toFixed(1),
        color: COLORS[index % COLORS.length],
      })),
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">
        VOLUMEN POR SOLICITANTE
      </h3>

      <ResponsiveContainer width="100%" height={350}>
        <Treemap
          data={treemapData}
          dataKey="value"
          stroke="#fff"
          fill="#8884d8"
        >
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: any) => [
              `${value} órdenes`,
              'Cantidad',
            ]}
            labelFormatter={(label: any) => label}
          />
        </Treemap>
      </ResponsiveContainer>

      {/* Grid de solicitantes */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        {solicitantes.map((item, index) => (
          <div
            key={item.solicitante}
            className="p-3 rounded-lg border border-gray-200"
            style={{ borderLeftColor: COLORS[index % COLORS.length], borderLeftWidth: 4 }}
          >
            <p className="font-medium text-gray-900 text-sm truncate">
              {item.nombre}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-lg font-bold text-gray-900">
                {item.total_ordenes}
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {item.porcentaje.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
