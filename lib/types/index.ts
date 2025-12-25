export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

export interface Notebook {
  id: string;
  userId: string;
  name: string;
  slug: string; // URL-friendly version of name
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
}

export interface Tab {
  id: string;
  notebookId: string;
  name: string;
  icon: string;
  order: number;
  isLocked: boolean;
  isStaple: boolean;
  createdAt: Date;
  color?: string;
}

export interface Note {
  id: string;
  userId: string;
  notebookId: string;
  tabId: string;
  title: string;
  content: string; // HTML from TipTap
  contentPlain: string; // For search
  images: string[]; // Firebase Storage URLs
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  deletedAt: Date | null;
}

export interface UserPreferences {
  userId: string;
  currentNotebookId: string;
  theme: 'dark' | 'light' | 'purple' | 'blue';
  autoSave: boolean;
  autoSaveInterval: number;
  tabsLocked: boolean;
}

export type Theme = 'dark' | 'light' | 'purple' | 'blue';



