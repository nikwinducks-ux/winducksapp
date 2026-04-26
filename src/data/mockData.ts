// ===== SHARED TYPES =====
export interface Address {
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat?: number;
  lng?: number;
}

// ===== CUSTOMERS =====
export interface CustomerProperty {
  id: string;
  customerId: string;
  label: string;
  isPrimary: boolean;
  address: Address;
  notes: string;
  displayOrder: number;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  displayOrder: number;
}

export interface Customer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  displayAs?: "person" | "company";
  phone: string;
  email: string;
  /** Convenience: pointer to the primary property's address (kept in sync via DB trigger) */
  serviceAddress: Address;
  properties?: CustomerProperty[];
  contacts?: CustomerContact[];
  notes: string;
  tags: string[];
  lastJobDate?: string;
  archived?: boolean;
}

// ===== SERVICE PROVIDERS =====
export interface ServiceProvider {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: "Active" | "Suspended" | "Archived";
  baseAddress: Address;
  rating: number;
  reliabilityScore: number;
  completionRate: number;
  onTimeRate: number;
  cancellationRate: number;
  acceptanceRate: number;
  avgResponseTime: string;
  fairnessShare: number;
  fairnessStatus: "Within Target" | "Above Target Share" | "Below Target Share";
  complianceStatus: "Valid" | "Expiring" | "Suspended";
  insuranceExpiry: string;
  certifications: string[];
  serviceCategories: string[];
  maxJobsPerDay: number;
  travelRadius: number;
  autoAccept: boolean;
  joinedDate: string;
  totalJobsCompleted: number;
  notes?: string;
  archived?: boolean;
  /** Admin-picked palette key (e.g. "blue", "violet"); null = auto-hash. */
  calendarColor?: string | null;
  /** Per-SP override for platform fee % on payouts. null = use global default. */
  payoutFeePercent?: number | null;
}

// ===== JOBS =====
export interface JobService {
  id: string;
  job_id: string;
  service_category: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  notes: string;
}

export interface Job {
  id: string;
  dbId: string;
  customerId: string;
  customerName: string;
  address: string;
  jobAddress: Address;
  serviceCategory: string;
  estimatedDuration: string;
  scheduledDate: string;
  scheduledTime: string;
  payout: number;
  status: "Created" | "Offered" | "Assigned" | "Accepted" | "InProgress" | "Completed" | "Cancelled" | "Expired" | "Archived";
  assignedSpId?: string;
  distance?: number;
  scores?: AllocationScores;
  notes?: string;
  urgency?: string;
  isBroadcast?: boolean;
  broadcastRadiusKm?: number;
  broadcastNote?: string;
  services?: JobService[];
  completedAt?: string;
  crew?: { spId: string; isLead: boolean }[];
  payoutShare?: number;
}

export interface AllocationScores {
  availabilityFit: number;
  proximity: number;
  competency: number;
  reliability: number;
  rating: number;
  fairnessAdjustment: number;
  finalScore: number;
}

