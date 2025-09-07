import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, Phone, Mail } from "lucide-react";
import TopNavigation from "@/components/TopNavigation";

const Vencimientos = () => {
  // Datos de muestra de membresías próximas a vencer
  const proximosVencimientos = [
    {
      id: "1",
      cliente: {
        first_name: "Ana",
        last_name: "Martínez",
        national_id: "1-1234-5678",
        phone: "8888-1111",
        email: "ana@email.com"
      },
      membresia: {
        plan_name: "Mensual",
        end_date: "2024-09-02",
        status: "active"
      },
      diasRestantes: 3
    },
    {
      id: "2",
      cliente: {
        first_name: "Carlos",
        last_name: "Rodríguez",
        national_id: "2-2345-6789",
        phone: "8888-2222",
        email: "carlos@email.com"
      },
      membresia: {
        plan_name: "Familiar",
        end_date: "2024-09-05",
        status: "active"
      },
      diasRestantes: 6
    },
    {
      id: "3",
      cliente: {
        first_name: "María",
        last_name: "González",
        national_id: "3-3456-7890",
        phone: "8888-3333",
        email: "maria@email.com"
      },
      membresia: {
        plan_name: "Quincena",
        end_date: "2024-09-01",
        status: "active"
      },
      diasRestantes: 2
    },
    {
      id: "4",
      cliente: {
        first_name: "Luis",
        last_name: "Herrera",
        national_id: "4-4567-8901",
        phone: "8888-4444",
        email: "luis@email.com"
      },
      membresia: {
        plan_name: "Semana",
        end_date: "2024-08-31",
        status: "active"
      },
      diasRestantes: 1
    }
  ];

  const getUrgencyColor = (dias: number) => {
    if (dias <= 1) return "bg-red-100 text-red-800 border-red-200";
    if (dias <= 3) return "bg-orange-100 text-orange-800 border-orange-200";
    if (dias <= 7) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
  };

  const getUrgencyIcon = (dias: number) => {
    if (dias <= 3) return <AlertTriangle className="h-4 w-4" />;
    return <Calendar className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Próximos a Vencer</h1>
          <p className="text-muted-foreground">Membresías que expiran en los próximos días</p>
        </div>

        {/* Resumen de vencimientos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Vencen Hoy/Mañana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {proximosVencimientos.filter(m => m.diasRestantes <= 1).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">Vencen en 2-3 días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {proximosVencimientos.filter(m => m.diasRestantes >= 2 && m.diasRestantes <= 3).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600">Vencen en 4-7 días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {proximosVencimientos.filter(m => m.diasRestantes >= 4 && m.diasRestantes <= 7).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{proximosVencimientos.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de clientes próximos a vencer */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes con Membresías por Vencer</CardTitle>
            <CardDescription>Lista ordenada por urgencia de vencimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximosVencimientos
                .sort((a, b) => a.diasRestantes - b.diasRestantes)
                .map((item) => (
                <div key={item.id} className="border rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold">
                          {item.cliente.first_name} {item.cliente.last_name}
                        </h3>
                        <Badge className={`${getUrgencyColor(item.diasRestantes)} flex items-center gap-1`}>
                          {getUrgencyIcon(item.diasRestantes)}
                          {item.diasRestantes === 0 ? 'Vence hoy' : 
                           item.diasRestantes === 1 ? 'Vence mañana' : 
                           `${item.diasRestantes} días restantes`}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Cédula:</p>
                          <p className="font-medium">{item.cliente.national_id}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Teléfono:</p>
                          <p className="font-medium">{item.cliente.phone}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Membresía:</p>
                          <p className="font-medium">{item.membresia.plan_name}</p>
                        </div>
                         <div>
                           <p className="text-muted-foreground">Vence:</p>
                           <p className="font-medium">{new Date(item.membresia.end_date).toLocaleDateString()}</p>
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex gap-2 ml-4">
                       <Button size="sm" variant="outline" className="flex items-center gap-1">
                         <Phone className="h-4 w-4" />
                         Llamar
                       </Button>
                       <Button size="sm" variant="outline" className="flex items-center gap-1">
                         <Mail className="h-4 w-4" />
                         Email
                       </Button>
                       <Button size="sm" className="bg-green-600 hover:bg-green-700">
                         Renovar
                       </Button>
                     </div>
                   </div>
                 </div>
               ))}
             </div>

            {proximosVencimientos.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay vencimientos próximos</h3>
                <p className="text-muted-foreground">Todas las membresías están al día</p>
              </div>
            )}
           </CardContent>
         </Card>
       </div>
       </div>
     </div>
   );
};

export default Vencimientos;