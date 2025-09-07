import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TopNavigation from "@/components/TopNavigation";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">Hero's Gym</h1>
          <p className="text-muted-foreground">¡Entrena como un héroe!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">156</div>
              <p className="text-xs text-muted-foreground">+12% desde el mes pasado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₡2,340,000</div>
              <p className="text-xs text-muted-foreground">+8% desde el mes pasado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos a Vencer</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">23</div>
              <p className="text-xs text-muted-foreground">En los próximos 7 días</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Asistencias Hoy</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">47</div>
              <p className="text-xs text-muted-foreground">+5 comparado con ayer</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/asistencia')}>
            <CardHeader>
              <CardTitle>Control de Asistencia</CardTitle>
              <CardDescription>Registrar entrada y salida por cédula</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acceder</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/clientes')}>
            <CardHeader>
              <CardTitle>Gestión de Clientes</CardTitle>
              <CardDescription>Administrar clientes y membresías</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acceder</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/membresias')}>
            <CardHeader>
              <CardTitle>Tipos de Membresía</CardTitle>
              <CardDescription>Configurar planes y precios</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acceder</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/reportes')}>
            <CardHeader>
              <CardTitle>Reportes</CardTitle>
              <CardDescription>Informes de ingresos y asistencias</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acceder</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/vencimientos')}>
            <CardHeader>
              <CardTitle>Próximos a Vencer</CardTitle>
              <CardDescription>Membresías que expiran pronto</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acceder</Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/pagos')}>
            <CardHeader>
              <CardTitle>Pagos</CardTitle>
              <CardDescription>Registrar y consultar pagos</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Acceder</Button>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;