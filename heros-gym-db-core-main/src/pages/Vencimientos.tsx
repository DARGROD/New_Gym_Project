import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import TopNavigation from "../components/TopNavigation";
import { format, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";

// Helper function to get badge variant based on days left
const getBadgeVariant = (diffDays) => {
  if (diffDays === undefined) return "default";

  if (diffDays <= 0) {
    if (diffDays === 0) return "destructive"; // Vence hoy
    return "outline"; // Venció hace más tiempo
  }
  if (diffDays === 1) return "destructive"; // Vence mañana
  if (diffDays <= 3) return "secondary";   // 2-3 días
  if (diffDays <= 7) return "default";     // 4-7 días

  return "secondary"; // fallback
};

// Helper function to get badge text
const getBadgeText = (diffDays) => {
  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "Vence mañana";
  return `Vence en ${diffDays} días`;
};

// Helper function to get expired badge text
const getExpiredBadgeText = (diffDays) => {
  if (diffDays === -1) return "Venció ayer";
  if (diffDays === 0) return "Venció hoy";
  return `Venció hace ${Math.abs(diffDays)} días`;
};


const Vencimientos = () => {
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [expired, setExpired] = useState([]);
  const [totalActive, setTotalActive] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [newPlan, setNewPlan] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("cash");
  const [pageSizeExpiring, setPageSizeExpiring] = useState("5");
  const [pageSizeExpired, setPageSizeExpired] = useState("5");
  const { toast } = useToast();

  const fetchMembershipPlans = async () => {
    const { data, error } = await supabase
      .from('membership_plans')
      .select('*');

    if (!error) {
      setMembershipPlans(data);
    }
  };

  const fetchExpiringMemberships = async () => {
    const { data: clients, error } = await supabase
      .from('clients')
      .select(`
        id,
        first_name,
        last_name,
        memberships (
          id,
          start_date,
          end_date,
          status,
          payments,
          created_at,
          plan_id,
          membership_plans (
            name,
            duration_days
          )
        )
      `);

    if (error) {
      console.error('Error fetching memberships:', error);
      toast({
        title: "Error al cargar membresías",
        description: "No se pudieron cargar los datos de la base de datos.",
        variant: "destructive"
      });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestMemberships = clients?.flatMap(client => {
      const sortedMemberships = client.memberships?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const latest = sortedMemberships?.[0] ? { ...sortedMemberships[0], client } : null;
      return latest ? [latest] : [];
    }) || [];

    const expiring = [];
    const expired = [];
    let activeCount = 0;

    latestMemberships.forEach(membership => {
      const endDate = new Date(membership.end_date);
      const diffDays = differenceInCalendarDays(endDate, today);
      
      const isSession = membership.membership_plans?.name.toLowerCase().includes('sesion');

      if (isSession) {
        // Lógica específica para membresías de sesión
        const startDate = new Date(membership.start_date);
        startDate.setHours(0,0,0,0);
        if (differenceInCalendarDays(today, startDate) >= 1) {
            expired.push({ ...membership, diffDays: differenceInCalendarDays(endDate, today) });
            if (membership.status !== 'expired') {
                supabase
                    .from('memberships')
                    .update({ status: 'expired' })
                    .eq('id', membership.id)
                    .then(({ error }) => {
                        if (error) console.error("Error updating membership status:", error);
                    });
            }
        } else if (differenceInCalendarDays(endDate, today) >= 0) {
            expiring.push({ ...membership, diffDays });
        }
      } else {
        // Lógica general para otras membresías
        if (diffDays < 0) {
          expired.push({ ...membership, diffDays });
          if (membership.status !== 'expired') {
            supabase
                .from('memberships')
                .update({ status: 'expired' })
                .eq('id', membership.id)
                .then(({ error }) => {
                    if (error) console.error("Error updating membership status:", error);
                });
          }
        } else if (diffDays >= 0 && diffDays <= 7) {
          expiring.push({ ...membership, diffDays });
        }
      }
      
      if (membership.status === 'active' && endDate >= today) {
        activeCount++;
      }
    });
    
    // Sort expiringSoon by diffDays (closest to expiring first)
    expiring.sort((a, b) => a.diffDays - b.diffDays);
    // Sort expired by diffDays (most recently expired first)
    expired.sort((a, b) => b.diffDays - a.diffDays);
    
    setExpiringSoon(expiring);
    setExpired(expired);
    setTotalActive(activeCount);
  };
  
  useEffect(() => {
    fetchMembershipPlans();
    fetchExpiringMemberships();
  }, []);

  const handleRenewMembership = (membership) => {
    setSelectedMembership(membership);
    setNewPlan(membership.plan_id);
    setNewPaymentMethod(membership.payments);
    setIsDialogOpen(true);
  };
  
  const handleConfirmRenewal = async () => {
    if (!selectedMembership || !newPlan || !newPaymentMethod) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Obtener la duración del plan seleccionado
      const selectedPlanData = membershipPlans.find(plan => plan.id === newPlan);
      if (!selectedPlanData) {
        throw new Error("Plan de membresía no encontrado.");
      }

      const today = new Date();
      const newEndDate = new Date(today);
      newEndDate.setDate(today.getDate() + selectedPlanData.duration_days);

      const { error } = await supabase
        .from('memberships')
        .insert({
          member_id: selectedMembership.client.id,
          plan_id: newPlan,
          start_date: today.toISOString(),
          end_date: newEndDate.toISOString(),
          status: 'active',
          payments: newPaymentMethod
        });

      if (error) throw error;
      
      toast({
        title: "Membresía Renovada",
        description: `La membresía para ${selectedMembership.client.first_name} ha sido renovada exitosamente.`,
        className: "bg-green-500 text-white",
        duration: 3000,
      });

      setIsDialogOpen(false);
      fetchExpiringMemberships();

    } catch (error: any) {
      toast({
        title: "Error al renovar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-primary">Vencimientos y Renovaciones</h1>

        {/* Tarjetas de Resumen */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membresías Activas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActive}</div>
              <p className="text-xs text-muted-foreground">Total de membresías activas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencen Hoy/Mañana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {expiringSoon.filter(m => m.diffDays <= 1).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Membresías a punto de vencer
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencen en 2-3 días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {expiringSoon.filter(m => m.diffDays > 1 && m.diffDays <= 3).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Membresías con pocos días restantes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expired.length}</div>
              <p className="text-xs text-muted-foreground">
                Membresías que ya expiraron
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tablas de Vencimientos */}
        <div className="grid gap-6">
          {/* Membresías por Vencer */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xl font-bold">Clientes con Membresías por Vencer</CardTitle>
                <CardDescription>
                  {expiringSoon.length} membresías activas a punto de vencer.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar</span>
                <Select onValueChange={setPageSizeExpiring} defaultValue={pageSizeExpiring}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/4">Cliente</TableHead>
                      <TableHead className="w-1/4">Membresía</TableHead>
                      <TableHead className="w-1/4">Vencimiento</TableHead>
                      <TableHead className="w-1/4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiringSoon.slice(0, pageSizeExpiring === 'all' ? expiringSoon.length : parseInt(pageSizeExpiring)).map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell className="w-1/4">
                          {membership.client.first_name} {membership.client.last_name}
                        </TableCell>
                        <TableCell className="w-1/4">
                          {membership.membership_plans?.name || 'N/A'}
                        </TableCell>
                        <TableCell className="w-1/4">
                          <div className="flex items-center space-x-2">
                            <Badge variant={getBadgeVariant(membership.diffDays)}>
                              {getBadgeText(membership.diffDays)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="w-1/4">
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleRenewMembership(membership)}>
                            Renovar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Membresías Vencidas */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-xl font-bold">Clientes con Membresías Vencidas</CardTitle>
                <CardDescription>
                  {expired.length} membresías que ya expiraron.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Mostrar</span>
                <Select onValueChange={setPageSizeExpired} defaultValue={pageSizeExpired}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/4">Cliente</TableHead>
                      <TableHead className="w-1/4">Membresía</TableHead>
                      <TableHead className="w-1/4">Vencimiento</TableHead>
                      <TableHead className="w-1/4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expired.slice(0, pageSizeExpired === 'all' ? expired.length : parseInt(pageSizeExpired)).map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell className="w-1/4">
                          {membership.client.first_name} {membership.client.last_name}
                        </TableCell>
                        <TableCell className="w-1/4">
                          {membership.membership_plans?.name || 'N/A'}
                        </TableCell>
                        <TableCell className="w-1/4">
                          <div className="flex items-center space-x-2">
                            <Badge variant="destructive">
                              {getExpiredBadgeText(membership.diffDays)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="w-1/4">
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => handleRenewMembership(membership)}>
                            Renovar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        
        {/* Diálogo de Renovación */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renovar Membresía</DialogTitle>
              <DialogDescription>
                Selecciona el nuevo plan de membresía y el método de pago para {selectedMembership?.client.first_name} {selectedMembership?.client.last_name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-plan" className="text-right">
                  Plan
                </Label>
                <Select value={newPlan} onValueChange={setNewPlan}>
                  <SelectTrigger id="new-plan" className="col-span-3">
                    <SelectValue placeholder="Seleccionar plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {membershipPlans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ₡{plan.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-payment" className="text-right">
                  Método de Pago
                </Label>
                <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                  <SelectTrigger id="new-payment" className="col-span-3">
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="sinpe">SINPE Móvil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsDialogOpen(false)} variant="outline">Cancelar</Button>
              <Button onClick={handleConfirmRenewal} className="bg-green-500 hover:bg-green-600">Confirmar Renovación</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default Vencimientos;
