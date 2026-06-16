import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types";
import { PageHeader, EmptyState } from "@/components/ui";
import { ageFromBirth, frDate } from "@/lib/format";
import PatientFormDialog from "./PatientFormDialog";

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("*")
    .order("last_name", { ascending: true });

  const patients = (data ?? []) as Patient[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader title="Patients" subtitle={`${patients.length} patient${patients.length > 1 ? "s" : ""}`}>
        <PatientFormDialog />
      </PageHeader>

      {patients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Aucun patient"
            description="Ajoutez vos patients pour les retrouver dans la comptabilité et créer leurs bilans."
            action={<PatientFormDialog />}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {patients.map((p) => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="group bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-brand-200 hover:shadow transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold uppercase">
                    {(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {p.birth_date
                        ? `${frDate(p.birth_date)} · ${ageFromBirth(p.birth_date)}`
                        : "Date de naissance non renseignée"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-brand-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
