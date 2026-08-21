"use client";

import { useEffect, useState } from "react";

type User = { id: number; name: string; ci: string; cnp: string; role: string; active: number };

export const CURRENT_USER_KEY = "facturare_current_user_id";

export function CurrentUserBox() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentId, setCurrentId] = useState<string>("");

  useEffect(() => {
    fetch("/api/accounting/users")
      .then((r) => r.json())
      .then((list: User[]) => {
        setUsers(list);
        const saved = localStorage.getItem(CURRENT_USER_KEY);
        if (saved && list.some((u) => String(u.id) === saved)) {
          setCurrentId(saved);
        } else if (list.length > 0) {
          setCurrentId(String(list[0].id));
          localStorage.setItem(CURRENT_USER_KEY, String(list[0].id));
        }
      });
  }, []);

  function onChange(id: string) {
    setCurrentId(id);
    localStorage.setItem(CURRENT_USER_KEY, id);
  }

  return (
    <div className="current-user-box">
      <div className="current-user-label">Utilizator activ</div>
      {users.length === 0 ? (
        <a href="/dashboard/contabilitate/users" className="link-action">
          + adauga un utilizator
        </a>
      ) : (
        <select className="current-user-select" value={currentId} onChange={(e) => onChange(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
