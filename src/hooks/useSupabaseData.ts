import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import type { Address, Customer, ServiceProvider, Job, AllocationScores } from "@/data/mockData";

// ===== Type mappers =====

function dbToCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    serviceAddress: {
      street: row.address_street,
      city: row.address_city,
      province: row.address_region,
      postalCode: row.address_postal,
      country: row.address_country,
      lat: row.address_lat ?? undefined,
      lng: row.address_lng ?? undefined,
    },
    notes: row.notes,
    tags: row.tags ?? [],
    archived: row.status === "Archived",
    lastJobDate: undefined, // computed separately if needed
  };
}

function dbToSP(row: any): ServiceProvider {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
    status: row.status as "Active" | "Suspended",
    baseAddress: {
      street: row.base_address_street,
      city: row.base_address_city,
      province: row.base_address_region,
      postalCode: row.base_address_postal,
      country: row.base_address_country,
      lat: row.base_lat ?? undefined,
      lng: row.base_lng ?? undefined,
    },
    rating: Number(row.rating),
    reliabilityScore: row.reliability_score,
    completionRate: row.completion_rate,
    onTimeRate: row.on_time_rate,
    cancellationRate: row.cancellation_rate,
    acceptanceRate: row.acceptance_rate,
    avgResponseTime: row.avg_response_time,
    fairnessShare: row.fairness_share,
    fairnessStatus: row.fairness_status as any,
    complianceStatus: row.compliance_status as any,
    insuranceExpiry: row.insurance_expiry ?? "",
    certifications: row.certifications ?? [],
    serviceCategories: row.categories ?? [],
    maxJobsPerDay: row.max_jobs_per_day,
    travelRadius: row.service_radius_km,
    autoAccept: row.auto_accept,
    joinedDate: row.joined_date ?? "",
    totalJobsCompleted: row.total_jobs_completed,
    notes: row.notes,
    archived: row.status === "Archived",
  };
}

function dbToJob(row: any, customers: Customer[]): Job {
  const cust = customers.find((c) => c.id === row.customer_id);
  return {
    id: row.job_number || row.id,
    customerId: row.customer_id ?? "",
    customerName: cust?.name ?? "Unknown",
    address: `${row.job_address_street}, ${row.job_address_city}`,
    jobAddress: {
      street: row.job_address_street,
      city: row.job_address_city,
      province: row.job_address_region,
      postalCode: row.job_address_postal,
      country: row.job_address_country,
      lat: row.job_lat ?? undefined,
      lng: row.job_lng ?? undefined,
    },
    serviceCategory: row.service_category,
    estimatedDuration: row.estimated_duration,
    scheduledDate: row.scheduled_date ?? "",
    scheduledTime: row.scheduled_time,
    payout: Number(row.payout),
    status: row.status?.toLowerCase().replace(/\s/g, "-") as any,
    assignedSpId: row.assigned_sp_id ?? undefined,
    scores: row.scores as AllocationScores | undefined,
  };
}

// ===== Hooks =====

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToCustomer);
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
      if (error) throw error;
      return dbToCustomer(data);
    },
    enabled: !!id,
  });
}

export function useServiceProviders() {
  return useQuery({
    queryKey: ["service_providers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_providers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(dbToSP);
    },
  });
}

export function useServiceProvider(id: string | undefined) {
  return useQuery({
    queryKey: ["service_providers", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("service_providers").select("*").eq("id", id).single();
      if (error) throw error;
      return dbToSP(data);
    },
    enabled: !!id,
  });
}

export function useJobs() {
  const { data: customers } = useCustomers();
  return useQuery({
    queryKey: ["jobs", customers?.length],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => dbToJob(r, customers ?? []));
    },
    enabled: (customers?.length ?? 0) >= 0,
  });
}

// ===== Mutations =====

