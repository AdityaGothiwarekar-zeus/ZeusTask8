// Helper functions for column and row selection

/**
 * Handles column header click to select entire column
 * @param {number} colIndex - The column index that was clicked
 * @param {Object} currentSelection - Current selection state
 * @param {Function} setSelection - Function to update selection state
 * @param {Function} setSelected - Function to update selected cell
 * @param {number} totalRows - Total number of rows in the spreadsheet
 */
export const handleColumnSelection = (colIndex, _currentSelection, setSelection, setSelected, totalRows) => {
  // Always select just this one column
  const newSelection = {
    startRow: 0,
    endRow: totalRows - 1,
    startCol: colIndex,
    endCol: colIndex,
    isRange: true
  };
  setSelection(newSelection);
  setSelected({ r: 0, c: colIndex });
};


/**
 * Handles row header click to select entire row
 * @param {number} rowIndex - The row index that was clicked
 * @param {Object} currentSelection - Current selection state
 * @param {Function} setSelection - Function to update selection state
 * @param {Function} setSelected - Function to update selected cell
 * @param {number} totalCols - Total number of columns in the spreadsheet
 */
export const handleRowSelection = (rowIndex, _currentSelection, setSelection, setSelected, totalCols) => {
  // Always select just this one row
  const newSelection = {
    startRow: rowIndex,
    endRow: rowIndex,
    startCol: 0,
    endCol: totalCols - 1,
    isRange: true
  };
  setSelection(newSelection);
  setSelected({ r: rowIndex, c: 0 });
};


/**
 * Checks if a click occurred on a column header
 * @param {number} x - X coordinate of the click
 * @param {number} y - Y coordinate of the click
 * @param {number} rowHeaderWidth - Width of the row header area
 * @param {number} colHeaderHeight - Height of the column header area
 * @param {number} colWidth - Width of each column
 * @param {number} totalCols - Total number of columns
 * @returns {number|null} - Column index if clicked on header, null otherwise
 */
export const getColumnFromHeaderClick = (x, y, rowHeaderWidth, colHeaderHeight, colWidth, totalCols) => {
  // Check if click is in column header area
  if (y >= 0 && y <= colHeaderHeight && x >= rowHeaderWidth) {
    const colIndex = Math.floor((x - rowHeaderWidth) / colWidth);
    if (colIndex >= 0 && colIndex < totalCols) {
      return colIndex;
    }
  }
  return null;
};

/**
 * Checks if a click occurred on a row header
 * @param {number} x - X coordinate of the click
 * @param {number} y - Y coordinate of the click
 * @param {number} rowHeaderWidth - Width of the row header area
 * @param {number} colHeaderHeight - Height of the column header area
 * @param {number} rowHeight - Height of each row
 * @param {number} startRow - First visible row index
 * @param {number} totalRows - Total number of rows
 * @returns {number|null} - Row index if clicked on header, null otherwise
 */
export const getRowFromHeaderClick = (x, y, rowHeaderWidth, colHeaderHeight, rowHeight, startRow, totalRows) => {
  // Check if click is in row header area
  if (x >= 0 && x <= rowHeaderWidth && y >= colHeaderHeight) {
    const canvasRowIndex = Math.floor((y - colHeaderHeight) / rowHeight);
    const rowIndex = startRow + canvasRowIndex;
    if (rowIndex >= 0 && rowIndex < totalRows) {
      return rowIndex;
    }
  }
  return null;
};


// selectionUtils.js

/**
 * Checks if a column should be highlighted based on current selection
 * @param {number} col - The column index to check
 * @param {Object} selected - The currently selected cell {r, c}
 * @param {Object} selection - The selection object {isRange, startRow, endRow, startCol, endCol}
 * @param {number} TOTAL_ROWS - Total number of rows in the spreadsheet
 * @param {number} TOTAL_COLS - Total number of columns in the spreadsheet
 * @returns {boolean} - Whether the column should be highlighted
 */
export const isColumnInSelection = (col, selected, selection, TOTAL_ROWS, TOTAL_COLS) => {
  // Current selected cell column
  if (col === selected.c) return true;
  
  // Check if entire columns are selected
  const isEntireColSelected = selection.isRange && 
    selection.startRow === 0 && 
    selection.endRow === TOTAL_ROWS - 1;
  if (isEntireColSelected && col >= selection.startCol && col <= selection.endCol) return true;
  
  // Check if entire rows are selected (all columns should be highlighted)
  const isEntireRowSelected = selection.isRange &&
    selection.startCol === 0 &&
    selection.endCol === TOTAL_COLS - 1;
  if (isEntireRowSelected) return true;
  
  // Check if column is in range selection
  if (selection.isRange && col >= selection.startCol && col <= selection.endCol) return true;
  
  return false;
};

/**
 * Checks if a row should be highlighted based on current selection
 * @param {number} row - The row index to check
 * @param {Object} selected - The currently selected cell {r, c}
 * @param {Object} selection - The selection object {isRange, startRow, endRow, startCol, endCol}
 * @param {number} TOTAL_ROWS - Total number of rows in the spreadsheet
 * @param {number} TOTAL_COLS - Total number of columns in the spreadsheet
 * @returns {boolean} - Whether the row should be highlighted
 */
export const isRowInSelection = (row, selected, selection, TOTAL_ROWS, TOTAL_COLS) => {
  // Current selected cell row
  if (row === selected.r) return true;
  
  // Check if entire rows are selected
  const isEntireRowSelected = selection.isRange &&
    selection.startCol === 0 &&
    selection.endCol === TOTAL_COLS - 1;
  if (isEntireRowSelected && row >= selection.startRow && row <= selection.endRow) return true;
  
  // Check if entire columns are selected (all rows should be highlighted)
  const isEntireColSelected = selection.isRange && 
    selection.startRow === 0 && 
    selection.endRow === TOTAL_ROWS - 1;
  if (isEntireColSelected) return true;
  
  // Check if row is in range selection
  if (selection.isRange && row >= selection.startRow && row <= selection.endRow) return true;
  
  return false;
};
