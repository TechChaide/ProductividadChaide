import React from "react";

interface BarcodeProps {
  value: string;
  height?: number;
  width?: number;
}

// Simple SVG barcode (Code128-like, for visual only, not for scanning)
export const Barcode: React.FC<BarcodeProps> = ({ value, height = 48, width = 240 }) => {
  // Fake barcode pattern for visual only
  const bars = value.split("").map((char, i) => (
    <rect
      key={i}
      x={i * 3}
      y={0}
      width={Math.random() > 0.5 ? 2 : 1}
      height={height}
      fill="#222"
      opacity={Math.random() > 0.2 ? 1 : 0.5}
    />
  ));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${value.length * 3} ${height}`} style={{ background: "#fff" }}>
      {bars}
    </svg>
  );
};

export default Barcode;
