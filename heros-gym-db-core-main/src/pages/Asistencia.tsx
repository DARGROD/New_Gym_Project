import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";
import TopNavigation from "@/components/TopNavigation";

const Asistencia = () => {
  const [cedula, setCedula] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const registrarAsistencia = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cedula.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingrese una cédula",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Simulación de registro de asistencia
      // Aquí se validará si el cliente existe y tiene membresía activa
      const clientesMuestra = [
        {
          id: "1",
          national_id: "1-2345-6789",
          first_name: "Juan",
          last_name: "Pérez",
          status: "active",
          memberships: [{
            status: "active",
            end_date: "2024-12-31"
          }]
        },
        {
          id: "2",
          national_id: "2-3456-7890",
          first_name: "María",
          last_name: "González",
          status: "active",
          memberships: [{
            status: "active",
            end_date: "2024-11-15"
          }]
        }
      ];

      const cliente = clientesMuestra.find(c => c.national_id === cedula);

      if (!cliente) {
        toast({
          title: "Cliente no encontrado",
          description: "No se encontró un cliente con esa cédula",
          variant: "destructive"
        });
        return;
      }

      const validMembresia = validarMembresia(cliente.memberships);
      if (!validMembresia.valid) {
        toast({
          title: "Membresía no válida",
          description: validMembresia.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Asistencia registrada",
        description: `Entrada registrada para ${cliente.first_name} ${cliente.last_name}`,
      });

      setCedula("");
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo registrar la asistencia",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  const validarMembresia = (memberships: any[]) => {
    if (!memberships || memberships.length === 0) return { valid: false, message: "Sin membresía activa" };
    
    const activeMembresia = memberships.find(m => m.status === 'active');
    if (!activeMembresia) return { valid: false, message: "Sin membresía activa" };
    
    const endDate = new Date(activeMembresia.end_date);
    const today = new Date();
    
    if (endDate < today) return { valid: false, message: "Membresía vencida" };
    
    return { valid: true, message: "Membresía válida" };
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
        <div className="max-w-md mx-auto">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-primary mb-2">Control de Asistencia</h1>
            <p className="text-muted-foreground">Registrar entrada por cédula</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Registrar Entrada
              </CardTitle>
              <CardDescription>Ingrese la cédula del cliente para registrar su entrada</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={registrarAsistencia} className="space-y-4">
                <div>
                  <Label htmlFor="cedula">Cédula</Label>
                  <Input
                    id="cedula"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="Ej: 1-2345-6789"
                    required
                  />
                </div>

                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? "Registrando..." : "Registrar Entrada"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Asistencia;