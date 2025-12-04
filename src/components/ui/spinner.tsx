import React from "react";

export const Spinner: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 48, color = "#0055b8", className = "" }) => (
  <svg
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    viewBox="0 0 50 50"
    style={{ display: "inline-block" }}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="25"
      cy="25"
      r="20"
      stroke={color}
      strokeWidth="5"
      strokeDasharray="31.4 31.4"
      strokeLinecap="round"
      opacity="0.3"
    />
    <path
      d="M45 25c0-11.046-8.954-20-20-20"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
    />
  </svg>
);

export default Spinner;
