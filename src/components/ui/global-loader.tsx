import React from "react";
import Spinner from "@/components/ui/spinner";
import Image from "next/image";

export const GlobalLoader: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-full shadow-lg flex flex-col items-center justify-center aspect-square" style={{ width: 160, height: 160 }}>
        <div className="relative flex items-center justify-center rounded-full aspect-square bg-white" style={{ width: 88, height: 88 }}>
          <Spinner size={88} className="absolute top-0 left-0" />
          <Image src="/img/icon.png" alt="Logo Chaide" width={56} height={56} className="z-10" priority />
        </div>
      </div>
    </div>
  );
};

export default GlobalLoader;
