import React, { useState } from 'react';
import { createStoreHook } from '../lib/store/renderer';
import { demoStore, type Project } from './stores/demo';

const useDemo = createStoreHook(demoStore);

function ThemeToggle() {
  const theme = useDemo((s) => s.theme);
  const setTheme = useDemo((s) => s.setTheme);

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Theme: {theme}
    </button>
  );
}

function FontSizeControl() {
  const fontSize = useDemo((s) => s.fontSize);
  const setFontSize = useDemo((s) => s.setFontSize);

  return (
    <div className="control-row">
      <span>Font size: {fontSize}px</span>
      <button onClick={() => setFontSize(fontSize - 1)}>−</button>
      <button onClick={() => setFontSize(fontSize + 1)}>+</button>
    </div>
  );
}

function AddProject() {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const addProject = useDemo((s) => s.addProject);

  const handleAdd = () => {
    if (!name.trim()) return;
    const project: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      path: path.trim() || `/projects/${name.trim().toLowerCase()}`,
    };
    addProject(project);
    setName('');
    setPath('');
  };

  return (
    <div className="add-project">
      <input
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <input
        placeholder="Path (optional)"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
      />
      <button onClick={handleAdd}>Add</button>
    </div>
  );
}

function ProjectList() {
  const projects = useDemo((s) => s.projects);
  const activeProjectId = useDemo((s) => s.activeProjectId);
  const setActiveProject = useDemo((s) => s.setActiveProject);
  const removeProject = useDemo((s) => s.removeProject);

  if (projects.length === 0) {
    return <p className="empty">No projects yet. Add one above.</p>;
  }

  return (
    <ul className="project-list">
      {projects.map((p) => (
        <li
          key={p.id}
          className={p.id === activeProjectId ? 'active' : ''}
          onClick={() => setActiveProject(p.id)}
        >
          <div className="project-info">
            <strong>{p.name}</strong>
            <span className="path">{p.path}</span>
          </div>
          <button
            className="remove"
            onClick={(e) => {
              e.stopPropagation();
              removeProject(p.id);
            }}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const theme = useDemo((s) => s.theme);
  const fontSize = useDemo((s) => s.fontSize);

  return (
    <div className={`app ${theme}`} style={{ fontSize }}>
      <h1>Electrand Store Demo</h1>

      <section>
        <h2>Preferences</h2>
        <div className="controls">
          <ThemeToggle />
          <FontSizeControl />
        </div>
      </section>

      <section>
        <h2>Projects</h2>
        <AddProject />
        <ProjectList />
      </section>
    </div>
  );
}
