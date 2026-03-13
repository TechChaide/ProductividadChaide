"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SesionManualContent from "./components/sesion-manual-content";
import CollaboratorLoginModal from "./components/collaborator-login-modal";
import { useUser } from "@/context/user-context";

export default function SesionManualPage() {
    const { isLoginModalOpen, setLoginModalOpen } = useUser();

    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Registro de Sesión Manual</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Permite registrar sesiones de trabajo de forma manual.
                    </p>
                </CardContent>
            </Card>

            <SesionManualContent />

            <CollaboratorLoginModal
                isOpen={isLoginModalOpen}
                onOpenChange={setLoginModalOpen}
            />
        </div>
    );
}
