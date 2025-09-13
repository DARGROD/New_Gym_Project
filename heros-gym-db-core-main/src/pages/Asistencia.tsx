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

// Trunca Date a 00:00 local
const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Vigente si hoy <= end_date (inclusive)
const isValidByDate = (endDateStr?: string) => {
  const end = dateFromISODateOnlyLocal(endDateStr || "");
  if (!end) return false;
  const today = toDateOnly(new Date());
  return today.getTime() <= end.getTime();
};

// Vencida si hoy > end_date
const isExpiredByDate = (endDateStr?: string) => {
  const end = dateFromISODateOnlyLocal(endDateStr || "");
  if (!end) return true;
  const today = toDateOnly(new Date());
  return today.getTime() > end.getTime();
};

// Mostrar exactamente el string de DB
const printDBDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
};

// ========================= Tipos =========================

interface Client {
  id: string;
  national_id?: string;
  first_name: string;
  last_name: string;
}

interface Membership {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  membership_plans: {
    name: string;
    duration_days: number;
  } | null;
  created_at?: string;
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

  // ========================= Lógica de verificación =========================

  const checkMembershipStatus = async (nationalId: string) => {
    setLoading(true);
    setUserMessage(null);

    try {
      // 1) Obtener cliente
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

      // 2) Obtener la membresía más reciente (limit 1 por created_at desc)
      const { data: membershipData, error: membershipError } = await supabase
        .from("memberships")
        .select(`
          id,
          start_date,
          end_date,
          status,
          created_at,
          membership_plans ( name, duration_days )
        `)
        .eq("member_id", clientData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single<Membership>();

      if (membershipError || !membershipData) {
        setUserMessage({
          type: "error",
          title: "Membresía no encontrada",
          description: "El cliente no tiene una membresía registrada.",
        });
        setLoading(false);
        return;
      }

      // 3) Cálculos por día (local)
      const today = toDateOnly(new Date());
      const endDate = dateFromISODateOnlyLocal(membershipData.end_date);
      const diffDays = endDate ? differenceInCalendarDays(endDate, today) : undefined;

      const stillValid = isValidByDate(membershipData.end_date);
      const expiredByDate = isExpiredByDate(membershipData.end_date);

      // 4) Alinear estado de DB si está vencida por fecha
      if (expiredByDate && membershipData.status !== "expired") {
        try {
          const { error } = await supabase
            .from("memberships")
            .update({ status: "expired" })
            .eq("id", membershipData.id);
          if (error) {
            // no bloquea, solo log
            console.error("No se pudo actualizar a expired:", error);
          } else {
            // reflejar en memoria
            membershipData.status = "expired";
          }
        } catch (e) {
          console.error("Error marcando expired:", e);
        }
      }

      const clientFullName = `${clientData.first_name} ${clientData.last_name}`;
      const formattedEndDate = printDBDate(membershipData.end_date);

      // 5) Mensajes y permiso de check-in
      let message: UserMessage;
      let canRegister =
        stillValid || membershipData.status === "active"; // alineado con Clientes/Vencimientos

      if (diffDays === undefined) {
        message = {
          type: "error",
          title: `Hola ${clientFullName}`,
          description: `La membresía no tiene fecha de vencimiento válida.`,
        };
        canRegister = false;
      } else if (diffDays < 0) {
        message = {
          type: "error",
          title: `¡Hola ${clientFullName}!`,
          description: `Tu membresía ha vencido (${formattedEndDate}). Por favor, renueva para poder acceder.`,
        };
        canRegister = false;
      } else if (diffDays === 0) {
        message = {
          type: "warning",
          title: `¡Hola ${clientFullName}!`,
          description: `Tu membresía vence hoy (${formattedEndDate}).`,
        };
      } else if (diffDays === 1) {
        message = {
          type: "warning",
          title: `¡Hola ${clientFullName}!`,
          description: `Tu membresía vence mañana (${formattedEndDate}).`,
        };
      } else if (diffDays > 1 && diffDays <= 3) {
        message = {
          type: "warning",
          title: `¡Hola ${clientFullName}!`,
          description: `Tu membresía vence en ${diffDays} día(s) (${formattedEndDate}).`,
        };
      } else {
        message = {
          type: "success",
          title: `¡Bienvenido ${clientFullName}!`,
          description: `Tu membresía está activa. Vence el ${formattedEndDate}.`,
        };
      }

      setUserMessage(message);

      // 6) Registrar asistencia si corresponde
      if (canRegister) {
        const { error: attendanceError } = await supabase
          .from("attendance")
          .insert({
            member_id: clientData.id,
            // checked_in_at por defecto now() en DB si quieres; aquí enviamos explícito:
            checked_in_at: new Date().toISOString(),
            // source: 'kiosk' // si quieres marcar la fuente (la columna tiene default 'kiosk')
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

  // ========================= UI =========================

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
                autoFocus
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
                className={`mt-4 p-4 rounded-md w-full text-center ${userMessage.type === "success"
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