export const customers: Customer[] = [
  {
    id: "cust-001", name: "John Baker", phone: "(403) 555-1001", email: "john.baker@email.com",
    serviceAddress: { street: "123 Main St NW", city: "Calgary", province: "AB", postalCode: "T2M 1N5", country: "Canada", lat: 51.0677, lng: -114.0840 },
    notes: "Gate code: 4521. Two dogs in backyard.", tags: ["Recurring"], lastJobDate: "2026-02-23",
  },
  {
    id: "cust-002", name: "Maria Santos", phone: "(403) 555-1002", email: "maria.santos@email.com",
    serviceAddress: { street: "456 Bow Trail SW", city: "Calgary", province: "AB", postalCode: "T3C 2G3", country: "Canada", lat: 51.0430, lng: -114.1100 },
    notes: "Ring doorbell twice.", tags: ["VIP"], lastJobDate: "2026-02-23",
  },
  {
    id: "cust-003", name: "Tom Henderson", phone: "(403) 555-1003", email: "tom.henderson@email.com",
    serviceAddress: { street: "789 Centre St N", city: "Calgary", province: "AB", postalCode: "T2E 2P9", country: "Canada", lat: 51.0600, lng: -114.0600 },
    notes: "", tags: [], lastJobDate: "2026-02-24",
  },
  {
    id: "cust-004", name: "Rachel Green", phone: "(403) 555-1004", email: "rachel.green@email.com",
    serviceAddress: { street: "321 17th Ave SW", city: "Calgary", province: "AB", postalCode: "T2S 0A5", country: "Canada", lat: 51.0380, lng: -114.0750 },
    notes: "Park on street.", tags: ["Recurring"], lastJobDate: "2026-02-24",
  },
  {
    id: "cust-005", name: "Alex Turner", phone: "(403) 555-1005", email: "alex.turner@email.com",
    serviceAddress: { street: "555 Macleod Trail SE", city: "Calgary", province: "AB", postalCode: "T2G 0A2", country: "Canada", lat: 51.0400, lng: -114.0620 },
    notes: "", tags: [], lastJobDate: "2026-02-25",
  },
  {
    id: "cust-006", name: "Diana Prince", phone: "(403) 555-1006", email: "diana.prince@email.com",
    serviceAddress: { street: "100 Crowfoot Way NW", city: "Calgary", province: "AB", postalCode: "T3G 4J2", country: "Canada", lat: 51.1230, lng: -114.2060 },
    notes: "Access from back lane.", tags: ["VIP", "Recurring"], lastJobDate: "2026-02-25",
  },
  {
    id: "cust-007", name: "Bruce Wayne", phone: "(403) 555-1007", email: "bruce.wayne@email.com",
    serviceAddress: { street: "900 Deerfoot Trail NE", city: "Calgary", province: "AB", postalCode: "T2A 5G6", country: "Canada", lat: 51.0480, lng: -113.9850 },
    notes: "Large property, budget flexible.", tags: ["VIP"], lastJobDate: "2026-02-26",
  },
  {
    id: "cust-008", name: "Clark Kent", phone: "(403) 555-1008", email: "clark.kent@email.com",
    serviceAddress: { street: "200 University Dr NW", city: "Calgary", province: "AB", postalCode: "T2N 1N4", country: "Canada", lat: 51.0780, lng: -114.1300 },
    notes: "", tags: [], lastJobDate: "2026-02-26",
  },
  {
    id: "cust-009", name: "Peter Parker", phone: "(403) 555-1009", email: "peter.parker@email.com",
    serviceAddress: { street: "750 9th Ave SE", city: "Calgary", province: "AB", postalCode: "T2G 0S3", country: "Canada", lat: 51.0450, lng: -114.0530 },
    notes: "Buzzer #204.", tags: [], lastJobDate: "2026-02-27",
  },
  {
    id: "cust-010", name: "Tony Stark", phone: "(403) 555-1010", email: "tony.stark@email.com",
    serviceAddress: { street: "500 4th St SW", city: "Calgary", province: "AB", postalCode: "T2P 2V6", country: "Canada", lat: 51.0490, lng: -114.0720 },
    notes: "Underground parking access.", tags: ["VIP"], lastJobDate: "2026-02-27",
  },
  {
    id: "cust-011", name: "Natasha Romanov", phone: "(403) 555-1011", email: "natasha.r@email.com",
    serviceAddress: { street: "310 Heritage Dr SE", city: "Calgary", province: "AB", postalCode: "T2H 1M6", country: "Canada", lat: 51.0200, lng: -114.0400 },
    notes: "", tags: ["Recurring"], lastJobDate: "2026-02-28",
  },
  {
    id: "cust-012", name: "Steve Rogers", phone: "(403) 555-1012", email: "steve.rogers@email.com",
    serviceAddress: { street: "888 Country Hills Blvd NE", city: "Calgary", province: "AB", postalCode: "T3K 5C3", country: "Canada", lat: 51.1550, lng: -114.0650 },
    notes: "Three-storey home.", tags: [], lastJobDate: "2026-02-28",
  },
  {
    id: "cust-013", name: "Wanda Maximoff", phone: "(403) 555-1013", email: "wanda.m@email.com",
    serviceAddress: { street: "425 Memorial Dr NE", city: "Calgary", province: "AB", postalCode: "T2E 4Y7", country: "Canada", lat: 51.0520, lng: -114.0450 },
    notes: "", tags: [], lastJobDate: "2026-03-01",
  },
  {
    id: "cust-014", name: "Sam Wilson", phone: "(403) 555-1014", email: "sam.wilson@email.com",
    serviceAddress: { street: "150 Shawnessy Blvd SW", city: "Calgary", province: "AB", postalCode: "T2Y 3S4", country: "Canada", lat: 50.9080, lng: -114.0680 },
    notes: "Side gate unlocked.", tags: ["Recurring"], lastJobDate: "2026-03-02",
  },
  {
    id: "cust-015", name: "Pepper Potts", phone: "(403) 555-1015", email: "pepper.potts@email.com",
    serviceAddress: { street: "290 52nd St SE", city: "Calgary", province: "AB", postalCode: "T2A 4R2", country: "Canada", lat: 51.0390, lng: -113.9700 },
    notes: "", tags: [], lastJobDate: "2026-03-02",
  },
  {
    id: "cust-016", name: "Happy Hogan", phone: "(403) 555-1016", email: "happy.hogan@email.com",
    serviceAddress: { street: "400 Beddington Blvd NE", city: "Calgary", province: "AB", postalCode: "T3K 2A8", country: "Canada", lat: 51.1400, lng: -114.0550 },
    notes: "", tags: [], lastJobDate: "2026-03-03",
  },
  {
    id: "cust-017", name: "Nick Fury", phone: "(403) 555-1017", email: "nick.fury@email.com",
    serviceAddress: { street: "50 Signal Hill Centre SW", city: "Calgary", province: "AB", postalCode: "T3H 3P8", country: "Canada", lat: 51.0180, lng: -114.1800 },
    notes: "Use service entrance.", tags: ["VIP"], lastJobDate: "2026-03-03",
  },
  {
    id: "cust-018", name: "Phil Coulson", phone: "(403) 555-1018", email: "phil.coulson@email.com",
    serviceAddress: { street: "725 Harvest Hills Dr NE", city: "Calgary", province: "AB", postalCode: "T3K 4W1", country: "Canada", lat: 51.1650, lng: -114.0480 },
    notes: "", tags: [], lastJobDate: "2026-03-04",
  },
  {
    id: "cust-019", name: "May Parker", phone: "(403) 555-1019", email: "may.parker@email.com",
    serviceAddress: { street: "180 Tuscany Blvd NW", city: "Calgary", province: "AB", postalCode: "T3L 2V4", country: "Canada", lat: 51.1690, lng: -114.2400 },
    notes: "Older home, careful with siding.", tags: ["Recurring"], lastJobDate: "2026-03-04",
  },
  {
    id: "cust-020", name: "Janet Van Dyne", phone: "(403) 555-1020", email: "janet.vd@email.com",
    serviceAddress: { street: "45 Main St", city: "Cochrane", province: "AB", postalCode: "T4C 1A5", country: "Canada", lat: 51.1890, lng: -114.4663 },
    notes: "Acreage property.", tags: ["VIP"], lastJobDate: "2026-03-05",
  },
  {
    id: "cust-021", name: "Hank Pym", phone: "(403) 555-1021", email: "hank.pym@email.com",
    serviceAddress: { street: "120 East Lake Blvd", city: "Airdrie", province: "AB", postalCode: "T4A 2J4", country: "Canada", lat: 51.2917, lng: -114.0144 },
    notes: "", tags: [], lastJobDate: "2026-03-06",
  },
  {
    id: "cust-022", name: "Scott Lang", phone: "(403) 555-1022", email: "scott.lang@email.com",
    serviceAddress: { street: "88 Milligan Dr", city: "Okotoks", province: "AB", postalCode: "T1S 1V4", country: "Canada", lat: 50.7264, lng: -113.9756 },
    notes: "Long driveway.", tags: [], lastJobDate: "2026-03-07",
  },
  {
    id: "cust-023", name: "Hope Pym", phone: "(403) 555-1023", email: "hope.pym@email.com",
    serviceAddress: { street: "200 Chestermere Blvd", city: "Chestermere", province: "AB", postalCode: "T1X 1L5", country: "Canada", lat: 51.0350, lng: -113.8230 },
    notes: "Lakeside property.", tags: ["VIP", "Recurring"], lastJobDate: "2026-03-08",
  },
];

