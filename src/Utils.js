
export function getColLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

// Calculate statistics for selected range
export function calculateStats(cellData, selection) {
  if (!selection.isRange) return null;
  
  const { startRow, endRow, startCol, endCol } = selection;
  const values = [];
  
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const key = `${r},${c}`;
      const val = cellData[key];
      if (val && !isNaN(parseFloat(val))) {
        values.push(parseFloat(val));
      }
    }
  }
  
  if (values.length === 0) return null;
  
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const count = values.length;
  
  return { count, sum, avg, min, max };
}

export function getVisibleRowRange(scrollTop, ROW_HEIGHT, CANVAS_HEIGHT, COL_HEADER_HEIGHT, TOTAL_ROWS) {
  const startRow = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleRowsInCanvas = Math.floor((CANVAS_HEIGHT - COL_HEADER_HEIGHT) / ROW_HEIGHT) + 2;
  const endRow = Math.min(startRow + visibleRowsInCanvas, TOTAL_ROWS);
  return { startRow, endRow };
}

export const handleUndo = (history, historyIndex) => {
  if (historyIndex > 0) {
    return {
      newHistoryIndex: historyIndex - 1,
      newCellData: history[historyIndex - 1],
    };
  }
  return null; // nothing to undo
};

export const handleRedo = (history, historyIndex) => {
  if (historyIndex < history.length - 1) {
    return {
      newHistoryIndex: historyIndex + 1,
      newCellData: history[historyIndex + 1],
    };
  }
  return null; // nothing to redo
};

export const handleCopy = (cellData, selection) => {
  const data = [];
  for (let r = selection.startRow; r <= selection.endRow; r++) {
    const row = [];
    for (let c = selection.startCol; c <= selection.endCol; c++) {
      const key = `${r},${c}`;
      row.push(cellData[key] || '');
    }
    data.push(row);
  }
  return { data, cut: false };
};

export const handleCut = (cellData, selection) => {
  const clipboard = handleCopy(cellData, selection);
  clipboard.cut = true;

  // Delete cells in selection
  const newData = { ...cellData };
  for (let r = selection.startRow; r <= selection.endRow; r++) {
    for (let c = selection.startCol; c <= selection.endCol; c++) {
      const key = `${r},${c}`;
      delete newData[key];
    }
  }

  return { clipboard, newData };
};

export const handlePaste = (cellData, clipboard, selected, TOTAL_ROWS, TOTAL_COLS) => {
  if (!clipboard) return null;

  const newData = { ...cellData };
  const { data } = clipboard;

  for (let r = 0; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const targetRow = selected.r + r;
      const targetCol = selected.c + c;
      if (targetRow < TOTAL_ROWS && targetCol < TOTAL_COLS) {
        const key = `${targetRow},${targetCol}`;
        newData[key] = data[r][c];
      }
    }
  }

  return newData;
};

export const handleDelete = (cellData, selection) => {
  const newData = { ...cellData };
  for (let r = selection.startRow; r <= selection.endRow; r++) {
    for (let c = selection.startCol; c <= selection.endCol; c++) {
      const key = `${r},${c}`;
      delete newData[key];
    }
  }
  return newData;
};

export const handleSelectAll = (TOTAL_ROWS, TOTAL_COLS) => {
  return {
    startRow: 0,
    startCol: 0,
    endRow: TOTAL_ROWS - 1,
    endCol: TOTAL_COLS - 1,
    isRange: true,
  };
};

export const handleSave = (cellData) => {
  const dataBlob = new Blob([JSON.stringify(cellData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(dataBlob);
  return url; // Caller responsible for creating <a> and downloading
};

export const handleLoadData = (data, TOTAL_ROWS, TOTAL_COLS) => {
  if (!Array.isArray(data) || data.length === 0) return null;

  const headers = Object.keys(data[0]);
  const newData = {};

  headers.forEach((header, colIndex) => {
    if (colIndex < TOTAL_COLS) {
      newData[`0,${colIndex}`] = header;
    }
  });

  data.forEach((row, rowIndex) => {
    if (rowIndex + 1 < TOTAL_ROWS) {
      headers.forEach((header, colIndex) => {
        if (colIndex < TOTAL_COLS) {
          newData[`${rowIndex + 1},${colIndex}`] = String(row[header] ?? '');
        }
      });
    }
  });

  return newData;
};
