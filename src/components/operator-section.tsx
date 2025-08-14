
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';

interface OperatorSectionProps {
  onCodeSubmit: (code: string) => void;
  operatorImageUrl: string | null;
  operatorName: string | null;
  initialCode?: string;
}

export default function OperatorSection({ onCodeSubmit, operatorImageUrl, operatorName, initialCode }: OperatorSectionProps) {
  const [code, setCode] = useState(initialCode || '');

  // Effect to update the local code state if the user context changes (e.g., re-login)
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onCodeSubmit(code);
  };

  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-primary flex items-center">
          <User className="mr-2 h-5 w-5" /> Información del Operador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
           <div className="w-full flex flex-col items-center justify-center">
            {operatorImageUrl ? (
              <Image
                src={operatorImageUrl}
                alt={operatorName || "Operator"}
                width={120}
                height={120}
                className="rounded-lg shadow-md object-cover"
                data-ai-hint={operatorName ? "employee photo" : "avatar placeholder"}
              />
            ) : (
              <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center shadow-md" data-ai-hint="avatar icon">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {operatorName && (
              <p className="mt-3 text-md font-semibold text-foreground">{operatorName}</p>
            )}
          </div>
          <div className="w-full">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="operatorCode" className="block text-xs font-medium mb-1 text-muted-foreground">
                  Código de Empleado
                </label>
                <Input
                  id="operatorCode"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ingrese su código"
                  className="focus:ring-primary focus:border-primary h-9"
                  aria-label="Código de Empleado"
                  // The field can be disabled if a user is already logged in
                  // and we don't want them to change it here.
                  disabled={!!initialCode} 
                />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!!initialCode}>
                Cargar Empleado
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
