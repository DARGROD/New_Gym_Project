import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import TopNavigation from "../components/TopNavigation";
import { differenceInCalendarDays } from "date-fns";

// ========================= Helpers de fecha (LOCAL, sin TZ) =========================

// "YYYY-MM-DD" -> Date local (00:00 en tu zona local)
const dateFromISODateOnlyLocal = (s?: string) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
};

// Date local -> "YYYY-MM-DD"
const fmtISODateOnlyLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Trunca a 00:00 local
const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Vigente si hoy <= end_date (inclusive)
const isValidByDate = (endDateStr?: string) => {
  const end = dateFromISODateOnlyLocal(endDateStr);
  if (!end) return false;
  const today = toDateOnly(new Date());
  return today.getTime() <= end.getTime();
};

// Vencida si hoy > end_date
const isExpiredByDate = (endDateStr?: string) => {
  const end = dateFromISODateOnlyLocal(endDateStr);
  if (!end) return false;
  const today = toDateOnly(new Date());
  return today.getTime() > end.getTime();
};

// Mostrar exactamente el string de DB
const printDBDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

// ========================= Helpers de plan =========================

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addMonthsSameDay = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

/**
 * Calcula end_date según NOMBRE del plan.
 * - Mensual/Familiar: +1 mes exacto (vence mismo día del mes siguiente, inclusive).
 * - Quincenal: +14 días (inclusive).
 * - Semanal: +7 días (inclusive).
 * - Sesión: mismo día (inclusive).
 * Fallback: duration_days si está definido, si no 30 días.
 */
const computeEndDateByPlanName = (start: Date, planName: string, fallbackDays?: number) => {
  const n = normalize(planName);
  if (n.includes("mensual") || n.includes("familiar")) return addMonthsSameDay(start, 1);
  if (n.includes("quincenal")) return addDays(start, 14);
  if (n.includes("semanal")) return addDays(start, 7);
  if (n.includes("sesion") || n.includes("sesión")) return new Date(start); // mismo día
  return fallbackDays ? addDays(start, fallbackDays) : addDays(start, 30);
};

// ========================= Badges =========================

const getBadgeVariant = (diffDays?: number) => {
  if (diffDays === undefined) return "default";
  if (diffDays <= 0) return diffDays === 0 ? "destructive" : "outline";
  if (diffDays === 1) return "destructive";
  if (diffDays <= 3) return "secondary";
  if (diffDays <= 7) return "default";
  return "secondary";
};
const getBadgeText = (diffDays?: number) => {
  if (diffDays === undefined) return "";
  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "Vence mañana";
  return `Vence en ${diffDays} días`;
};
const getExpiredBadgeText = (diffDays?: number) => {
  if (diffDays === undefined) return "Vencida";
  if (diffDays === -1) return "Venció ayer";
  if (diffDays === 0) return "Venció hoy";
  return `Venció hace ${Math.abs(diffDays)} días`;
};

// ========================= Componente =========================

