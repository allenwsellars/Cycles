  // Import JSON (paste)
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  function validateImportedData(data) {
    if (!data || typeof data !== "object") return "Import is not a JSON object.";
    if (!Array.isArray(data.bikes)) return "Missing 'bikes' array.";
    if (!Array.isArray(data.serviceRecords)) return "Missing 'serviceRecords' array.";

    // minimal validation of bikes
    for (const b of data.bikes) {
      if (!b || typeof b !== "object") return "Invalid bike entry.";
      if (typeof b.id !== "string" || !b.id) return "Bike is missing a string 'id'.";
      if (typeof b.name !== "string" || !b.name) return "Bike is missing a string 'name'.";
    }

    // minimal validation of records
    for (const r of data.serviceRecords) {
      if (!r || typeof r !== "object") return "Invalid service record entry.";
      if (typeof r.id !== "string" || !r.id) return "Service record is missing a string 'id'.";
      if (typeof r.bikeId !== "string" || !r.bikeId) return "Service record is missing a string 'bikeId'.";
      if (typeof r.date !== "string" || !r.date) return "Service record is missing a string 'date'.";
      if (typeof r.serviceType !== "string" || !r.serviceType) return "Service record is missing a string 'serviceType'.";
      if (r.notes != null && typeof r.notes !== "string") return "'notes' must be a string if present.";
    }

    // check record bikeId references a known bike id
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
    } catch (e) {
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
      selectedBikeId: parsed.selectedBikeId || parsed.bikes[0]?.id || ""
    };

    setState(next);
    setShowImport(false);
    setImportText("");
  }
