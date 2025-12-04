"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useSidebar } from '@/components/ui/sidebar-new';

export function SidebarLogo() {
  const { isCollapsed } = useSidebar();
  return (
    <Link href="/dashboard" className={`flex items-center justify-center py-0 cursor-pointer group ${isCollapsed ? 'w-full' : ''}`}>
      <div className="flex-shrink-0 items-center">
        {isCollapsed ? (
          <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH}/img/Chide.svg`} alt="Chaide" width={32} height={32} />
        ) : (
          <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH}/img/logo_chaide.svg`} alt="Certificados Calidad" width={180} height={128} />
        )}
      </div>
      {/* {!isCollapsed && (
        <span className="font-semibold text-lg whitespace-nowrap">Certificados Calidad</span>
      )} */}
    </Link>
  );
}