const Vencimientos = () => {
  const [expiringSoon, setExpiringSoon] = useState<any[]>([]);
  const [expired, setExpired] = useState<any[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<any>(null);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [newPlan, setNewPlan] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("cash");
  const [pageSizeExpiring, setPageSizeExpiring] = useState("5");
  const [pageSizeExpired, setPageSizeExpired] = useState("5");
  const { toast } = useToast();

  // --------- Fetch helpers ---------

  const fetchMembershipPlans = async () => {
    const { data, error } = await supabase.from("membership_plans").select("*").eq("status", "active");
    if (!error) setMembershipPlans(data || []);
  };

  // Marca como expired por fecha (await para consistencia)
  const expireOutdatedMemberships = async (latestList: any[]) => {
    const needExpire = latestList
      .filter((m) => m && m.end_date && isExpiredByDate(m.end_date) && m.status !== "expired")
      .map((m) =>
        supabase.from("memberships").update({ status: "expired" }).eq("id", m.id)
      );

    if (needExpire.length === 0) return;
    try {
      await Promise.all(needExpire);
    } catch (e) {
      console.error("Error marcando expiradas:", e);
      toast({
        title: "Aviso",
        description: "Algunas membresías no pudieron marcarse como vencidas.",
        variant: "destructive",
      });
    }
  };

  const fetchExpiringMemberships = async () => {
    const { data: clients, error } = await supabase
      .from("clients")
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
      `)
      .order("created_at", { foreignTable: "memberships", ascending: false })
      .limit(1, { foreignTable: "memberships" });

    if (error) {
      console.error("Error fetching memberships:", error);
      toast({
        title: "Error al cargar membresías",
        description: "No se pudieron cargar los datos de la base de datos.",
        variant: "destructive",
      });
      return;
    }

    // Toma la última membresía por cliente y embebe el cliente
    const latestMemberships =
      clients?.flatMap((client: any) => {
        const latest = client.memberships?.[0];
        return latest ? [{ ...latest, client }] : [];
      }) ?? [];

    // Marca expiradas por fecha (await)
    await expireOutdatedMemberships(latestMemberships);

    // Recalcula clasificaciones en memoria (sin re-fetch)
    const today = toDateOnly(new Date());

    const expiring: any[] = [];
    const expiredList: any[] = [];
    let activeCount = 0;

    latestMemberships.forEach((membership) => {
      const endDate = dateFromISODateOnlyLocal(membership.end_date);
      const diffDays = endDate ? differenceInCalendarDays(endDate, today) : undefined;

      const stillValid = membership.end_date ? isValidByDate(membership.end_date) : false;
      const isExpired = membership.end_date ? isExpiredByDate(membership.end_date) : true;

      // Conteo activos: status 'active' y vigente por fecha
      if (stillValid || membership.status === "active") activeCount++;

      // Por vencer: 0..7 días (inclusive)
      if (!isExpired && diffDays !== undefined && diffDays >= 0 && diffDays <= 7) {
        expiring.push({ ...membership, diffDays });
        return;
      }

      // Vencidas
      if (isExpired) {
        // Si la DB aún dice 'active', reflejamos expired en UI tras el expireOutdatedMemberships
        const status = "expired";
        expiredList.push({ ...membership, diffDays: diffDays ?? -1, status });
      }
    });

    // Sort: próximas a vencer primero
    expiring.sort((a, b) => (a.diffDays ?? 0) - (b.diffDays ?? 0));
    // Sort: vencidas más recientes primero (diffDays más cercano a 0)
    expiredList.sort((a, b) => (b.diffDays ?? -999) - (a.diffDays ?? -999));

    setExpiringSoon(expiring);
    setExpired(expiredList);
    setTotalActive(activeCount);
  };

  useEffect(() => {
    fetchMembershipPlans();
    fetchExpiringMemberships();
  }, []);

  // --------- Renovación ---------

  const handleRenewMembership = (membership: any) => {
    setSelectedMembership(membership);
    setNewPlan(membership.plan_id);
    setNewPaymentMethod(membership.payments || "cash");
    setIsDialogOpen(true);
  };

  const handleConfirmRenewal = async () => {
    if (!selectedMembership || !newPlan || !newPaymentMethod) {
      toast({
        title: "Error",
        description: "Por favor complete todos los campos.",
        variant: "destructive",
      });
      return;
    }

    try {
      const plan = membershipPlans.find((p) => p.id === newPlan);
      if (!plan) throw new Error("Plan de membresía no encontrado.");

      // Fechas locales (por día)
      const startLocal = toDateOnly(new Date());
      const endLocal = computeEndDateByPlanName(startLocal, plan.name, plan.duration_days);

      const { error } = await supabase.from("memberships").insert({
        member_id: selectedMembership.client.id,
        plan_id: newPlan,
        start_date: fmtISODateOnlyLocal(startLocal),
        end_date: fmtISODateOnlyLocal(endLocal),
        status: "active",
        payments: newPaymentMethod,
      });

      if (error) throw error;

      toast({
        title: "Membresía Renovada",
        description: `La membresía para ${selectedMembership.client.first_name} ${selectedMembership.client.last_name} ha sido renovada exitosamente.`,
      });

      setIsDialogOpen(false);
      setSelectedMembership(null);
      await fetchExpiringMemberships();
    } catch (e: any) {
      toast({
        title: "Error al renovar",
        description: e?.message || "No se pudo renovar la membresía.",
        variant: "destructive",
      });
    }
  };

  // ========================= Render =========================

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
                {expiringSoon.filter((m) => (m.diffDays ?? 99) <= 1).length}
              </div>
              <p className="text-xs text-muted-foreground">Membresías a punto de vencer</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencen en 2-3 días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {expiringSoon.filter((m) => (m.diffDays ?? 0) > 1 && (m.diffDays ?? 0) <= 3).length}
              </div>
              <p className="text-xs text-muted-foreground">Membresías con pocos días restantes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expired.length}</div>
              <p className="text-xs text-muted-foreground">Membresías que ya expiraron</p>
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
                <CardDescription>{expiringSoon.length} membresías activas a punto de vencer.</CardDescription>
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
                    {expiringSoon
                      .slice(0, pageSizeExpiring === "all" ? expiringSoon.length : parseInt(pageSizeExpiring))
                      .map((membership) => (
                        <TableRow key={membership.id}>
                          <TableCell className="w-1/4">
                            {membership.client.first_name} {membership.client.last_name}
                          </TableCell>
                          <TableCell className="w-1/4">
                            {membership.membership_plans?.name || "N/A"}
                          </TableCell>
                          <TableCell className="w-1/4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center space-x-2">
                                <Badge variant={getBadgeVariant(membership.diffDays)}>
                                  {getBadgeText(membership.diffDays)}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Vence: {printDBDate(membership.end_date)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-1/4">
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white"
                              onClick={() => handleRenewMembership(membership)}
                            >
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
                <CardDescription>{expired.length} membresías que ya expiraron.</CardDescription>
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
                    {expired
                      .slice(0, pageSizeExpired === "all" ? expired.length : parseInt(pageSizeExpired))
                      .map((membership) => (
                        <TableRow key={membership.id}>
                          <TableCell className="w-1/4">
                            {membership.client.first_name} {membership.client.last_name}
                          </TableCell>
                          <TableCell className="w-1/4">
                            {membership.membership_plans?.name || "N/A"}
                          </TableCell>
                          <TableCell className="w-1/4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center space-x-2">
                                <Badge variant="destructive">
                                  {getExpiredBadgeText(membership.diffDays)}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Venció: {printDBDate(membership.end_date)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-1/4">
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-600 text-white"
                              onClick={() => handleRenewMembership(membership)}
                            >
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
                Selecciona el nuevo plan de membresía y el método de pago para{" "}
                {selectedMembership?.client.first_name} {selectedMembership?.client.last_name}.
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
                    {membershipPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ₡{Number(plan.price).toLocaleString("es-CR")}
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
              <Button onClick={() => setIsDialogOpen(false)} variant="outline">
                Cancelar
              </Button>
              <Button onClick={handleConfirmRenewal} className="bg-green-500 hover:bg-green-600">
                Confirmar Renovación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Vencimientos;