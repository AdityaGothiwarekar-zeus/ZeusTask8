/**
 * Converts a zero-based column index to Excel-style column letters (A, B, ..., Z, AA, AB, ...)
 * @param {number} n - Zero-based column index
 * @returns {string} - Corresponding column letter(s)
 */
export function getColLetter(n) {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Calculates statistics (count, sum, average, min, max) for numeric values in the selected cell range
 * @param {Object} cellData - Object storing cell values, keys are "row,col"
 * @param {Object} selection - Current selection with startRow, endRow, startCol, endCol, isRange
 * @returns {Object|null} - Statistics object or null if no numeric values or invalid selection
 */
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

/**
 * Computes the visible row range based on scroll position and viewport size for virtualization
 * @param {number} scrollTop - Current vertical scroll position in pixels
 * @param {number} ROW_HEIGHT - Height of a single row in pixels
 * @param {number} CANVAS_HEIGHT - Height of the visible canvas area in pixels
 * @param {number} COL_HEADER_HEIGHT - Height of the column header area in pixels
 * @param {number} TOTAL_ROWS - Total number of rows in the spreadsheet
 * @returns {Object} - Visible range with startRow and endRow indices
 */
export function getVisibleRowRange(scrollTop, ROW_HEIGHT, CANVAS_HEIGHT, COL_HEADER_HEIGHT, TOTAL_ROWS) {
  const startRow = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleRowsInCanvas = Math.floor((CANVAS_HEIGHT - COL_HEADER_HEIGHT) / ROW_HEIGHT) + 2; // buffer rows for smooth scrolling
  const endRow = Math.min(startRow + visibleRowsInCanvas, TOTAL_ROWS);
  return { startRow, endRow };
}

/**
 * Handles undo operation by moving one step backward in history
 * @param {Array<Object>} history - Array of cellData snapshots representing history states
 * @param {number} historyIndex - Current index in the history
 * @returns {Object|null} - Object with updated historyIndex and cellData, or null if undo not possible
 */
export const handleUndo = (history, historyIndex) => {
  if (historyIndex > 0) {
    return {
      newHistoryIndex: historyIndex - 1,
      newCellData: history[historyIndex - 1],
    };
  }
  return null; // nothing to undo
};

/**
 * Handles redo operation by moving one step forward in history
 * @param {Array<Object>} history - Array of cellData snapshots representing history states
 * @param {number} historyIndex - Current index in the history
 * @returns {Object|null} - Object with updated historyIndex and cellData, or null if redo not possible
 */
export const handleRedo = (history, historyIndex) => {
  if (historyIndex < history.length - 1) {
    return {
      newHistoryIndex: historyIndex + 1,
      newCellData: history[historyIndex + 1],
    };
  }
  return null; // nothing to redo
};

/**
 * Copies cell values from the current selection into a 2D array format for clipboard
 * @param {Object} cellData - Object storing cell values keyed by "row,col"
 * @param {Object} selection - Current selection range with startRow, endRow, startCol, endCol
 * @returns {Object} - Clipboard data containing 2D array `data` and `cut` flag set to false
 */
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

/**
 * Cuts (copies and deletes) cell values from the current selection
 * @param {Object} cellData - Object storing cell values keyed by "row,col"
 * @param {Object} selection - Current selection range
 * @returns {Object} - Object containing clipboard data and updated cellData with deleted cells
 */
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

/**
 * Pastes clipboard data starting at the currently selected cell position
 * @param {Object} cellData - Current cell data object
 * @param {Object|null} clipboard - Clipboard object containing `data` array and `cut` flag
 * @param {Object} selected - Selected cell coordinates {r, c}
 * @param {number} TOTAL_ROWS - Total number of rows to limit pasting
 * @param {number} TOTAL_COLS - Total number of columns to limit pasting
 * @returns {Object|null} - Updated cellData with pasted content or null if no clipboard
 */
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

/**
 * Deletes all cell values within the selected range
 * @param {Object} cellData - Current cell data object
 * @param {Object} selection - Current selection range
 * @returns {Object} - New cellData object with selected cells deleted
 */
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

/**
 * Returns a selection object representing the entire spreadsheet range (select all)
 * @param {number} TOTAL_ROWS - Total rows in spreadsheet
 * @param {number} TOTAL_COLS - Total columns in spreadsheet
 * @returns {Object} - Selection object covering full sheet
 */
export const handleSelectAll = (TOTAL_ROWS, TOTAL_COLS) => {
  return {
    startRow: 0,
    startCol: 0,
    endRow: TOTAL_ROWS - 1,
    endCol: TOTAL_COLS - 1,
    isRange: true,
  };
};

/**
 * Generates a downloadable URL containing the JSON stringified cellData for saving
 * @param {Object} cellData - Current cell data object
 * @returns {string} - Blob URL to be used for file download
 */
export const handleSave = (cellData) => {
  const dataBlob = new Blob([JSON.stringify(cellData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(dataBlob);
  return url; // Caller responsible for using <a> element to download
};

/**
 * Loads data (e.g. from a JSON import) into the cellData structure
 * Assumes first row of data array contains headers (keys)
 * @param {Array<Object>} data - Array of objects representing rows with key-value pairs
 * @param {number} TOTAL_ROWS - Max number of rows allowed in spreadsheet
 * @param {number} TOTAL_COLS - Max number of columns allowed
 * @returns {Object|null} - New cellData object populated from data or null if invalid input
 */
export const handleLoadData = (data, TOTAL_ROWS, TOTAL_COLS) => {
  if (!Array.isArray(data) || data.length === 0) return null;

  const headers = Object.keys(data[0]);
  const newData = {};

  // Load headers into first row (0)
  headers.forEach((header, colIndex) => {
    if (colIndex < TOTAL_COLS) {
      newData[`0,${colIndex}`] = header;
    }
  });

  // Load data rows starting from second row (1)
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
