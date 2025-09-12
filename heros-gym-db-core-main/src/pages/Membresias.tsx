import React, { useState, useEffect } from "react";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import TopNavigation from "../components/TopNavigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";

interface MembershipPlan {
  id: string;
  code: string;
  name: string;
  duration_days: number;
  price: number;
  status: string;
  created_at: string;
}

interface FormData {
  id: string | null;
  name: string;
  code: string;
  duration_days: number;
  price: number;
  status: string;
}

const Membresias = () => {
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    id: null,
    name: "",
    code: "",
    duration_days: 0,
    price: 0,
    status: "active",
  });
  const { toast } = useToast();

  const fetchMembershipPlans = async () => {
    const { data, error } = await supabase
      .from("membership_plans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los planes de membresía.",
        variant: "destructive",
      });
      return;
    }

    setMembershipPlans(data || []);
  };

  useEffect(() => {
    fetchMembershipPlans();
  }, []);

  const resetForm = () => {
    setFormData({
      id: null,
      name: "",
      code: "",
      duration_days: 0,
      price: 0,
      status: "active",
    });
  };

  const handleOpenDialog = (plan: MembershipPlan | null = null) => {
    if (plan) {
      setFormData({
        id: plan.id,
        name: plan.name,
        code: plan.code,
        duration_days: plan.duration_days,
        price: plan.price,
        status: plan.status,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.duration_days || !formData.price || !formData.code) {
      toast({
        title: "Error",
        description: "Por favor, complete todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (formData.id) {
        // Actualizar
        const { error } = await supabase
          .from("membership_plans")
          .update({
            name: formData.name,
            code: formData.code,
            duration_days: formData.duration_days,
            price: formData.price,
            status: formData.status,
          })
          .eq("id", formData.id);

        if (error) throw error;
        toast({ title: "Plan actualizado", description: "El plan de membresía se ha actualizado exitosamente." });
      } else {
        // Agregar
        const { error } = await supabase
          .from("membership_plans")
          .insert({
            name: formData.name,
            code: formData.code,
            duration_days: formData.duration_days,
            price: formData.price,
            status: formData.status,
          });

        if (error) throw error;
        toast({ title: "Plan agregado", description: "El nuevo plan de membresía se ha agregado exitosamente." });
      }

      fetchMembershipPlans();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (planId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este plan de membresía?")) {
      try {
        const { error } = await supabase.from("membership_plans").delete().eq("id", planId);

        if (error) throw error;
        toast({ title: "Plan eliminado", description: "El plan de membresía ha sido eliminado exitosamente." });
        fetchMembershipPlans();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <CardHeader className="p-0">
            <CardTitle className="text-3xl font-bold">Gestión de Membresías</CardTitle>
            <CardDescription>Crea, edita y administra los planes de membresía</CardDescription>
          </CardHeader>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Nuevo Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{formData.id ? "Editar Plan" : "Agregar Nuevo Plan"}</DialogTitle>
                <DialogDescription>
                  {formData.id ? "Actualizar la información del plan de membresía." : "Cree un nuevo plan de membresía."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre del Plan</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="code">Código del Plan</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="duration_days">Duración (en días)</Label>
                  <Input
                    id="duration_days"
                    type="number"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="price">Precio (₡)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit">{formData.id ? "Actualizar Plan" : "Agregar Plan"}</Button>
                  <Button type="button" onClick={() => setIsDialogOpen(false)} variant="outline">
                    Cancelar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-250px)]">
              <Table>
                <TableHeader className="sticky top-0 bg-white shadow-sm">
                  <TableRow>
                    <TableHead className="w-1/4">Nombre del Plan</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membershipPlans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No hay planes de membresía registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    membershipPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.code}</TableCell>
                        <TableCell>{plan.duration_days} días</TableCell>
                        <TableCell className="text-right">₡{plan.price.toLocaleString('es-CR')}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getStatusBadgeVariant(plan.status)}>
                            {plan.status === "active" ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleOpenDialog(plan)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(plan.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Membresias;
