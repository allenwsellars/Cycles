import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "bikeMaintenance.v1";

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

// Convert between input[type=month] value (YYYY-MM) and stored (MM-YYYY)
function monthInputToStored(yyyyMm) {
  if (!yyyyMm) return "";
  const [yyyy, mm] = yyyyMm.split("-");
  return `${mm}-${yyyy}`;
}
function storedToMonthInput(mmYyyy) {
  if (!mmYyyy) return "";
  const [mm, yyyy] = mmYyyy.split("-");
  return `${yyyy}-${mm}`;
}
// For sorting, normalize stored MM-YYYY -> YYYY-MM
function storedToSortKey(mmYyyy) {
  return storedToMonthInput(mmYyyy);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // optional seed bike so the UI is immediately usable
    return {
      bikes: [{ id: "b1", name: "My Bike" }],
      serviceRecords: [],
      selectedBikeId: "b1"
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { bikes: [], serviceRecords: [], selectedBikeId: "" };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function App() {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const bikes = state.bikes ?? [];
  const selectedBikeId = state.selectedBikeId ?? (bikes[0]?.id || "");
  const serviceRecords = state.serviceRecords ?? [];

  // keep selectedBikeId valid if bikes change
  useEffect(() => {
    if (!selectedBikeId && bikes.length) {
      setState((s) => ({ ...s, selectedBikeId: bikes[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bikes.length]);

  const selectedBike = bikes.find((b) => b.id === selectedBikeId);

  const filteredRecords = useMemo(() => {
    return serviceRecords
      .filter((r) => r.bikeId === selectedBikeId)
      .slice()
      .sort((a, b) => {
        const ak = storedToSortKey(a.date);
        const bk = storedToSortKey(b.date);
        return bk.localeCompare(ak); // newest first
      });
  }, [serviceRecords, selectedBikeId]);

  // Add bike (no edit/delete bikes for now)
  const [newBikeName, setNewBikeName] = useState("");
  function addBike(e) {
    e.preventDefault();
    const name = newBikeName.trim();
    if (!name) return;

    const id = uid();
    setState((s) => ({
      ...s,
      bikes: [...s.bikes, { id, name }],
      selectedBikeId: id
    }));
    setNewBikeName("");
  }

  // Service record add/edit/delete
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    dateMonth: "", // YYYY-MM (input type="month")
    serviceType: "",
    notes: ""
  });

  function startAdd() {
    if (!selectedBikeId) return;
    setEditingId(null);
    setForm({ dateMonth: "", serviceType: "", notes: "" });
  }

  function startEdit(record) {
    setEditingId(record.id);
    setForm({
      dateMonth: storedToMonthInput(record.date),
      serviceType: record.serviceType || "",
      notes: record.notes || ""
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ dateMonth: "", serviceType: "", notes: "" });
  }

  function saveRecord(e) {
    e.preventDefault();
    if (!selectedBikeId) return;

    const storedDate = monthInputToStored(form.dateMonth);
    const serviceType = form.serviceType.trim();
    const notes = form.notes.trim();

    if (!storedDate) {
      alert("Please choose a month/year.");
      return;
    }
    if (!serviceType) {
      alert("Please enter a service type.");
      return;
    }

    if (editingId) {
      setState((s) => ({
        ...s,
        serviceRecords: s.serviceRecords.map((r) =>
          r.id === editingId ? { ...r, date: storedDate, serviceType, notes } : r
        )
      }));
    } else {
      const newRec = {
        id: uid(),
        bikeId: selectedBikeId,
        date: storedDate, // MM-YYYY
        serviceType,
        notes
      };
      setState((s) => ({ ...s, serviceRecords: [...s.serviceRecords, newRec] }));
    }

    cancelEdit();
  }

  function deleteRecord(id) {
    const ok = confirm("Delete this service record?");
    if (!ok) return;

    setState((s) => ({
      ...s,
      serviceRecords: s.serviceRecords.filter((r) => r.id !== id)
    }));

    if (editingId === id) cancelEdit();
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Bike Maintenance</h1>
      </header>

      <section className="card">
        <h2>Bikes</h2>

        <div className="row">
          <label>
            Select bike
            <select
              value={selectedBikeId}
              onChange={(e) => setState((s) => ({ ...s, selectedBikeId: e.target.value }))}
              disabled={!bikes.length}
            >
              {bikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <form className="inlineForm" onSubmit={addBike}>
            <label>
              Add bike
              <input
                value={newBikeName}
                onChange={(e) => setNewBikeName(e.target.value)}
                placeholder="e.g., Gravel Bike"
              />
            </label>
            <button type="submit">Add</button>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <h2>
            Service Records{" "}
            {selectedBike ? <span className="muted">({selectedBike.name})</span> : null}
          </h2>
          <button type="button" onClick={startAdd} disabled={!selectedBikeId}>
            + Add record
          </button>
        </div>

        <form className="form" onSubmit={saveRecord}>
          <div className="grid">
            <label>
              Month / Year
              <input
                type="month"
                value={form.dateMonth}
                onChange={(e) => setForm((f) => ({ ...f, dateMonth: e.target.value }))}
              />
            </label>

            <label>
              Service type (free text)
              <input
                value={form.serviceType}
                onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                placeholder="e.g., Replaced chain"
              />
            </label>
          </div>

          <label>
            Notes (optional)
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Anything you want to remember…"
            />
          </label>

          <div className="actions">
            <button type="submit">{editingId ? "Save changes" : "Add record"}</button>
            <button type="button" className="secondary" onClick={cancelEdit}>
              Cancel
            </button>
            {editingId ? <span className="muted">Editing existing record</span> : null}
          </div>
        </form>

        <div className="list">
          {!selectedBikeId ? (
            <p className="muted">Add a bike to start tracking maintenance.</p>
          ) : filteredRecords.length === 0 ? (
            <p className="muted">No service records yet.</p>
          ) : (
            filteredRecords.map((r) => (
              <div key={r.id} className="listItem">
                <div className="listMain">
                  <div className="listTitle">
                    <strong>{r.serviceType}</strong>
                    <span className="pill">{r.date}</span>
                  </div>
                  {r.notes ? (
                    <div className="listNotes">{r.notes}</div>
                  ) : (
                    <div className="muted">No notes</div>
                  )}
                </div>
                <div className="listActions">
                  <button type="button" onClick={() => startEdit(r)}>
                    Edit
                  </button>
                  <button type="button" className="danger" onClick={() => deleteRecord(r.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="footer muted">
        Data is stored locally in this browser (LocalStorage).
      </footer>
    </div>
  );
}
