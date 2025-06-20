import React, { useState } from "react";

const COLS = 10;
const ROWS = 10;

function getCellId(row, col) {
  // Convert col number to letter: 0 -> A, 1 -> B, ...
  const colLetter = String.fromCharCode("A".charCodeAt(0) + col);
  return `${colLetter}${row + 1}`;
}

export default function ExcelFormulaBar() {
  // Store cell data as { A1: "value", B2: "value" }
  const [cells, setCells] = useState({});
  // Currently selected cell id (e.g., "A1")
  const [selectedCell, setSelectedCell] = useState("A1");
  // Formula bar value (controlled input)
  const [formula, setFormula] = useState("");

  // When selecting a cell, update formula bar with cell content
  function handleCellClick(row, col) {
    const cellId = getCellId(row, col);
    setSelectedCell(cellId);
    setFormula(cells[cellId] || "");
  }

  // When editing formula bar, update cell content and formula state
  function handleFormulaChange(e) {
    const value = e.target.value;
    setFormula(value);
    setCells((prev) => ({
      ...prev,
      [selectedCell]: value,
    }));
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 10 }}>
      {/* Formula Bar */}
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: 60,
            fontWeight: "bold",
            backgroundColor: "#eee",
            padding: "4px 8px",
            border: "1px solid #ccc",
            borderRadius: 4,
            textAlign: "center",
            userSelect: "none",
          }}
        >
          {selectedCell}
        </div>
        <input
          type="text"
          value={formula}
          onChange={handleFormulaChange}
          style={{
            flex: 1,
            marginLeft: 8,
            padding: "6px 8px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 4,
          }}
          placeholder="Enter formula or value"
        />
      </div>
    </div>
  );
}
