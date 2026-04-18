'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type TaskItem = {
  id: string;
  title: string;
  subject?: string;
  dueDate?: string;
  status?: string;
  priority?: string;
};

export default function TasksPage() {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  async function loadTasks() {
    try {
      const result = await api.getTasks<TaskItem[]>();
      setTasks(result);
    } catch (error) {
      console.error(error);
      setStatusMsg(error instanceof Error ? error.message : 'Failed to load tasks.');
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  async function handleCreate() {
    try {
      await api.createTask({
        title,
        subject,
        dueDate,
        priority,
        status: 'todo'
      });
      setTitle('');
      setSubject('');
      setDueDate('');
      setPriority('medium');
      setStatusMsg('Task created.');
      await loadTasks();
    } catch (error) {
      console.error(error);
      setStatusMsg(error instanceof Error ? error.message : 'Failed to create task.');
    }
  }

  async function handleMarkDone(id: string) {
    try {
      await api.updateTask(id, { status: 'done' });
      setStatusMsg('Task marked as done.');
      await loadTasks();
    } catch (error) {
      console.error(error);
      setStatusMsg(error instanceof Error ? error.message : 'Failed to update task.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteTask(id);
      setStatusMsg('Task deleted.');
      await loadTasks();
    } catch (error) {
      console.error(error);
      setStatusMsg(error instanceof Error ? error.message : 'Failed to delete task.');
    }
  }

  return (
    <main className="stack">
      <div className="page-head">
        <div>
          <span className="badge">Task planner</span>
          <h1 className="page-title">Manage revision tasks and keep your study queue current.</h1>
          <p className="page-subtitle">This is the reference task workflow restored on top of the current Firebase functions stack.</p>
        </div>
      </div>

      <section className="card">
        <h2>Create task</h2>

        <div className="form-grid">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Title</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Revise CAP theorem" />
          </label>

          <label className="field">
            <span>Subject</span>
            <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Cloud computing" />
          </label>

          <label className="field">
            <span>Due date</span>
            <input className="input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} placeholder="2026-04-20" />
          </label>

          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Priority</span>
            <select className="select" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <button className="btn" onClick={handleCreate}>
          Create Task
        </button>
        {statusMsg ? <p className="status-text">{statusMsg}</p> : null}
      </section>

      <section className="card">
        <div className="row space-between section-head">
          <div>
            <h2>All tasks</h2>
            <p className="muted">Open tasks can be completed or removed directly from this list.</p>
          </div>
        </div>

        <div className="list-stack">
          {tasks.length ? (
            tasks.map((task) => (
              <div key={task.id} className="item-card dense-card">
                <div className="row space-between">
                  <div>
                    <strong>{task.title}</strong>
                    <p className="muted">
                      {[task.subject, task.priority, task.status, task.dueDate ? `Due ${task.dueDate}` : ''].filter(Boolean).join(' • ')}
                    </p>
                  </div>

                  <div className="actions">
                    {task.status !== 'done' ? (
                      <button className="btn secondary" onClick={() => void handleMarkDone(task.id)}>
                        Mark Done
                      </button>
                    ) : null}
                    <button className="btn danger" onClick={() => void handleDelete(task.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">No tasks yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}
