import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TopNavigation from "@/components/TopNavigation";

const Membresias = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    duration_days: "",
    description: "",
    benefits: ""
  });

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      duration_days: "",
      description: "",
      benefits: ""
    });
    setSelectedPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (selectedPlan) {
        toast({
          title: "Membresía actualizada",
          description: "El plan de membresía ha sido actualizado exitosamente"
        });
      } else {
        toast({
          title: "Membresía creada",
          description: "El nuevo plan de membresía ha sido creado exitosamente"
        });
      }
      
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo procesar la solicitud",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (plan: any) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      price: plan.price.toString(),
      duration_days: plan.duration_days.toString(),
      description: plan.description || "",
      benefits: plan.benefits ? plan.benefits.join(", ") : ""
    });
    setIsDialogOpen(true);
  };

  // Datos de muestra basados en los requerimientos
  const planesMuestra = [
    {
      id: "1",
      code: "MENSUAL",
      name: "Mensual",
      price: 20000,
      duration_days: 30,
      description: "Membresía mensual con acceso completo",
      benefits: ["Acceso completo al gimnasio", "Clases grupales", "Asesoría nutricional"],
      status: "active"
    },
    {
      id: "2",
      code: "FAMILIAR",
      name: "Familiar",
      price: 19000,
      duration_days: 30,
      description: "Membresía familiar para hasta 4 personas",
      benefits: ["Acceso para 4 personas", "Clases grupales", "Descuento en nutrición"],
      status: "active"
    },
    {
      id: "3",
      code: "QUINCENA",
      name: "Quincena",
      price: 14000,
      duration_days: 15,
      description: "Membresía quincenal",
      benefits: ["Acceso por 15 días", "Clases grupales básicas"],
      status: "active"
    },
    {
      id: "4",
      code: "SEMANA",
      name: "Semana",
      price: 8000,
      duration_days: 7,
      description: "Membresía semanal",
      benefits: ["Acceso por 7 días", "Horarios limitados"],
      status: "active"
    },
    {
      id: "5",
      code: "SESION",
      name: "Sesión",
      price: 1500,
      duration_days: 1,
      description: "Pago por sesión individual",
      benefits: ["Acceso por un día"],
      status: "active"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">Gestión de Tipos de Membresía</h1>
            <p className="text-muted-foreground">Configurar planes y precios de membresías</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Guardar Membresía
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{selectedPlan ? 'Editar Membresía' : 'Guardar Membresía'}</DialogTitle>
                <DialogDescription>
                  {selectedPlan ? 'Actualizar los datos del plan' : 'Complete la información del nuevo plan'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nombre de la Membresía</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej: Mensual, Familiar"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">Precio (₡)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="duration_days">Duración (días)</Label>
                  <Input
                    id="duration_days"
                    type="number"
                    value={formData.duration_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_days: e.target.value }))}
                    placeholder="30"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descripción del plan"
                  />
                </div>

                <div>
                  <Label htmlFor="benefits">Beneficios (separados por comas)</Label>
                  <Input
                    id="benefits"
                    value={formData.benefits}
                    onChange={(e) => setFormData(prev => ({ ...prev, benefits: e.target.value }))}
                    placeholder="Acceso completo, Clases grupales, etc."
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {selectedPlan ? 'Actualizar Membresía' : 'Guardar Membresía'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tipos de Membresía Disponibles</CardTitle>
            <CardDescription>Lista de planes de membresía configurados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">NOMBRE</th>
                    <th className="text-left p-4 font-semibold">PRECIO</th>
                    <th className="text-left p-4 font-semibold">DURACIÓN</th>
                    <th className="text-center p-4 font-semibold">ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {planesMuestra.map((plan) => (
                    <tr key={plan.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold">₡{plan.price.toLocaleString()}</span>
                      </td>
                      <td className="p-4">
                        <span>{plan.duration_days} días</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => openEditDialog(plan)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Membresias;