export interface User {
  id: string | number;
  username: string;
  password?: string;
  email?: string;
  name?: string;
  userRole?: 'admin' | 'user';
  isActive?: boolean;
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  location: string;
}

export interface Education {
  id: string;
  degree: string;
  institution: string;
  startYear: string;
  endYear: string;
  description: string;
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface Project {
  id: string;
  name: string;
  techStack: string;
  role: string;
  description: string;
  impact: string;
}

export interface Profile {
  id?: string | number;
  userId?: string | number;
  personal: PersonalInfo;
  accentColor: string;
  about: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: Record<string, string>;
  skillRatings?: Record<string, number>;
  certifications: string[];
  interests?: string[];
  personalDetails?: string[];
  keyAchievements?: string[];
  sectionTitles?: Record<string, string>;
}

export interface ProfileListItem extends Profile {
  id: string | number;
  ownerName?: string;
  ownerUsername?: string;
  ownerRole?: 'admin' | 'user';
}

export interface PDFOverrides {
  accentColor?: string;
  name?: string;
  about?: string;
  experience?: Experience[];
  projects?: Project[];
  highlightProjects?: string[];
  skills?: Record<string, string>;
}

export interface JDAnalysisResult {
  matchScore: number;
  tailoredAbout: string;
  keySkills: string[];
  missingSkills: string[];
  tailoredExperience: Array<{ id: string; bullets: string[] }>;
  highlightProjects: string[];
  linkedinMessage: string;
  formalEmail: string;
}

export interface ATSResult {
  score: number;
  strengths: string[];
  improvements: string[];
}

export interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  syncSessionUser: (user: User | null) => void;
}

export interface ProfileContextValue {
  profile: Profile;
  loading: boolean;
  isProfileSelected: boolean;
  isDraft: boolean;
  saveProfile: (updated: Profile) => Promise<void>;
  deleteProfile: (id: string | number) => Promise<void>;
  updateField: <K extends keyof Profile>(field: K, value: Profile[K]) => void;
  loadProfile: () => Promise<void>;
  loadDraftProfile: (draft: Partial<Profile>) => void;
  profiles: ProfileListItem[];
  switchProfile: (id: string | number) => Promise<void>;
  createNewProfile: () => boolean;
}
