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
      selectedBikeId: "b1",
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

  // persist
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
    const recs = serviceRecords
      .filter((r) => r.bikeId === selectedBikeId)
      .slice()
      .sort((a, b) => {
        const ak = storedToSortKey(a.date);
        const bk = storedToSortKey(b.date);
        // newest first
        return bk.localeCompare(ak);
      });
    return recs;
  }, [serviceRecords, selectedBikeId]);

  // Bike add (no edit/delete bikes for now)
  const [newBikeName, setNewBikeName] = useState("");
  function addBike(e) {
    e.preventDefault();
    const name = newBikeName.trim();
    if (!name) return;

    const id = uid();
    setState((s) => ({
      ...s,
      bikes: [...s.bikes, { id, name }],
      selectedBikeId: id,
    }));
    setNewBikeName("");
  }

  // Service record form (add/edit)
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    dateMonth: "", // YYYY-MM (for input)
    serviceType: "",
    notes: "",
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
      notes: record.notes || "",
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
        ),
      }));
    } else {
      const newRec = {
        id: uid(),
        bikeId: selectedBikeId,
        date: storedDate, // MM-YYYY
        serviceType,
        notes,
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
      serviceRecords: s.serviceRecords.filter((r) => r.id !== id),
    }));
    if (editingId === id) cancelEdit();
  }

  // Import JSON (paste)
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  function validateImportedData(data) {
    if (!data || typeof data !== "object") return "Import is not a JSON object.";
    if (!Array.isArray(data.bikes)) return "Missing 'bikes' array.";
    if (!Array.isArray(data.serviceRecords)) return "Missing 'serviceRecords' array.";

    for (const b of data.bikes) {
      if (!b || typeof b !== "object") return "Invalid bike entry.";
      if (typeof b.id !== "string" || !b.id) return "Bike is missing a string 'id'.";
      if (typeof b.name !== "string" || !b.name) return "Bike is missing a string 'name'.";
    }

    for (const r of data.serviceRecords) {
      if (!r || typeof r !== "object") return "Invalid service record entry.";
      if (typeof r.id !== "string" || !r.id) return "Service record is missing a string 'id'.";
      if (typeof r.bikeId !== "string" || !r.bikeId) return "Service record is missing a string 'bikeId'.";
      if (typeof r.date !== "string" || !r.date) return "Service record is missing a string 'date'.";
      if (typeof r.serviceType !== "string" || !r.serviceType)
        return "Service record is missing a string 'serviceType'.";
      if (r.notes != null && typeof r.notes !== "string") return "'notes' must be a string if present.";
    }

    const bikeIds = new Set(data.bikes.map((b) => b.id));
    for (const r of data.serviceRecords) {
      if (!bikeIds.has(r.bikeId)) return `Service record '${r.id}' references unknown bikeId '${r.bikeId}'.`;
    }

    return null;
  }

  function doImport() {
    let parsed;
    try {
      parsed = JSON.parse(importText);
    } catch {
      alert("Invalid JSON. Please check formatting.");
      return;
    }

    const err = validateImportedData(parsed);
    if (err) {
      alert(`Import failed: ${err}`);
      return;
    }

    const next = {
      bikes: parsed.bikes,
      serviceRecords: parsed.serviceRecords,
      selectedBikeId: parsed.selectedBikeId || parsed.bikes[0]?.id || "",
    };

    setState(next);
    setShowImport(false);
    setImportText("");
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Bike Maintenance</h1>
        <div className="headerRight">
          <button type="button" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "Close Import" : "Import JSON"}
          </button>
        </div>
      </header>

      {showImport && (
        <section className="card">
          <h2>Import JSON</h2>
          <p className="muted">
            Paste JSON in the format {"{ bikes: [...], serviceRecords: [...] }"}. Import will overwrite the data
            currently stored in this browser.
          </p>

          <label>
            JSON to import
            <textarea
              rows={10}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste JSON here..."
            />
          </label>

          <div className="actions">
            <button type="button" className="danger" onClick={doImport}>
              Import (Overwrite)
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setShowImport(false);
                setImportText("");
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}

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
            Service Records {selectedBike ? <span className="muted">({selectedBike.name})</span> : null}
          </h2>
          <button type="button" onClick={startAdd} disabled={!selectedBikeId}>
            + Add record
          </button>
        </div>

        {/* Add/Edit form */}
        <form className="
