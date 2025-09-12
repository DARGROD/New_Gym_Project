import React, { useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { parseISO, differenceInCalendarDays } from "date-fns";

interface Client {
  id: string;
  national_id: string;
  first_name: string;
  last_name: string;
}

interface Membership {
  id: string;
  end_date: string;
  status: string;
  membership_plans: {
    name: string;
    duration_days: number;
  } | null;
}

interface UserMessage {
  type: "success" | "warning" | "error";
  title: string;
  description: string;
}

const Asistencia = () => {
  const [nationalId, setNationalId] = useState("");
  const [loading, setLoading] = useState(false);
  const [userMessage, setUserMessage] = useState<UserMessage | null>(null);
  const { toast } = useToast();

//aqui empiezan cambios

  const checkMembershipStatus = async (nationalId: string) => {
    setLoading(true);
    setUserMessage(null);

    try {
      // Obtener cliente
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .eq("national_id", nationalId)
        .single();

      if (clientError || !clientData) {
        setUserMessage({
          type: "error",
          title: "Cliente no encontrado",
          description: "No se encontró un cliente con la cédula proporcionada.",
        });
        setLoading(false);
        return;
      }

      // Obtener la membresía más reciente
      const { data: membershipData, error: membershipError } = await supabase
        .from("memberships")
        .select(`
        id,
        start_date,
        end_date,
        status,
        membership_plans (
          name,
          duration_days
        )
      `)
        .eq("member_id", clientData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (membershipError || !membershipData) {
        setUserMessage({
          type: "error",
          title: "Membresía no encontrada",
          description: "El cliente no tiene una membresía activa.",
        });
        setLoading(false);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const startDate = new Date(membershipData.start_date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(membershipData.end_date);
      endDate.setHours(0, 0, 0, 0);

      const planName = membershipData.membership_plans?.name.toLowerCase() || "";
      const isSession = planName.includes("sesion");

      let diffDays: number;
      let displayEndDate = endDate;

      if (isSession) {
        // Para sesiones, la membresía vence mañana después de start_date
        const sessionEnd = new Date(startDate);
        sessionEnd.setDate(sessionEnd.getDate() + 1);
        diffDays = differenceInCalendarDays(sessionEnd, today);
        displayEndDate = sessionEnd;
      } else {
        // Restamos 1 día para considerar que al llegar a la fecha real ya está vencida
        diffDays = differenceInCalendarDays(endDate, today) - 1;
      }

      const clientFullName = `${clientData.first_name} ${clientData.last_name}`;
      const formattedEndDate = displayEndDate.toLocaleDateString("es-CR");

      let message: UserMessage;
      let canRegister = false;

      if (diffDays < 0) {
        message = {
          type: "error",
          title: `¡Hola ${clientFullName}!`,
          description: `Tu membresía ha vencido (${formattedEndDate}). Por favor, renueva para poder acceder.`,
        };
      } else if (diffDays === 0) {
        message = {
          type: "warning",
          title: `¡Hola ${clientFullName}!`,
          description: `¡Atención! Tu membresía vence mañana (${formattedEndDate}).`,
        };
        canRegister = true;
      } else if (diffDays > 0 && diffDays <= 3) {
        message = {
          type: "warning",
          title: `¡Hola ${clientFullName}!`,
          description: `Tu membresía vence en ${diffDays} día(s) (${formattedEndDate}).`,
        };
        canRegister = true;
      } else {
        message = {
          type: "success",
          title: `¡Bienvenido ${clientFullName}!`,
          description: `Tu membresía está activa. Vence el ${formattedEndDate}.`,
        };
        canRegister = true;
      }

      setUserMessage(message);

      if (canRegister) {
        const { error: attendanceError } = await supabase
          .from("attendance")
          .insert({
            member_id: clientData.id,
            checked_in_at: new Date().toISOString(),
          });

        if (attendanceError) {
          toast({
            title: "Error al registrar asistencia",
            description: "Hubo un problema al guardar la asistencia.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Asistencia Registrada",
            description: `${clientData.first_name} ha registrado su asistencia.`,
          });
        }
      }
    } catch (error) {
      console.error("Error al verificar la membresía:", error);
      setUserMessage({
        type: "error",
        title: "Error del Sistema",
        description: "No se pudo verificar el estado de la membresía. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  };




// aqui terminan cambios
  const handleRegisterAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nationalId) {
      toast({
        title: "Error",
        description: "Por favor, ingrese la cédula del cliente.",
        variant: "destructive",
      });
      return;
    }
    checkMembershipStatus(nationalId);
  };

  return (
    <div className="relative min-h-screen">
      {/* Video de fondo */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover -z-10"
      >
        <source src="/Hero's Gym Main Video.mp4" type="video/mp4" />
        Tu navegador no soporta videos en HTML5.
      </video>

      {/* Contenido centrado */}
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="w-full max-w-md bg-white/70 shadow-lg backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Registro de Asistencia
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <form onSubmit={handleRegisterAttendance} className="w-full">
              <Label htmlFor="national_id" className="text-lg">
                Cédula del Cliente
              </Label>
              <Input
                id="national_id"
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="Ingresa la cédula"
                className="mt-2 text-center"
              />
              <Button
                type="submit"
                className="w-full mt-4 bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? "Verificando..." : "Registrar Asistencia"}
              </Button>
            </form>

            {userMessage && (
              <div
                className={`mt-4 p-4 rounded-md w-full text-center ${
                  userMessage.type === "success"
                    ? "bg-green-100 text-green-800"
                    : userMessage.type === "warning"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                <h3 className="font-bold">{userMessage.title}</h3>
                <p>{userMessage.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Asistencia;