export const serviceProviders: ServiceProvider[] = [
  { id: "sp-001", name: "Mike Thompson", email: "mike@example.com", phone: "(403) 555-0101", avatar: "MT", status: "Active", baseAddress: { street: "50 Kensington Rd NW", city: "Calgary", province: "AB", postalCode: "T2N 3C8", country: "Canada", lat: 51.0550, lng: -114.0900 }, rating: 4.8, reliabilityScore: 92, completionRate: 96, onTimeRate: 94, cancellationRate: 2, acceptanceRate: 88, avgResponseTime: "4 min", fairnessShare: 12, fairnessStatus: "Within Target", complianceStatus: "Valid", insuranceExpiry: "2026-08-15", certifications: ["Licensed Technician", "Safety Certified"], serviceCategories: ["Window Cleaning", "Gutter Cleaning"], maxJobsPerDay: 5, travelRadius: 30, autoAccept: true, joinedDate: "2023-03-15", totalJobsCompleted: 342, notes: "Prefers morning shifts." },
  { id: "sp-002", name: "Sarah Chen", email: "sarah@example.com", phone: "(403) 555-0102", avatar: "SC", status: "Active", baseAddress: { street: "215 12th Ave SW", city: "Calgary", province: "AB", postalCode: "T2R 0G8", country: "Canada", lat: 51.0410, lng: -114.0780 }, rating: 4.9, reliabilityScore: 97, completionRate: 99, onTimeRate: 97, cancellationRate: 1, acceptanceRate: 95, avgResponseTime: "2 min", fairnessShare: 15, fairnessStatus: "Above Target Share", complianceStatus: "Valid", insuranceExpiry: "2026-11-20", certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"], serviceCategories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"], maxJobsPerDay: 6, travelRadius: 40, autoAccept: true, joinedDate: "2022-09-01", totalJobsCompleted: 512, notes: "" },
  { id: "sp-003", name: "James Wilson", email: "james@example.com", phone: "(403) 555-0103", avatar: "JW", status: "Active", baseAddress: { street: "80 Main St", city: "Airdrie", province: "AB", postalCode: "T4B 2E3", country: "Canada", lat: 51.2900, lng: -114.0200 }, rating: 4.5, reliabilityScore: 85, completionRate: 90, onTimeRate: 88, cancellationRate: 5, acceptanceRate: 72, avgResponseTime: "8 min", fairnessShare: 8, fairnessStatus: "Below Target Share", complianceStatus: "Expiring", insuranceExpiry: "2026-03-10", certifications: ["Licensed Technician"], serviceCategories: ["Window Cleaning"], maxJobsPerDay: 4, travelRadius: 20, autoAccept: false, joinedDate: "2024-01-20", totalJobsCompleted: 89, notes: "Based in Airdrie, prefers north Calgary jobs." },
  { id: "sp-004", name: "Emily Rodriguez", email: "emily@example.com", phone: "(403) 555-0104", avatar: "ER", status: "Active", baseAddress: { street: "340 Centre Ave", city: "Cochrane", province: "AB", postalCode: "T4C 1K3", country: "Canada", lat: 51.1870, lng: -114.4700 }, rating: 4.7, reliabilityScore: 90, completionRate: 94, onTimeRate: 92, cancellationRate: 3, acceptanceRate: 85, avgResponseTime: "5 min", fairnessShare: 11, fairnessStatus: "Within Target", complianceStatus: "Valid", insuranceExpiry: "2026-06-30", certifications: ["Licensed Technician", "Safety Certified"], serviceCategories: ["Pressure Washing", "Gutter Cleaning"], maxJobsPerDay: 5, travelRadius: 35, autoAccept: true, joinedDate: "2023-07-10", totalJobsCompleted: 267, notes: "Based in Cochrane." },
  { id: "sp-005", name: "David Park", email: "david@example.com", phone: "(403) 555-0105", avatar: "DP", status: "Active", baseAddress: { street: "55 2nd St W", city: "Okotoks", province: "AB", postalCode: "T1S 1A4", country: "Canada", lat: 50.7250, lng: -113.9800 }, rating: 4.6, reliabilityScore: 88, completionRate: 92, onTimeRate: 90, cancellationRate: 4, acceptanceRate: 80, avgResponseTime: "6 min", fairnessShare: 10, fairnessStatus: "Within Target", complianceStatus: "Valid", insuranceExpiry: "2027-01-15", certifications: ["Licensed Technician"], serviceCategories: ["Window Cleaning", "Pressure Washing"], maxJobsPerDay: 4, travelRadius: 25, autoAccept: false, joinedDate: "2023-11-05", totalJobsCompleted: 178, notes: "Based in Okotoks — far from north Calgary." },
  { id: "sp-006", name: "Lisa Martinez", email: "lisa@example.com", phone: "(403) 555-0106", avatar: "LM", status: "Suspended", baseAddress: { street: "18 Elgin Meadows Way SE", city: "Calgary", province: "AB", postalCode: "T2Z 4E3", country: "Canada", lat: 50.9350, lng: -114.0500 }, rating: 4.4, reliabilityScore: 82, completionRate: 88, onTimeRate: 85, cancellationRate: 6, acceptanceRate: 70, avgResponseTime: "10 min", fairnessShare: 7, fairnessStatus: "Below Target Share", complianceStatus: "Suspended", insuranceExpiry: "2025-12-01", certifications: ["Licensed Technician"], serviceCategories: ["Window Cleaning"], maxJobsPerDay: 3, travelRadius: 15, autoAccept: false, joinedDate: "2024-05-12", totalJobsCompleted: 45, notes: "Insurance expired — suspended pending renewal." },
  { id: "sp-007", name: "Robert Kim", email: "robert@example.com", phone: "(403) 555-0107", avatar: "RK", status: "Active", baseAddress: { street: "410 Country Hills Blvd NE", city: "Calgary", province: "AB", postalCode: "T3K 4Y7", country: "Canada", lat: 51.1520, lng: -114.0600 }, rating: 4.8, reliabilityScore: 94, completionRate: 97, onTimeRate: 95, cancellationRate: 1, acceptanceRate: 92, avgResponseTime: "3 min", fairnessShare: 13, fairnessStatus: "Within Target", complianceStatus: "Valid", insuranceExpiry: "2026-09-20", certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"], serviceCategories: ["Window Cleaning", "Gutter Cleaning", "Pressure Washing"], maxJobsPerDay: 6, travelRadius: 45, autoAccept: true, joinedDate: "2022-06-18", totalJobsCompleted: 623 },
  { id: "sp-008", name: "Anna Schmidt", email: "anna@example.com", phone: "(403) 555-0108", avatar: "AS", status: "Active", baseAddress: { street: "92 Rainbow Falls Way", city: "Chestermere", province: "AB", postalCode: "T1X 0H3", country: "Canada", lat: 51.0380, lng: -113.8200 }, rating: 4.3, reliabilityScore: 80, completionRate: 86, onTimeRate: 83, cancellationRate: 7, acceptanceRate: 68, avgResponseTime: "12 min", fairnessShare: 6, fairnessStatus: "Below Target Share", complianceStatus: "Expiring", insuranceExpiry: "2026-03-25", certifications: ["Licensed Technician"], serviceCategories: ["Pressure Washing"], maxJobsPerDay: 3, travelRadius: 20, autoAccept: false, joinedDate: "2024-08-01", totalJobsCompleted: 32, notes: "Based in Chestermere." },
  { id: "sp-009", name: "Carlos Ruiz", email: "carlos@example.com", phone: "(403) 555-0109", avatar: "CR", status: "Active", baseAddress: { street: "720 14th St NW", city: "Calgary", province: "AB", postalCode: "T2N 2A4", country: "Canada", lat: 51.0610, lng: -114.0950 }, rating: 4.7, reliabilityScore: 91, completionRate: 95, onTimeRate: 93, cancellationRate: 2, acceptanceRate: 87, avgResponseTime: "4 min", fairnessShare: 11, fairnessStatus: "Within Target", complianceStatus: "Valid", insuranceExpiry: "2026-10-05", certifications: ["Licensed Technician", "Safety Certified"], serviceCategories: ["Window Cleaning", "Gutter Cleaning"], maxJobsPerDay: 5, travelRadius: 30, autoAccept: true, joinedDate: "2023-04-22", totalJobsCompleted: 298 },
  { id: "sp-010", name: "Nina Patel", email: "nina@example.com", phone: "(403) 555-0110", avatar: "NP", status: "Active", baseAddress: { street: "505 Canyon Meadows Dr SE", city: "Calgary", province: "AB", postalCode: "T2J 6G2", country: "Canada", lat: 50.9620, lng: -114.0650 }, rating: 4.6, reliabilityScore: 89, completionRate: 93, onTimeRate: 91, cancellationRate: 3, acceptanceRate: 83, avgResponseTime: "5 min", fairnessShare: 9, fairnessStatus: "Within Target", complianceStatus: "Valid", insuranceExpiry: "2026-07-18", certifications: ["Licensed Technician", "Safety Certified"], serviceCategories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"], maxJobsPerDay: 5, travelRadius: 35, autoAccept: false, joinedDate: "2023-09-14", totalJobsCompleted: 215 },
];

export function formatAddress(addr: Address): string {
  return `${addr.street}, ${addr.city}, ${addr.province} ${addr.postalCode}`;
}

export const jobs: Job[] = [
  { id: "JOB-1001", dbId: "JOB-1001", customerId: "cust-001", customerName: "John Baker", address: "123 Main St NW, Calgary", jobAddress: customers[0].serviceAddress, serviceCategory: "Window Cleaning", estimatedDuration: "2 hours", scheduledDate: "2026-02-23", scheduledTime: "09:00 AM", payout: 180, status: "Assigned", assignedSpId: "sp-001", scores: { availabilityFit: 92, proximity: 88, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 5, finalScore: 91 }, notes: "Please be careful with the plants.", urgency: "Scheduled" },
  { id: "JOB-1002", dbId: "JOB-1002", customerId: "cust-002", customerName: "Maria Santos", address: "456 Bow Trail SW, Calgary", jobAddress: customers[1].serviceAddress, serviceCategory: "Gutter Cleaning", estimatedDuration: "3 hours", scheduledDate: "2026-02-23", scheduledTime: "01:00 PM", payout: 260, status: "Created", scores: { availabilityFit: 78, proximity: 72, competency: 90, reliability: 88, rating: 94, fairnessAdjustment: 8, finalScore: 85 }, notes: "Watch out for the loose ladder.", urgency: "ASAP" },
  { id: "JOB-1003", dbId: "JOB-1003", customerId: "cust-003", customerName: "Tom Henderson", address: "789 Centre St N, Calgary", jobAddress: customers[2].serviceAddress, serviceCategory: "Pressure Washing", estimatedDuration: "4 hours", scheduledDate: "2026-02-24", scheduledTime: "10:00 AM", payout: 340, status: "Created", scores: { availabilityFit: 95, proximity: 95, competency: 80, reliability: 90, rating: 92, fairnessAdjustment: 3, finalScore: 92 }, notes: "", urgency: "AnytimeSoon" },
  { id: "JOB-1004", dbId: "JOB-1004", customerId: "cust-004", customerName: "Rachel Green", address: "321 17th Ave SW, Calgary", jobAddress: customers[3].serviceAddress, serviceCategory: "Window Cleaning", estimatedDuration: "1.5 hours", scheduledDate: "2026-02-24", scheduledTime: "02:00 PM", payout: 140, status: "Assigned", assignedSpId: "sp-002", scores: { availabilityFit: 85, proximity: 65, competency: 95, reliability: 97, rating: 98, fairnessAdjustment: -5, finalScore: 89 }, notes: "Customer prefers eco-friendly products.", urgency: "Scheduled" },
  { id: "JOB-1005", dbId: "JOB-1005", customerId: "cust-005", customerName: "Alex Turner", address: "555 Macleod Trail SE, Calgary", jobAddress: customers[4].serviceAddress, serviceCategory: "Gutter Cleaning", estimatedDuration: "2.5 hours", scheduledDate: "2026-02-25", scheduledTime: "09:30 AM", payout: 220, status: "Created", scores: { availabilityFit: 88, proximity: 80, competency: 88, reliability: 85, rating: 90, fairnessAdjustment: 10, finalScore: 88 }, notes: "", urgency: "Scheduled" },
  { id: "JOB-1006", dbId: "JOB-1006", customerId: "cust-006", customerName: "Diana Prince", address: "100 Crowfoot Way NW, Calgary", jobAddress: customers[5].serviceAddress, serviceCategory: "Window Cleaning", estimatedDuration: "2 hours", scheduledDate: "2026-02-25", scheduledTime: "11:00 AM", payout: 175, status: "Assigned", assignedSpId: "sp-001", scores: { availabilityFit: 90, proximity: 90, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 4, finalScore: 90 }, notes: "Customer has a dog, be cautious.", urgency: "Scheduled" },
  { id: "JOB-1007", dbId: "JOB-1007", customerId: "cust-007", customerName: "Bruce Wayne", address: "900 Deerfoot Trail NE, Calgary", jobAddress: customers[6].serviceAddress, serviceCategory: "Pressure Washing", estimatedDuration: "5 hours", scheduledDate: "2026-02-26", scheduledTime: "08:00 AM", payout: 420, status: "Created", scores: { availabilityFit: 70, proximity: 55, competency: 92, reliability: 94, rating: 96, fairnessAdjustment: 6, finalScore: 82 }, notes: "Large property, allow extra time.", urgency: "AnytimeSoon" },
  { id: "JOB-1008", dbId: "JOB-1008", customerId: "cust-008", customerName: "Clark Kent", address: "200 University Dr NW, Calgary", jobAddress: customers[7].serviceAddress, serviceCategory: "Window Cleaning", estimatedDuration: "1 hour", scheduledDate: "2026-02-26", scheduledTime: "03:00 PM", payout: 95, status: "Completed", assignedSpId: "sp-004", scores: { availabilityFit: 96, proximity: 96, competency: 82, reliability: 90, rating: 94, fairnessAdjustment: 2, finalScore: 93 }, notes: "", urgency: "Scheduled" },
  { id: "JOB-1009", dbId: "JOB-1009", customerId: "cust-009", customerName: "Peter Parker", address: "750 9th Ave SE, Calgary", jobAddress: customers[8].serviceAddress, serviceCategory: "Gutter Cleaning", estimatedDuration: "2 hours", scheduledDate: "2026-02-27", scheduledTime: "10:00 AM", payout: 190, status: "Expired", scores: { availabilityFit: 60, proximity: 75, competency: 85, reliability: 80, rating: 88, fairnessAdjustment: 12, finalScore: 78 }, notes: "Customer requested reschedule.", urgency: "Scheduled" },
  { id: "JOB-1010", dbId: "JOB-1010", customerId: "cust-010", customerName: "Tony Stark", address: "500 4th St SW, Calgary", jobAddress: customers[9].serviceAddress, serviceCategory: "Pressure Washing", estimatedDuration: "3 hours", scheduledDate: "2026-02-27", scheduledTime: "01:00 PM", payout: 290, status: "Created", scores: { availabilityFit: 82, proximity: 85, competency: 78, reliability: 88, rating: 92, fairnessAdjustment: 7, finalScore: 86 }, notes: "Use side entrance.", urgency: "ASAP" },
];

export const allocationWeights = {
  availability: 20, proximity: 15, competency: 15, jobHistory: 10,
  customerRating: 15, reliability: 10, responsiveness: 5, safetyCompliance: 5, fairness: 5,
  policyVersion: "Policy v1.0",
};

export const fairnessConfig = {
  rollingWindow: 30, maxSharePercent: 15, cooldownHours: 4,
  minDistributionBoost: 5, newSpBoostDays: 30,
};

export const declineReasons = [
  "Schedule conflict", "Too far away", "Not my specialty", "Payout too low",
  "Personal reasons", "Equipment unavailable", "Weather conditions", "Other",
];
