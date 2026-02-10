'use client';

import React from 'react';
import { AlertCircle, Box, Clock } from 'lucide-react';

interface MetricasCardProps {
  title: string;
  value: number;
  unit: string;
  icon: 'warning' | 'box' | 'clock';
  color: 'yellow' | 'blue' | 'green';
}

const colorStyles = {
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
  },
};

const iconMap = {
  warning: AlertCircle,
  box: Box,
  clock: Clock,
};

export default function MetricasCard({
  title,
  value,
  unit,
  icon,
  color,
}: MetricasCardProps) {
  const IconComponent = iconMap[icon];
  const styles = colorStyles[color];

  return (
    <div
      className={`${styles.bg} border ${styles.border} rounded-xl p-6 flex items-center gap-4`}
    >
      <div className={`${styles.icon} p-4 bg-white rounded-lg`}>
        <IconComponent size={32} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">
          {value.toLocaleString('es-CO')}
          {unit && <span className="text-lg ml-2 text-gray-600">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
