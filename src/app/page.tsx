"use client";

import { useEffect } from "react";
import { useUser } from "@/context/user-context";
import LoginForm from "@/app/shared/components/login/login-form";
import Image from "next/image";
export default function LoginPage() {
  const { logout } = useUser();

  useEffect(() => {
    // Clear all session data and local storage when the login page loads.
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on component mount.

  return (
    <div className="flex min-h-screen w-full">
      {/* Left Blue Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col items-center justify-center p-10 text-white">
        {/* <img
          src="/img/logo_chaide.svg"
          alt="Chaide Logo"
          width="300"
          height="300"
          data-ai-hint="company logo white text" /> */}

        <Image
          src="/img/logo_chaide.svg" // La ruta desde la carpeta 'public'
          alt="Chaide Logo"
          width={300}
          height={300}
          priority // Añade 'priority' si es una imagen importante para que cargue más rápido
        />
      </div>

      {/* Right White Panel */}
      <div className="w-full lg:w-1/2 bg-background flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          {/* This logo is now inside the LoginForm component to be visible on all screen sizes */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
