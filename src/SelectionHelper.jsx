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

/**
 * Handles click on the top-left corner to select all cells
 * @param {number} x - X coordinate of the click
 * @param {number} y - Y coordinate of the click
 * @param {number} rowHeaderWidth - Width of the row header area
 * @param {number} colHeaderHeight - Height of the column header area
 * @param {Function} setSelection - Function to update selection state
 * @param {Function} setSelected - Function to update selected cell
 * @param {number} totalRows - Total number of rows
 * @param {number} totalCols - Total number of columns
 * @returns {boolean} - True if select all was triggered, false otherwise
 */
export const handleSelectAllClick = (x, y, rowHeaderWidth, colHeaderHeight, setSelection, setSelected, totalRows, totalCols) => {
  // Check if click is in the top-left corner (select all area)
  if (x >= 0 && x <= rowHeaderWidth && y >= 0 && y <= colHeaderHeight) {
    setSelection({
      startRow: 0,
      endRow: totalRows - 1,
      startCol: 0,
      endCol: totalCols - 1,
      isRange: true
    });
    setSelected({ r: 0, c: 0 });
    return true;
  }
  return false;
};