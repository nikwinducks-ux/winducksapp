// ===== SERVICE PROVIDERS =====
export interface ServiceProvider {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
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
}

export interface Job {
  id: string;
  customerName: string;
  address: string;
  serviceCategory: string;
  estimatedDuration: string;
  scheduledDate: string;
  scheduledTime: string;
  payout: number;
  status: "pending" | "assigned" | "in-progress" | "completed" | "expired" | "declined";
  assignedSpId?: string;
  distance?: number;
  scores?: AllocationScores;
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

export const serviceProviders: ServiceProvider[] = [
  {
    id: "sp-001", name: "Mike Thompson", email: "mike@example.com", phone: "(403) 555-0101",
    avatar: "MT", rating: 4.8, reliabilityScore: 92, completionRate: 96, onTimeRate: 94,
    cancellationRate: 2, acceptanceRate: 88, avgResponseTime: "4 min",
    fairnessShare: 12, fairnessStatus: "Within Target",
    complianceStatus: "Valid", insuranceExpiry: "2026-08-15",
    certifications: ["Licensed Technician", "Safety Certified"],
    serviceCategories: ["Window Cleaning", "Gutter Cleaning"],
    maxJobsPerDay: 5, travelRadius: 30, autoAccept: true,
    joinedDate: "2023-03-15", totalJobsCompleted: 342,
  },
  {
    id: "sp-002", name: "Sarah Chen", email: "sarah@example.com", phone: "(403) 555-0102",
    avatar: "SC", rating: 4.9, reliabilityScore: 97, completionRate: 99, onTimeRate: 97,
    cancellationRate: 1, acceptanceRate: 95, avgResponseTime: "2 min",
    fairnessShare: 15, fairnessStatus: "Above Target Share",
    complianceStatus: "Valid", insuranceExpiry: "2026-11-20",
    certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"],
    serviceCategories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"],
    maxJobsPerDay: 6, travelRadius: 40, autoAccept: true,
    joinedDate: "2022-09-01", totalJobsCompleted: 512,
  },
  {
    id: "sp-003", name: "James Wilson", email: "james@example.com", phone: "(403) 555-0103",
    avatar: "JW", rating: 4.5, reliabilityScore: 85, completionRate: 90, onTimeRate: 88,
    cancellationRate: 5, acceptanceRate: 72, avgResponseTime: "8 min",
    fairnessShare: 8, fairnessStatus: "Below Target Share",
    complianceStatus: "Expiring", insuranceExpiry: "2026-03-10",
    certifications: ["Licensed Technician"],
    serviceCategories: ["Window Cleaning"],
    maxJobsPerDay: 4, travelRadius: 20, autoAccept: false,
    joinedDate: "2024-01-20", totalJobsCompleted: 89,
  },
  {
    id: "sp-004", name: "Emily Rodriguez", email: "emily@example.com", phone: "(403) 555-0104",
    avatar: "ER", rating: 4.7, reliabilityScore: 90, completionRate: 94, onTimeRate: 92,
    cancellationRate: 3, acceptanceRate: 85, avgResponseTime: "5 min",
    fairnessShare: 11, fairnessStatus: "Within Target",
    complianceStatus: "Valid", insuranceExpiry: "2026-06-30",
    certifications: ["Licensed Technician", "Safety Certified"],
    serviceCategories: ["Pressure Washing", "Gutter Cleaning"],
    maxJobsPerDay: 5, travelRadius: 35, autoAccept: true,
    joinedDate: "2023-07-10", totalJobsCompleted: 267,
  },
  {
    id: "sp-005", name: "David Park", email: "david@example.com", phone: "(403) 555-0105",
    avatar: "DP", rating: 4.6, reliabilityScore: 88, completionRate: 92, onTimeRate: 90,
    cancellationRate: 4, acceptanceRate: 80, avgResponseTime: "6 min",
    fairnessShare: 10, fairnessStatus: "Within Target",
    complianceStatus: "Valid", insuranceExpiry: "2027-01-15",
    certifications: ["Licensed Technician"],
    serviceCategories: ["Window Cleaning", "Pressure Washing"],
    maxJobsPerDay: 4, travelRadius: 25, autoAccept: false,
    joinedDate: "2023-11-05", totalJobsCompleted: 178,
  },
  {
    id: "sp-006", name: "Lisa Martinez", email: "lisa@example.com", phone: "(403) 555-0106",
    avatar: "LM", rating: 4.4, reliabilityScore: 82, completionRate: 88, onTimeRate: 85,
    cancellationRate: 6, acceptanceRate: 70, avgResponseTime: "10 min",
    fairnessShare: 7, fairnessStatus: "Below Target Share",
    complianceStatus: "Suspended", insuranceExpiry: "2025-12-01",
    certifications: ["Licensed Technician"],
    serviceCategories: ["Window Cleaning"],
    maxJobsPerDay: 3, travelRadius: 15, autoAccept: false,
    joinedDate: "2024-05-12", totalJobsCompleted: 45,
  },
  {
    id: "sp-007", name: "Robert Kim", email: "robert@example.com", phone: "(403) 555-0107",
    avatar: "RK", rating: 4.8, reliabilityScore: 94, completionRate: 97, onTimeRate: 95,
    cancellationRate: 1, acceptanceRate: 92, avgResponseTime: "3 min",
    fairnessShare: 13, fairnessStatus: "Within Target",
    complianceStatus: "Valid", insuranceExpiry: "2026-09-20",
    certifications: ["Licensed Technician", "Safety Certified", "Master Cleaner"],
    serviceCategories: ["Window Cleaning", "Gutter Cleaning", "Pressure Washing"],
    maxJobsPerDay: 6, travelRadius: 45, autoAccept: true,
    joinedDate: "2022-06-18", totalJobsCompleted: 623,
  },
  {
    id: "sp-008", name: "Anna Schmidt", email: "anna@example.com", phone: "(403) 555-0108",
    avatar: "AS", rating: 4.3, reliabilityScore: 80, completionRate: 86, onTimeRate: 83,
    cancellationRate: 7, acceptanceRate: 68, avgResponseTime: "12 min",
    fairnessShare: 6, fairnessStatus: "Below Target Share",
    complianceStatus: "Expiring", insuranceExpiry: "2026-03-25",
    certifications: ["Licensed Technician"],
    serviceCategories: ["Pressure Washing"],
    maxJobsPerDay: 3, travelRadius: 20, autoAccept: false,
    joinedDate: "2024-08-01", totalJobsCompleted: 32,
  },
  {
    id: "sp-009", name: "Carlos Ruiz", email: "carlos@example.com", phone: "(403) 555-0109",
    avatar: "CR", rating: 4.7, reliabilityScore: 91, completionRate: 95, onTimeRate: 93,
    cancellationRate: 2, acceptanceRate: 87, avgResponseTime: "4 min",
    fairnessShare: 11, fairnessStatus: "Within Target",
    complianceStatus: "Valid", insuranceExpiry: "2026-10-05",
    certifications: ["Licensed Technician", "Safety Certified"],
    serviceCategories: ["Window Cleaning", "Gutter Cleaning"],
    maxJobsPerDay: 5, travelRadius: 30, autoAccept: true,
    joinedDate: "2023-04-22", totalJobsCompleted: 298,
  },
  {
    id: "sp-010", name: "Nina Patel", email: "nina@example.com", phone: "(403) 555-0110",
    avatar: "NP", rating: 4.6, reliabilityScore: 89, completionRate: 93, onTimeRate: 91,
    cancellationRate: 3, acceptanceRate: 83, avgResponseTime: "5 min",
    fairnessShare: 9, fairnessStatus: "Within Target",
    complianceStatus: "Valid", insuranceExpiry: "2026-07-18",
    certifications: ["Licensed Technician", "Safety Certified"],
    serviceCategories: ["Window Cleaning", "Pressure Washing", "Gutter Cleaning"],
    maxJobsPerDay: 5, travelRadius: 35, autoAccept: false,
    joinedDate: "2023-09-14", totalJobsCompleted: 215,
  },
];

export const jobs: Job[] = [
  {
    id: "JOB-1001", customerName: "John Baker", address: "123 Main St NW, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "2 hours",
    scheduledDate: "2026-02-23", scheduledTime: "09:00 AM", payout: 180,
    status: "assigned", assignedSpId: "sp-001", distance: 8.2,
    scores: { availabilityFit: 92, proximity: 88, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 5, finalScore: 91 },
  },
  {
    id: "JOB-1002", customerName: "Maria Santos", address: "456 Bow Trail SW, Calgary",
    serviceCategory: "Gutter Cleaning", estimatedDuration: "3 hours",
    scheduledDate: "2026-02-23", scheduledTime: "01:00 PM", payout: 260,
    status: "pending", distance: 12.5,
    scores: { availabilityFit: 78, proximity: 72, competency: 90, reliability: 88, rating: 94, fairnessAdjustment: 8, finalScore: 85 },
  },
  {
    id: "JOB-1003", customerName: "Tom Henderson", address: "789 Centre St N, Calgary",
    serviceCategory: "Pressure Washing", estimatedDuration: "4 hours",
    scheduledDate: "2026-02-24", scheduledTime: "10:00 AM", payout: 340,
    status: "pending", distance: 5.1,
    scores: { availabilityFit: 95, proximity: 95, competency: 80, reliability: 90, rating: 92, fairnessAdjustment: 3, finalScore: 92 },
  },
  {
    id: "JOB-1004", customerName: "Rachel Green", address: "321 17th Ave SW, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "1.5 hours",
    scheduledDate: "2026-02-24", scheduledTime: "02:00 PM", payout: 140,
    status: "assigned", assignedSpId: "sp-002", distance: 15.3,
    scores: { availabilityFit: 85, proximity: 65, competency: 95, reliability: 97, rating: 98, fairnessAdjustment: -5, finalScore: 89 },
  },
  {
    id: "JOB-1005", customerName: "Alex Turner", address: "555 Macleod Trail SE, Calgary",
    serviceCategory: "Gutter Cleaning", estimatedDuration: "2.5 hours",
    scheduledDate: "2026-02-25", scheduledTime: "09:30 AM", payout: 220,
    status: "pending", distance: 9.8,
    scores: { availabilityFit: 88, proximity: 80, competency: 88, reliability: 85, rating: 90, fairnessAdjustment: 10, finalScore: 88 },
  },
  {
    id: "JOB-1006", customerName: "Diana Prince", address: "100 Crowfoot Way NW, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "2 hours",
    scheduledDate: "2026-02-25", scheduledTime: "11:00 AM", payout: 175,
    status: "assigned", assignedSpId: "sp-001", distance: 6.7,
    scores: { availabilityFit: 90, proximity: 90, competency: 85, reliability: 92, rating: 96, fairnessAdjustment: 4, finalScore: 90 },
  },
  {
    id: "JOB-1007", customerName: "Bruce Wayne", address: "900 Deerfoot Trail NE, Calgary",
    serviceCategory: "Pressure Washing", estimatedDuration: "5 hours",
    scheduledDate: "2026-02-26", scheduledTime: "08:00 AM", payout: 420,
    status: "pending", distance: 18.2,
    scores: { availabilityFit: 70, proximity: 55, competency: 92, reliability: 94, rating: 96, fairnessAdjustment: 6, finalScore: 82 },
  },
  {
    id: "JOB-1008", customerName: "Clark Kent", address: "200 University Dr NW, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "1 hour",
    scheduledDate: "2026-02-26", scheduledTime: "03:00 PM", payout: 95,
    status: "completed", assignedSpId: "sp-004", distance: 4.3,
    scores: { availabilityFit: 96, proximity: 96, competency: 82, reliability: 90, rating: 94, fairnessAdjustment: 2, finalScore: 93 },
  },
  {
    id: "JOB-1009", customerName: "Peter Parker", address: "750 9th Ave SE, Calgary",
    serviceCategory: "Gutter Cleaning", estimatedDuration: "2 hours",
    scheduledDate: "2026-02-27", scheduledTime: "10:00 AM", payout: 190,
    status: "expired", distance: 11.0,
    scores: { availabilityFit: 60, proximity: 75, competency: 85, reliability: 80, rating: 88, fairnessAdjustment: 12, finalScore: 78 },
  },
  {
    id: "JOB-1010", customerName: "Tony Stark", address: "500 4th St SW, Calgary",
    serviceCategory: "Pressure Washing", estimatedDuration: "3 hours",
    scheduledDate: "2026-02-27", scheduledTime: "01:00 PM", payout: 290,
    status: "pending", distance: 7.5,
    scores: { availabilityFit: 82, proximity: 85, competency: 78, reliability: 88, rating: 92, fairnessAdjustment: 7, finalScore: 86 },
  },
  {
    id: "JOB-1011", customerName: "Natasha Romanov", address: "310 Heritage Dr SE, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "2 hours",
    scheduledDate: "2026-02-28", scheduledTime: "09:00 AM", payout: 165,
    status: "pending", distance: 13.4,
  },
  {
    id: "JOB-1012", customerName: "Steve Rogers", address: "888 Country Hills Blvd NE, Calgary",
    serviceCategory: "Gutter Cleaning", estimatedDuration: "3.5 hours",
    scheduledDate: "2026-02-28", scheduledTime: "11:30 AM", payout: 310,
    status: "assigned", assignedSpId: "sp-007", distance: 22.1,
    scores: { availabilityFit: 75, proximity: 50, competency: 95, reliability: 94, rating: 96, fairnessAdjustment: 2, finalScore: 83 },
  },
  {
    id: "JOB-1013", customerName: "Wanda Maximoff", address: "425 Memorial Dr NE, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "1.5 hours",
    scheduledDate: "2026-03-01", scheduledTime: "10:00 AM", payout: 135,
    status: "declined", distance: 9.0,
  },
  {
    id: "JOB-1014", customerName: "Vision Anderson", address: "670 Sarcee Trail NW, Calgary",
    serviceCategory: "Pressure Washing", estimatedDuration: "4 hours",
    scheduledDate: "2026-03-01", scheduledTime: "08:30 AM", payout: 365,
    status: "pending", distance: 16.8,
  },
  {
    id: "JOB-1015", customerName: "Sam Wilson", address: "150 Shawnessy Blvd SW, Calgary",
    serviceCategory: "Gutter Cleaning", estimatedDuration: "2 hours",
    scheduledDate: "2026-03-02", scheduledTime: "09:00 AM", payout: 185,
    status: "in-progress", assignedSpId: "sp-009", distance: 20.5,
    scores: { availabilityFit: 80, proximity: 48, competency: 88, reliability: 91, rating: 94, fairnessAdjustment: 5, finalScore: 80 },
  },
  {
    id: "JOB-1016", customerName: "Pepper Potts", address: "290 52nd St SE, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "2.5 hours",
    scheduledDate: "2026-03-02", scheduledTime: "01:00 PM", payout: 215,
    status: "pending", distance: 10.2,
  },
  {
    id: "JOB-1017", customerName: "Happy Hogan", address: "400 Beddington Blvd NE, Calgary",
    serviceCategory: "Pressure Washing", estimatedDuration: "3 hours",
    scheduledDate: "2026-03-03", scheduledTime: "10:00 AM", payout: 275,
    status: "pending", distance: 14.6,
  },
  {
    id: "JOB-1018", customerName: "Nick Fury", address: "50 Signal Hill Centre SW, Calgary",
    serviceCategory: "Gutter Cleaning", estimatedDuration: "2 hours",
    scheduledDate: "2026-03-03", scheduledTime: "02:30 PM", payout: 200,
    status: "pending", distance: 19.3,
  },
  {
    id: "JOB-1019", customerName: "Phil Coulson", address: "725 Harvest Hills Dr NE, Calgary",
    serviceCategory: "Window Cleaning", estimatedDuration: "1 hour",
    scheduledDate: "2026-03-04", scheduledTime: "11:00 AM", payout: 90,
    status: "completed", assignedSpId: "sp-005", distance: 25.0,
    scores: { availabilityFit: 65, proximity: 40, competency: 85, reliability: 88, rating: 92, fairnessAdjustment: 8, finalScore: 75 },
  },
  {
    id: "JOB-1020", customerName: "May Parker", address: "180 Tuscany Blvd NW, Calgary",
    serviceCategory: "Pressure Washing", estimatedDuration: "3.5 hours",
    scheduledDate: "2026-03-04", scheduledTime: "09:00 AM", payout: 320,
    status: "pending", distance: 28.7,
  },
];

export const allocationWeights = {
  availability: 20,
  proximity: 15,
  competency: 15,
  jobHistory: 10,
  customerRating: 15,
  reliability: 10,
  responsiveness: 5,
  safetyCompliance: 5,
  fairness: 5,
  policyVersion: "Policy v1.0",
};

export const fairnessConfig = {
  rollingWindow: 30,
  maxSharePercent: 15,
  cooldownHours: 4,
  minDistributionBoost: 5,
  newSpBoostDays: 30,
};

export const declineReasons = [
  "Schedule conflict",
  "Too far away",
  "Not my specialty",
  "Payout too low",
  "Personal reasons",
  "Equipment unavailable",
  "Weather conditions",
  "Other",
];
