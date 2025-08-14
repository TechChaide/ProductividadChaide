
"use client";

import { useState, useEffect } from 'react';
import OperatorSection from '@/components/operator-section';
import OrdersTable from '@/components/orders-table';
import SelectedOrderDisplay from '@/components/selected-order-display';
import type { Order } from '@/types/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OrderLookupPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [operatorImageUrl, setOperatorImageUrl] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [fabricatedQuantity, setFabricatedQuantity] = useState('');
  // Props requeridos para OrdersTable
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<string[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('all');

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleMachineChange = (value: string) => {
    setSelectedMachine(value);
  };

  useEffect(() => {
    setIsClient(true); 
  }, []);

  const handleOperatorCodeChange = (submittedCode: string) => {
    if (submittedCode.trim() === '') {
      setOperatorImageUrl(null);
      setOperatorName(null);
      return;
    }
    if (submittedCode === 'EMP123') {
      setOperatorImageUrl('https://placehold.co/150x150/0055b8/FFFFFF.png');
      setOperatorName('Juan Pérez'); 
    } else {
      setOperatorImageUrl('https://placehold.co/150x150/E0E0E0/B0B0B0.png');
      setOperatorName('Empleado Desconocido');
    }
  };

  const machineNameToDisplay = process.env.NEXT_PUBLIC_MACHINE_NAME || "N/A Maquina";

  if (!isClient) {
    return null; 
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8 flex flex-col items-center selection:bg-accent/30 selection:text-accent-foreground">
      <header className="w-full max-w-7xl mb-6 md:mb-10 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-headline font-semibold text-primary">
          NOTIFICACIÓN COSEDORAS DE FALSO
        </h1>
      </header>

      <main className="w-full max-w-7xl flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Left Column */}
        <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-6">
          <OperatorSection
            onCodeSubmit={handleOperatorCodeChange}
            operatorImageUrl={operatorImageUrl}
            operatorName={operatorName}
          />
        </div>

        {/* Right Column */}
        <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col gap-6">
          <OrdersTable 
            orders={orders}
            isLoading={isLoading}
            error={error}
            onOrderSelect={setSelectedOrder}
            selectedOrderId={selectedOrder?.id}
            onRefresh={handleRefresh}
            machines={machines}
            selectedMachine={selectedMachine}
            onMachineChange={handleMachineChange}
          />
          {selectedOrder && <SelectedOrderDisplay order={selectedOrder} />}
        </div>
      </main>
      
      <footer className="w-full max-w-7xl mt-10 md:mt-16 text-muted-foreground">
        <Card className="shadow-lg mb-6">
          <CardContent className="p-4 sm:p-6 text-sm">
            <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8">
              <p className="font-medium text-foreground">Máquina: {machineNameToDisplay}</p>
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="fabricatedQuantity" className="whitespace-nowrap text-sm text-foreground">Cant. Fabricada</Label>
                  <Input
                    type="number"
                    id="fabricatedQuantity"
                    value={fabricatedQuantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Allow empty string or positive integers (or zero)
                      if (val === '' || /^[0-9]*$/.test(val)) {
                         setFabricatedQuantity(val);
                      }
                    }} 
                    className="w-24 h-11" 
                    min="0"
                    placeholder="0"
                    aria-label="Cantidad Fabricada"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button 
                    size="lg" 
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Notificar
                  </Button>
                  <Button variant="destructive" size="lg">PNC</Button>
                  <Button variant="default" size="lg">Reproceso</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <hr className="border-border/50" />
        <p className="mt-4 text-center text-xs">&copy; {new Date().getFullYear()} Order Lookup Inc. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

