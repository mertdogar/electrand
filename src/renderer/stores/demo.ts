import { defineStore } from '@lib/store/types';

export interface Project {
  id: string;
  name: string;
  path: string;
}

interface DemoState {
  // Preferences
  theme: 'dark' | 'light';
  fontSize: number;

  // Active projects
  projects: Project[];
  activeProjectId: string | null;

  // Actions — preferences
  setTheme: (theme: 'dark' | 'light') => void;
  setFontSize: (size: number) => void;

  // Actions — projects
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
}

export const demoStore = defineStore<DemoState>('demo', (set, get) => ({
  theme: 'dark',
  fontSize: 14,
  projects: [],
  activeProjectId: null,

  setTheme: (theme) => set({ theme }),
  setFontSize: (size) => set({ fontSize: size }),

  addProject: (project) =>
    set({ projects: [...get().projects, project] }),

  removeProject: (id) =>
    set({
      projects: get().projects.filter((p) => p.id !== id),
      activeProjectId:
        get().activeProjectId === id ? null : get().activeProjectId,
    }),

  setActiveProject: (id) => set({ activeProjectId: id }),
}));
