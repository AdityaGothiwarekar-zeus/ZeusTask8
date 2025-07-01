import React, { useRef } from 'react';
import './Header.css';
import { insertRow , insertColumn } from '../../Utils';

function Header({
  onLoadData,
  onFontChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onCopy,
  onPaste,
  onCut,
   cellData,
  selected,
  setCellData,
  addToHistory,
  setSelected
}) {
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          onLoadData(data);
        } catch (error) {
          alert('Error parsing JSON file');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleInsertRow = () => {
    const newData = insertRow(cellData, selected.r);
    setCellData(newData);
    addToHistory(newData);
    setSelected(prev => ({ ...prev, r: prev.r + 1 }));
  };
  
  const handleInsertColumn = () => {
    const newData = insertColumn(cellData, selected.c);
    setCellData(newData);
    addToHistory(newData);
    setSelected({
    type: 'column',
    c: selected.c + 1, // new inserted column
    r: null // not selecting a row
  });
  };
  

  return (
    <div className="header-component">
      <h2 className="header-title">Advanced Spreadsheet</h2>

      <div className="button-group">
        <button onClick={() => fileInputRef.current?.click()}>📁 Load JSON</button>
        {/* <button onClick={onSave}>💾 Save</button> */}
      </div>

      <div className="button-group">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↷ Redo</button>
        <button onClick={handleInsertRow}>Insert Row</button>
        <button onClick={handleInsertColumn}>Insert Column</button>
      </div>

      <div className="button-group">
        <button onClick={onCopy} title="Copy (Ctrl+C)">📋 Copy</button>
        <button onClick={onPaste} title="Paste (Ctrl+V)">📄 Paste</button>
        {/* <button onClick={onCut} title="Cut (Ctrl+X)">✂️ Cut</button> */}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      <select onChange={(e) => onFontChange(e.target.value)} defaultValue="Arial">
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Helvetica">Helvetica</option>
      </select>
    </div>
  );
}

export default Header;