export function useCreateCustomer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: {
      name: string; email: string; phone: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; notes: string; tags: string[];
    }) => {
      const { error } = await supabase.from("customers").insert({
        name: form.name, email: form.email, phone: form.phone,
        address_street: form.street, address_city: form.city, address_region: form.province,
        address_postal: form.postalCode, address_country: form.country,
        address_lat: form.lat ? parseFloat(form.lat) : null,
        address_lng: form.lng ? parseFloat(form.lng) : null,
        notes: form.notes, tags: form.tags, status: "Active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer created", description: "Customer has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string; name: string; email: string; phone: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; notes: string; tags: string[];
    }) => {
      const { error } = await supabase.from("customers").update({
        name: form.name, email: form.email, phone: form.phone,
        address_street: form.street, address_city: form.city, address_region: form.province,
        address_postal: form.postalCode, address_country: form.country,
        address_lat: form.lat ? parseFloat(form.lat) : null,
        address_lng: form.lng ? parseFloat(form.lng) : null,
        notes: form.notes, tags: form.tags,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useArchiveCustomer() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ status: "Archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer archived" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useCreateSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: {
      name: string; email: string; phone: string; status: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; travelRadius: string; maxJobsPerDay: string;
      notes: string; categories: string[];
    }) => {
      const { error } = await supabase.from("service_providers").insert({
        name: form.name, email: form.email, phone: form.phone, status: form.status,
        base_address_street: form.street, base_address_city: form.city, base_address_region: form.province,
        base_address_postal: form.postalCode, base_address_country: form.country,
        base_lat: form.lat ? parseFloat(form.lat) : null,
        base_lng: form.lng ? parseFloat(form.lng) : null,
        service_radius_km: parseInt(form.travelRadius) || 30,
        max_jobs_per_day: parseInt(form.maxJobsPerDay) || 5,
        notes: form.notes, categories: form.categories,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider created", description: "Service provider has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string; name: string; email: string; phone: string; status: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; travelRadius: string; maxJobsPerDay: string;
      notes: string; categories: string[];
    }) => {
      const { error } = await supabase.from("service_providers").update({
        name: form.name, email: form.email, phone: form.phone, status: form.status,
        base_address_street: form.street, base_address_city: form.city, base_address_region: form.province,
        base_address_postal: form.postalCode, base_address_country: form.country,
        base_lat: form.lat ? parseFloat(form.lat) : null,
        base_lng: form.lng ? parseFloat(form.lng) : null,
        service_radius_km: parseInt(form.travelRadius) || 30,
        max_jobs_per_day: parseInt(form.maxJobsPerDay) || 5,
        notes: form.notes, categories: form.categories,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useToggleSPStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("service_providers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useArchiveSP() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_providers").update({ status: "Archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      toast({ title: "Provider archived" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Job Mutations =====

export function useCreateJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (form: {
      customerId: string; serviceCategory: string; payout: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; scheduledDate: string; scheduledTime: string; estimatedDuration: string;
    }) => {
      const { error } = await supabase.from("jobs").insert({
        customer_id: form.customerId || null,
        service_category: form.serviceCategory,
        payout: parseFloat(form.payout) || 0,
        job_address_street: form.street,
        job_address_city: form.city,
        job_address_region: form.province,
        job_address_postal: form.postalCode,
        job_address_country: form.country,
        job_lat: form.lat ? parseFloat(form.lat) : null,
        job_lng: form.lng ? parseFloat(form.lng) : null,
        scheduled_date: form.scheduledDate || null,
        scheduled_time: form.scheduledTime,
        estimated_duration: form.estimatedDuration,
        status: "Created",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Job created", description: "Job has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...form }: {
      id: string; customerId: string; serviceCategory: string; payout: string;
      street: string; city: string; province: string; postalCode: string; country: string;
      lat: string; lng: string; scheduledDate: string; scheduledTime: string; estimatedDuration: string;
    }) => {
      const { error } = await supabase.from("jobs").update({
        customer_id: form.customerId || null,
        service_category: form.serviceCategory,
        payout: parseFloat(form.payout) || 0,
        job_address_street: form.street,
        job_address_city: form.city,
        job_address_region: form.province,
        job_address_postal: form.postalCode,
        job_address_country: form.country,
        job_lat: form.lat ? parseFloat(form.lat) : null,
        job_lng: form.lng ? parseFloat(form.lng) : null,
        scheduled_date: form.scheduledDate || null,
        scheduled_time: form.scheduledTime,
        estimated_duration: form.estimatedDuration,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "Job updated", description: "Changes saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAssignJob() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ jobId, spId, assignedByUserId }: {
      jobId: string; spId: string; assignedByUserId: string | null;
    }) => {
      // Update job status + assigned SP
      const { error: jobErr } = await supabase.from("jobs").update({
        assigned_sp_id: spId,
        status: "Assigned",
      }).eq("id", jobId);
      if (jobErr) throw jobErr;

      // Insert assignment audit record
      const { error: assignErr } = await supabase.from("job_assignments").insert({
        job_id: jobId,
        sp_id: spId,
        assigned_by_user_id: assignedByUserId,
        assignment_type: "Manual",
      });
      if (assignErr) console.error("Assignment audit error:", assignErr);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: "SP assigned", description: "Job has been assigned." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// ===== Seeding =====

export function useSeedData() {
  const qc = useQueryClient();
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    (async () => {
      // Check if data already exists
      const { count: custCount } = await supabase.from("customers").select("*", { count: "exact", head: true });
      const { count: spCount } = await supabase.from("service_providers").select("*", { count: "exact", head: true });
      if ((custCount ?? 0) > 0 || (spCount ?? 0) > 0) return;

      // Seed customers
      const customerRows = [
        { name: "John Baker", phone: "(403) 555-1001", email: "john.baker@email.com", address_street: "123 Main St NW", address_city: "Calgary", address_region: "AB", address_postal: "T2M 1N5", address_country: "Canada", address_lat: 51.0677, address_lng: -114.084, notes: "Gate code: 4521. Two dogs in backyard.", tags: ["Recurring"] },
        { name: "Maria Santos", phone: "(403) 555-1002", email: "maria.santos@email.com", address_street: "456 Bow Trail SW", address_city: "Calgary", address_region: "AB", address_postal: "T3C 2G3", address_country: "Canada", address_lat: 51.043, address_lng: -114.11, notes: "Ring doorbell twice.", tags: ["VIP"] },
        { name: "Tom Henderson", phone: "(403) 555-1003", email: "tom.henderson@email.com", address_street: "789 Centre St N", address_city: "Calgary", address_region: "AB", address_postal: "T2E 2P9", address_country: "Canada", address_lat: 51.06, address_lng: -114.06, notes: "", tags: [] },
        { name: "Rachel Green", phone: "(403) 555-1004", email: "rachel.green@email.com", address_street: "321 17th Ave SW", address_city: "Calgary", address_region: "AB", address_postal: "T2S 0A5", address_country: "Canada", address_lat: 51.038, address_lng: -114.075, notes: "Park on street.", tags: ["Recurring"] },
        { name: "Alex Turner", phone: "(403) 555-1005", email: "alex.turner@email.com", address_street: "555 Macleod Trail SE", address_city: "Calgary", address_region: "AB", address_postal: "T2G 0A2", address_country: "Canada", address_lat: 51.04, address_lng: -114.062, notes: "", tags: [] },
        { name: "Diana Prince", phone: "(403) 555-1006", email: "diana.prince@email.com", address_street: "100 Crowfoot Way NW", address_city: "Calgary", address_region: "AB", address_postal: "T3G 4J2", address_country: "Canada", address_lat: 51.123, address_lng: -114.206, notes: "Access from back lane.", tags: ["VIP", "Recurring"] },
        { name: "Bruce Wayne", phone: "(403) 555-1007", email: "bruce.wayne@email.com", address_street: "900 Deerfoot Trail NE", address_city: "Calgary", address_region: "AB", address_postal: "T2A 5G6", address_country: "Canada", address_lat: 51.048, address_lng: -113.985, notes: "Large property, budget flexible.", tags: ["VIP"] },
        { name: "Clark Kent", phone: "(403) 555-1008", email: "clark.kent@email.com", address_street: "200 University Dr NW", address_city: "Calgary", address_region: "AB", address_postal: "T2N 1N4", address_country: "Canada", address_lat: 51.078, address_lng: -114.13, notes: "", tags: [] },
        { name: "Peter Parker", phone: "(403) 555-1009", email: "peter.parker@email.com", address_street: "750 9th Ave SE", address_city: "Calgary", address_region: "AB", address_postal: "T2G 0S3", address_country: "Canada", address_lat: 51.045, address_lng: -114.053, notes: "Buzzer #204.", tags: [] },
        { name: "Tony Stark", phone: "(403) 555-1010", email: "tony.stark@email.com", address_street: "500 4th St SW", address_city: "Calgary", address_region: "AB", address_postal: "T2P 2V6", address_country: "Canada", address_lat: 51.049, address_lng: -114.072, notes: "Underground parking access.", tags: ["VIP"] },
        { name: "Natasha Romanov", phone: "(403) 555-1011", email: "natasha.r@email.com", address_street: "310 Heritage Dr SE", address_city: "Calgary", address_region: "AB", address_postal: "T2H 1M6", address_country: "Canada", address_lat: 51.02, address_lng: -114.04, notes: "", tags: ["Recurring"] },
        { name: "Steve Rogers", phone: "(403) 555-1012", email: "steve.rogers@email.com", address_street: "888 Country Hills Blvd NE", address_city: "Calgary", address_region: "AB", address_postal: "T3K 5C3", address_country: "Canada", address_lat: 51.155, address_lng: -114.065, notes: "Three-storey home.", tags: [] },
        { name: "Wanda Maximoff", phone: "(403) 555-1013", email: "wanda.m@email.com", address_street: "425 Memorial Dr NE", address_city: "Calgary", address_region: "AB", address_postal: "T2E 4Y7", address_country: "Canada", address_lat: 51.052, address_lng: -114.045, notes: "", tags: [] },
        { name: "Sam Wilson", phone: "(403) 555-1014", email: "sam.wilson@email.com", address_street: "150 Shawnessy Blvd SW", address_city: "Calgary", address_region: "AB", address_postal: "T2Y 3S4", address_country: "Canada", address_lat: 50.908, address_lng: -114.068, notes: "Side gate unlocked.", tags: ["Recurring"] },
        { name: "Pepper Potts", phone: "(403) 555-1015", email: "pepper.potts@email.com", address_street: "290 52nd St SE", address_city: "Calgary", address_region: "AB", address_postal: "T2A 4R2", address_country: "Canada", address_lat: 51.039, address_lng: -113.97, notes: "", tags: [] },
        { name: "Happy Hogan", phone: "(403) 555-1016", email: "happy.hogan@email.com", address_street: "400 Beddington Blvd NE", address_city: "Calgary", address_region: "AB", address_postal: "T3K 2A8", address_country: "Canada", address_lat: 51.14, address_lng: -114.055, notes: "", tags: [] },
        { name: "Nick Fury", phone: "(403) 555-1017", email: "nick.fury@email.com", address_street: "50 Signal Hill Centre SW", address_city: "Calgary", address_region: "AB", address_postal: "T3H 3P8", address_country: "Canada", address_lat: 51.018, address_lng: -114.18, notes: "Use service entrance.", tags: ["VIP"] },
        { name: "Phil Coulson", phone: "(403) 555-1018", email: "phil.coulson@email.com", address_street: "725 Harvest Hills Dr NE", address_city: "Calgary", address_region: "AB", address_postal: "T3K 4W1", address_country: "Canada", address_lat: 51.165, address_lng: -114.048, notes: "", tags: [] },
        { name: "May Parker", phone: "(403) 555-1019", email: "may.parker@email.com", address_street: "180 Tuscany Blvd NW", address_city: "Calgary", address_region: "AB", address_postal: "T3L 2V4", address_country: "Canada", address_lat: 51.169, address_lng: -114.24, notes: "Older home, careful with siding.", tags: ["Recurring"] },
        { name: "Janet Van Dyne", phone: "(403) 555-1020", email: "janet.vd@email.com", address_street: "45 Main St", address_city: "Cochrane", address_region: "AB", address_postal: "T4C 1A5", address_country: "Canada", address_lat: 51.189, address_lng: -114.4663, notes: "Acreage property.", tags: ["VIP"] },
        { name: "Hank Pym", phone: "(403) 555-1021", email: "hank.pym@email.com", address_street: "120 East Lake Blvd", address_city: "Airdrie", address_region: "AB", address_postal: "T4A 2J4", address_country: "Canada", address_lat: 51.2917, address_lng: -114.0144, notes: "", tags: [] },
        { name: "Scott Lang", phone: "(403) 555-1022", email: "scott.lang@email.com", address_street: "88 Milligan Dr", address_city: "Okotoks", address_region: "AB", address_postal: "T1S 1V4", address_country: "Canada", address_lat: 50.7264, address_lng: -113.9756, notes: "Long driveway.", tags: [] },
        { name: "Hope Pym", phone: "(403) 555-1023", email: "hope.pym@email.com", address_street: "200 Chestermere Blvd", address_city: "Chestermere", address_region: "AB", address_postal: "T1X 1L5", address_country: "Canada", address_lat: 51.035, address_lng: -113.823, notes: "Lakeside property.", tags: ["VIP", "Recurring"] },
      ];

      const { data: insertedCustomers, error: custErr } = await supabase.from("customers").insert(customerRows).select("id, name");
      if (custErr) { console.error("Seed customers error:", custErr); return; }

      // Seed SPs
      const spRows = [
        { name: "Mike Thompson", email: "mike@example.com", phone: "(403) 555-0101", status: "Active", base_address_street: "50 Kensington Rd NW", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2N 3C8", base_address_country: "Canada", base_lat: 51.055, base_lng: -114.09, service_radius_km: 30, max_jobs_per_day: 5, categories: ["Window Cleaning", "Gutter Cleaning"], notes: "Prefers morning shifts.", compliance_status: "Valid", insurance_expiry: "2026-08-15", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.8, reliability_score: 92, completion_rate: 96, on_time_rate: 94, cancellation_rate: 2, acceptance_rate: 88, avg_response_time: "4 min", fairness_share: 12, fairness_status: "Within Target", auto_accept: true, joined_date: "2023-03-15", total_jobs_completed: 342 },
        { name: "Sarah Chen", email: "sarah@example.com", phone: "(403) 555-0102", status: "Active", base_address_street: "215 12th Ave SW", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2R 0G8", base_address_country: "Canada", base_lat: 51.041, base_lng: -114.078, service_radius_km: 40, max_jobs_per_day: 6, categories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-11-20", certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"], rating: 4.9, reliability_score: 97, completion_rate: 99, on_time_rate: 97, cancellation_rate: 1, acceptance_rate: 95, avg_response_time: "2 min", fairness_share: 15, fairness_status: "Above Target Share", auto_accept: true, joined_date: "2022-09-01", total_jobs_completed: 512 },
        { name: "James Wilson", email: "james@example.com", phone: "(403) 555-0103", status: "Active", base_address_street: "80 Main St", base_address_city: "Airdrie", base_address_region: "AB", base_address_postal: "T4B 2E3", base_address_country: "Canada", base_lat: 51.29, base_lng: -114.02, service_radius_km: 20, max_jobs_per_day: 4, categories: ["Window Cleaning"], notes: "Based in Airdrie, prefers north Calgary jobs.", compliance_status: "Expiring", insurance_expiry: "2026-03-10", certifications: ["Licensed Technician"], rating: 4.5, reliability_score: 85, completion_rate: 90, on_time_rate: 88, cancellation_rate: 5, acceptance_rate: 72, avg_response_time: "8 min", fairness_share: 8, fairness_status: "Below Target Share", auto_accept: false, joined_date: "2024-01-20", total_jobs_completed: 89 },
        { name: "Emily Rodriguez", email: "emily@example.com", phone: "(403) 555-0104", status: "Active", base_address_street: "340 Centre Ave", base_address_city: "Cochrane", base_address_region: "AB", base_address_postal: "T4C 1K3", base_address_country: "Canada", base_lat: 51.187, base_lng: -114.47, service_radius_km: 35, max_jobs_per_day: 5, categories: ["Pressure Washing", "Gutter Cleaning"], notes: "Based in Cochrane.", compliance_status: "Valid", insurance_expiry: "2026-06-30", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.7, reliability_score: 90, completion_rate: 94, on_time_rate: 92, cancellation_rate: 3, acceptance_rate: 85, avg_response_time: "5 min", fairness_share: 11, fairness_status: "Within Target", auto_accept: true, joined_date: "2023-07-10", total_jobs_completed: 267 },
        { name: "David Park", email: "david@example.com", phone: "(403) 555-0105", status: "Active", base_address_street: "55 2nd St W", base_address_city: "Okotoks", base_address_region: "AB", base_address_postal: "T1S 1A4", base_address_country: "Canada", base_lat: 50.725, base_lng: -113.98, service_radius_km: 25, max_jobs_per_day: 4, categories: ["Window Cleaning", "Pressure Washing"], notes: "Based in Okotoks — far from north Calgary.", compliance_status: "Valid", insurance_expiry: "2027-01-15", certifications: ["Licensed Technician"], rating: 4.6, reliability_score: 88, completion_rate: 92, on_time_rate: 90, cancellation_rate: 4, acceptance_rate: 80, avg_response_time: "6 min", fairness_share: 10, fairness_status: "Within Target", auto_accept: false, joined_date: "2023-11-05", total_jobs_completed: 178 },
        { name: "Lisa Martinez", email: "lisa@example.com", phone: "(403) 555-0106", status: "Suspended", base_address_street: "18 Elgin Meadows Way SE", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2Z 4E3", base_address_country: "Canada", base_lat: 50.935, base_lng: -114.05, service_radius_km: 15, max_jobs_per_day: 3, categories: ["Window Cleaning"], notes: "Insurance expired — suspended pending renewal.", compliance_status: "Suspended", insurance_expiry: "2025-12-01", certifications: ["Licensed Technician"], rating: 4.4, reliability_score: 82, completion_rate: 88, on_time_rate: 85, cancellation_rate: 6, acceptance_rate: 70, avg_response_time: "10 min", fairness_share: 7, fairness_status: "Below Target Share", auto_accept: false, joined_date: "2024-05-12", total_jobs_completed: 45 },
        { name: "Robert Kim", email: "robert@example.com", phone: "(403) 555-0107", status: "Active", base_address_street: "410 Country Hills Blvd NE", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T3K 4Y7", base_address_country: "Canada", base_lat: 51.152, base_lng: -114.06, service_radius_km: 45, max_jobs_per_day: 6, categories: ["Window Cleaning", "Gutter Cleaning", "Pressure Washing"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-09-20", certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"], rating: 4.8, reliability_score: 94, completion_rate: 97, on_time_rate: 95, cancellation_rate: 1, acceptance_rate: 92, avg_response_time: "3 min", fairness_share: 13, fairness_status: "Within Target", auto_accept: true, joined_date: "2022-06-18", total_jobs_completed: 623 },
        { name: "Anna Schmidt", email: "anna@example.com", phone: "(403) 555-0108", status: "Active", base_address_street: "92 Rainbow Falls Way", base_address_city: "Chestermere", base_address_region: "AB", base_address_postal: "T1X 0H3", base_address_country: "Canada", base_lat: 51.038, base_lng: -113.82, service_radius_km: 20, max_jobs_per_day: 3, categories: ["Pressure Washing"], notes: "Based in Chestermere.", compliance_status: "Expiring", insurance_expiry: "2026-03-25", certifications: ["Licensed Technician"], rating: 4.3, reliability_score: 80, completion_rate: 86, on_time_rate: 83, cancellation_rate: 7, acceptance_rate: 68, avg_response_time: "12 min", fairness_share: 6, fairness_status: "Below Target Share", auto_accept: false, joined_date: "2024-08-01", total_jobs_completed: 32 },
        { name: "Carlos Ruiz", email: "carlos@example.com", phone: "(403) 555-0109", status: "Active", base_address_street: "720 14th St NW", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2N 2A4", base_address_country: "Canada", base_lat: 51.061, base_lng: -114.095, service_radius_km: 30, max_jobs_per_day: 5, categories: ["Window Cleaning", "Gutter Cleaning"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-10-05", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.7, reliability_score: 91, completion_rate: 95, on_time_rate: 93, cancellation_rate: 2, acceptance_rate: 87, avg_response_time: "4 min", fairness_share: 11, fairness_status: "Within Target", auto_accept: true, joined_date: "2023-04-22", total_jobs_completed: 298 },
        { name: "Nina Patel", email: "nina@example.com", phone: "(403) 555-0110", status: "Active", base_address_street: "505 Canyon Meadows Dr SE", base_address_city: "Calgary", base_address_region: "AB", base_address_postal: "T2J 6G2", base_address_country: "Canada", base_lat: 50.962, base_lng: -114.065, service_radius_km: 35, max_jobs_per_day: 5, categories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"], notes: "", compliance_status: "Valid", insurance_expiry: "2026-07-18", certifications: ["Licensed Technician", "Safety Certified"], rating: 4.6, reliability_score: 89, completion_rate: 93, on_time_rate: 91, cancellation_rate: 3, acceptance_rate: 83, avg_response_time: "5 min", fairness_share: 9, fairness_status: "Within Target", auto_accept: false, joined_date: "2023-09-14", total_jobs_completed: 215 },
      ];

      const { data: insertedSPs, error: spErr } = await supabase.from("service_providers").insert(spRows).select("id, name");
      if (spErr) { console.error("Seed SPs error:", spErr); return; }

      // Build lookup maps for job seeding
      const custMap = new Map((insertedCustomers ?? []).map((c: any) => [c.name, c.id]));
      const spMap = new Map((insertedSPs ?? []).map((s: any) => [s.name, s.id]));

      const jobSeedData = [
        { job_number: "JOB-1001", custName: "John Baker", spName: "Mike Thompson", service_category: "Window Cleaning", estimated_duration: "2 hours", scheduled_date: "2026-02-23", scheduled_time: "09:00 AM", payout: 180, status: "Assigned", job_address_street: "123 Main St NW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2M 1N5", job_address_country: "Canada", job_lat: 51.0677, job_lng: -114.084, scores: { availabilityFit: 92, proximity: 88, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 5, finalScore: 91 } },
        { job_number: "JOB-1002", custName: "Maria Santos", spName: null, service_category: "Gutter Cleaning", estimated_duration: "3 hours", scheduled_date: "2026-02-23", scheduled_time: "01:00 PM", payout: 260, status: "Created", job_address_street: "456 Bow Trail SW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T3C 2G3", job_address_country: "Canada", job_lat: 51.043, job_lng: -114.11, scores: { availabilityFit: 78, proximity: 72, competency: 90, reliability: 88, rating: 94, fairnessAdjustment: 8, finalScore: 85 } },
        { job_number: "JOB-1003", custName: "Tom Henderson", spName: null, service_category: "Pressure Washing", estimated_duration: "4 hours", scheduled_date: "2026-02-24", scheduled_time: "10:00 AM", payout: 340, status: "Created", job_address_street: "789 Centre St N", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2E 2P9", job_address_country: "Canada", job_lat: 51.06, job_lng: -114.06, scores: { availabilityFit: 95, proximity: 95, competency: 80, reliability: 90, rating: 92, fairnessAdjustment: 3, finalScore: 92 } },
        { job_number: "JOB-1004", custName: "Rachel Green", spName: "Sarah Chen", service_category: "Window Cleaning", estimated_duration: "1.5 hours", scheduled_date: "2026-02-24", scheduled_time: "02:00 PM", payout: 140, status: "Assigned", job_address_street: "321 17th Ave SW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2S 0A5", job_address_country: "Canada", job_lat: 51.038, job_lng: -114.075, scores: { availabilityFit: 85, proximity: 65, competency: 95, reliability: 97, rating: 98, fairnessAdjustment: -5, finalScore: 89 } },
        { job_number: "JOB-1005", custName: "Alex Turner", spName: null, service_category: "Gutter Cleaning", estimated_duration: "2.5 hours", scheduled_date: "2026-02-25", scheduled_time: "09:30 AM", payout: 220, status: "Created", job_address_street: "555 Macleod Trail SE", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2G 0A2", job_address_country: "Canada", job_lat: 51.04, job_lng: -114.062, scores: { availabilityFit: 88, proximity: 80, competency: 88, reliability: 85, rating: 90, fairnessAdjustment: 10, finalScore: 88 } },
        { job_number: "JOB-1006", custName: "Diana Prince", spName: "Mike Thompson", service_category: "Window Cleaning", estimated_duration: "2 hours", scheduled_date: "2026-02-25", scheduled_time: "11:00 AM", payout: 175, status: "Assigned", job_address_street: "100 Crowfoot Way NW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T3G 4J2", job_address_country: "Canada", job_lat: 51.123, job_lng: -114.206, scores: { availabilityFit: 90, proximity: 90, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 4, finalScore: 90 } },
        { job_number: "JOB-1007", custName: "Bruce Wayne", spName: null, service_category: "Pressure Washing", estimated_duration: "5 hours", scheduled_date: "2026-02-26", scheduled_time: "08:00 AM", payout: 420, status: "Created", job_address_street: "900 Deerfoot Trail NE", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2A 5G6", job_address_country: "Canada", job_lat: 51.048, job_lng: -113.985, scores: { availabilityFit: 70, proximity: 55, competency: 92, reliability: 94, rating: 96, fairnessAdjustment: 6, finalScore: 82 } },
        { job_number: "JOB-1008", custName: "Clark Kent", spName: "Emily Rodriguez", service_category: "Window Cleaning", estimated_duration: "1 hour", scheduled_date: "2026-02-26", scheduled_time: "03:00 PM", payout: 95, status: "Completed", job_address_street: "200 University Dr NW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2N 1N4", job_address_country: "Canada", job_lat: 51.078, job_lng: -114.13, scores: { availabilityFit: 96, proximity: 96, competency: 82, reliability: 90, rating: 94, fairnessAdjustment: 2, finalScore: 93 } },
        { job_number: "JOB-1009", custName: "Peter Parker", spName: null, service_category: "Gutter Cleaning", estimated_duration: "2 hours", scheduled_date: "2026-02-27", scheduled_time: "10:00 AM", payout: 190, status: "Cancelled", job_address_street: "750 9th Ave SE", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2G 0S3", job_address_country: "Canada", job_lat: 51.045, job_lng: -114.053, scores: { availabilityFit: 60, proximity: 75, competency: 85, reliability: 80, rating: 88, fairnessAdjustment: 12, finalScore: 78 } },
        { job_number: "JOB-1010", custName: "Tony Stark", spName: null, service_category: "Pressure Washing", estimated_duration: "3 hours", scheduled_date: "2026-02-27", scheduled_time: "01:00 PM", payout: 290, status: "Created", job_address_street: "500 4th St SW", job_address_city: "Calgary", job_address_region: "AB", job_address_postal: "T2P 2V6", job_address_country: "Canada", job_lat: 51.049, job_lng: -114.072, scores: { availabilityFit: 82, proximity: 85, competency: 78, reliability: 88, rating: 92, fairnessAdjustment: 7, finalScore: 86 } },
      ];

      const jobRows = jobSeedData.map((j) => ({
        job_number: j.job_number,
        customer_id: custMap.get(j.custName) ?? null,
        assigned_sp_id: j.spName ? spMap.get(j.spName) ?? null : null,
        service_category: j.service_category,
        estimated_duration: j.estimated_duration,
        scheduled_date: j.scheduled_date,
        scheduled_time: j.scheduled_time,
        payout: j.payout,
        status: j.status,
        job_address_street: j.job_address_street,
        job_address_city: j.job_address_city,
        job_address_region: j.job_address_region,
        job_address_postal: j.job_address_postal,
        job_address_country: j.job_address_country,
        job_lat: j.job_lat,
        job_lng: j.job_lng,
        scores: j.scores,
      }));

      const { error: jobErr } = await supabase.from("jobs").insert(jobRows);
      if (jobErr) console.error("Seed jobs error:", jobErr);

      // Refresh queries
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["service_providers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      console.log("✅ Seed data inserted successfully");

      // Seed auth users via edge function
      try {
        const { data, error } = await supabase.functions.invoke("seed-users");
        if (error) console.error("Seed users error:", error);
        else console.log("✅ Auth users seeded:", data);
      } catch (e) {
        console.error("Seed users edge function error:", e);
      }
    })();
  }, [qc]);
}
