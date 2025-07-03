/**
 * Handles column selection by selecting an entire column from top to bottom
 * @param {number} colIndex - The index of the column to select
 * @param {Object} currentSelection - Current selection state (unused but kept for API consistency)
 * @param {Function} setSelection - Function to update the selection state
 * @param {Function} setSelected - Function to update the selected cell state
 * @param {number} totalRows - Total number of rows in the grid
 */
export const handleColumnSelection = (colIndex, currentSelection, setSelection, setSelected, totalRows) => {
  // Select entire column from row 0 to totalRows-1
  setSelection({
    startRow: 0,
    startCol: colIndex,
    endRow: totalRows - 1,
    endCol: colIndex,
    isRange: true
  });
  
  // Set the selected cell to the top of the column
  setSelected({ r: 0, c: colIndex });
};

/**
 * Handles row selection by selecting an entire row from left to right
 * @param {number} rowIndex - The index of the row to select
 * @param {Object} currentSelection - Current selection state (unused but kept for API consistency)
 * @param {Function} setSelection - Function to update the selection state
 * @param {Function} setSelected - Function to update the selected cell state
 * @param {number} totalCols - Total number of columns in the grid
 */
export const handleRowSelection = (rowIndex, currentSelection, setSelection, setSelected, totalCols) => {
  // Select entire row from column 0 to totalCols-1
  setSelection({
    startRow: rowIndex,
    startCol: 0,
    endRow: rowIndex,
    endCol: totalCols - 1,
    isRange: true
  });
  
  // Set the selected cell to the left of the row
  setSelected({ r: rowIndex, c: 0 });
};

// Cache for column widths cumulative sum - improves performance for repeated calculations
let columnWidthsCache = new Map();
let lastColWidthsMap = null;

// Cache for row heights cumulative sum - improves performance for repeated calculations
let rowHeightsCache = new Map();
let lastRowHeightsMap = null;

/**
 * Calculates and caches cumulative column widths for efficient position calculations
 * @param {Map} colWidths - Map of column indices to their widths
 * @param {number} totalCols - Total number of columns in the grid
 * @returns {Map} Map of column indices to their cumulative widths from the start
 */
const getCumulativeColumnWidths = (colWidths, totalCols) => {
  // Check if we need to rebuild cache
  if (lastColWidthsMap !== colWidths) {
    columnWidthsCache.clear();
    let cumulative = 0;
    for (let i = 0; i < totalCols; i++) {
      columnWidthsCache.set(i, cumulative);
      cumulative += colWidths.get(i) || 80; // Default width of 80px
    }
    columnWidthsCache.set(totalCols, cumulative); // Total width
    lastColWidthsMap = colWidths;
  }
  return columnWidthsCache;
};

/**
 * Calculates and caches cumulative row heights for efficient position calculations
 * @param {Map} rowHeights - Map of row indices to their heights
 * @param {number} totalRows - Total number of rows in the grid
 * @returns {Map} Map of row indices to their cumulative heights from the start
 */
const getCumulativeRowHeights = (rowHeights, totalRows) => {
  // Check if we need to rebuild cache
  if (lastRowHeightsMap !== rowHeights) {
    rowHeightsCache.clear();
    let cumulative = 0;
    for (let i = 0; i < totalRows; i++) {
      rowHeightsCache.set(i, cumulative);
      cumulative += rowHeights.get(i) || 24; // Default height of 24px
    }
    rowHeightsCache.set(totalRows, cumulative); // Total height
    lastRowHeightsMap = rowHeights;
  }
  return rowHeightsCache;
};

/**
 * Uses binary search to efficiently find which column contains a given X position
 * @param {number} targetX - The X coordinate to find the column for
 * @param {Map} colWidths - Map of column indices to their widths
 * @param {number} totalCols - Total number of columns in the grid
 * @param {Map} cumulativeWidths - Pre-calculated cumulative widths for performance
 * @returns {number|null} The column index at the target position, or null if not found
 */
const findColumnAtPosition = (targetX, colWidths, totalCols, cumulativeWidths) => {
  let left = 0;
  let right = totalCols - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const startX = cumulativeWidths.get(mid);
    const endX = startX + (colWidths.get(mid) || 80);
    
    if (targetX >= startX && targetX < endX) {
      return mid;
    } else if (targetX < startX) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return null;
};

/**
 * Uses binary search to efficiently find which row contains a given Y position
 * @param {number} targetY - The Y coordinate to find the row for
 * @param {Map} rowHeights - Map of row indices to their heights
 * @param {number} totalRows - Total number of rows in the grid
 * @param {Map} cumulativeHeights - Pre-calculated cumulative heights for performance
 * @returns {number|null} The row index at the target position, or null if not found
 */
const findRowAtPosition = (targetY, rowHeights, totalRows, cumulativeHeights) => {
  let left = 0;
  let right = totalRows - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const startY = cumulativeHeights.get(mid);
    const endY = startY + (rowHeights.get(mid) || 24);
    
    if (targetY >= startY && targetY < endY) {
      return mid;
    } else if (targetY < startY) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }
  return null;
};

/**
 * Determines which column was clicked based on mouse coordinates in the column header
 * @param {number} x - Mouse X coordinate relative to the canvas
 * @param {number} y - Mouse Y coordinate relative to the canvas
 * @param {number} rowHeaderWidth - Width of the row header area
 * @param {number} colHeaderHeight - Height of the column header area
 * @param {number} scrollLeft - Current horizontal scroll position
 * @param {Map} colWidths - Map of column indices to their widths
 * @param {number} totalCols - Total number of columns in the grid
 * @param {number} canvasWidth - Total width of the canvas
 * @returns {number|null} The column index that was clicked, or null if click was outside column headers
 */
export const getColumnFromHeaderClick = (x, y, rowHeaderWidth, colHeaderHeight, scrollLeft, colWidths, totalCols, canvasWidth) => {
  // Quick boundary check - must be in column header area
  if (y > colHeaderHeight || x < rowHeaderWidth) return null;
  
  // Get cumulative widths for fast lookup
  const cumulativeWidths = getCumulativeColumnWidths(colWidths, totalCols);
  
  // Calculate the actual X position relative to the grid, accounting for scroll
  const relativeX = x - rowHeaderWidth + scrollLeft;
  
  // Use binary search to find the column
  return findColumnAtPosition(relativeX, colWidths, totalCols, cumulativeWidths);
};

/**
 * Determines which row was clicked based on mouse coordinates in the row header
 * @param {number} x - Mouse X coordinate relative to the canvas
 * @param {number} y - Mouse Y coordinate relative to the canvas
 * @param {number} rowHeaderWidth - Width of the row header area
 * @param {number} colHeaderHeight - Height of the column header area
 * @param {number} scrollTop - Current vertical scroll position
 * @param {Map} rowHeights - Map of row indices to their heights
 * @param {number} totalRows - Total number of rows in the grid
 * @param {number} canvasHeight - Total height of the canvas
 * @returns {number|null} The row index that was clicked, or null if click was outside row headers
 */
export const getRowFromHeaderClick = (x, y, rowHeaderWidth, colHeaderHeight, scrollTop, rowHeights, totalRows, canvasHeight) => {
  // Quick boundary check - must be in row header area
  if (x > rowHeaderWidth || y < colHeaderHeight) return null;
  
  // Get cumulative heights for fast lookup
  const cumulativeHeights = getCumulativeRowHeights(rowHeights, totalRows);
  
  // Calculate the actual Y position relative to the grid, accounting for scroll
  const relativeY = y - colHeaderHeight + scrollTop;
  
  // Use binary search to find the row
  return findRowAtPosition(relativeY, rowHeights, totalRows, cumulativeHeights);
};

// Pre-computed selection bounds for faster checking - cached for performance
let selectionBounds = null;
let lastSelection = null;

/**
 * Calculates and caches the bounding box of the current selection for efficient range checking
 * @param {Object} selection - Current selection object with startRow, startCol, endRow, endCol, isRange
 * @returns {Object|null} Bounding box with minRow, maxRow, minCol, maxCol, or null if no range selection
 */
const getSelectionBounds = (selection) => {
  if (lastSelection !== selection) {
    if (selection.isRange) {
      selectionBounds = {
        minRow: Math.min(selection.startRow, selection.endRow),
        maxRow: Math.max(selection.startRow, selection.endRow),
        minCol: Math.min(selection.startCol, selection.endCol),
        maxCol: Math.max(selection.startCol, selection.endCol)
      };
    } else {
      selectionBounds = null;
    }
    lastSelection = selection;
  }
  return selectionBounds;
};

/**
 * Checks if a specific column is within the current selection
 * @param {number} col - Column index to check
 * @param {Object} selected - Currently selected cell {r: row, c: col}
 * @param {Object} selection - Current selection object
 * @param {number} totalRows - Total number of rows in the grid (unused but kept for API consistency)
 * @param {number} totalCols - Total number of columns in the grid (unused but kept for API consistency)
 * @returns {boolean} True if the column is within the selection
 */
export const isColumnInSelection = (col, selected, selection, totalRows, totalCols) => {
  if (!selection.isRange) {
    return col === selected.c;
  }
  
  const bounds = getSelectionBounds(selection);
  return bounds && col >= bounds.minCol && col <= bounds.maxCol;
};

/**
 * Checks if a specific row is within the current selection
 * @param {number} row - Row index to check
 * @param {Object} selected - Currently selected cell {r: row, c: col}
 * @param {Object} selection - Current selection object
 * @param {number} totalRows - Total number of rows in the grid (unused but kept for API consistency)
 * @param {number} totalCols - Total number of columns in the grid (unused but kept for API consistency)
 * @returns {boolean} True if the row is within the selection
 */
export const isRowInSelection = (row, selected, selection, totalRows, totalCols) => {
  if (!selection.isRange) {
    return row === selected.r;
  }
  
  const bounds = getSelectionBounds(selection);
  return bounds && row >= bounds.minRow && row <= bounds.maxRow;
};

/**
 * Checks if an entire column is selected (column is selected AND selection spans all rows)
 * @param {number} col - Column index to check
 * @param {Object} selected - Currently selected cell {r: row, c: col}
 * @param {Object} selection - Current selection object
 * @param {number} totalRows - Total number of rows in the grid
 * @param {number} totalCols - Total number of columns in the grid (unused but kept for API consistency)
 * @returns {boolean} True if the entire column is selected
 */
export const isEntireColumnSelected = (col, selected, selection, totalRows, totalCols) => {
  if (!selection.isRange) return false;
  
  const bounds = getSelectionBounds(selection);
  if (!bounds) return false;
  
  // Check if this column is selected AND the selection spans all rows
  return (col >= bounds.minCol && col <= bounds.maxCol) && 
         (bounds.minRow === 0 && bounds.maxRow === totalRows - 1);
};

/**
 * Checks if an entire row is selected (row is selected AND selection spans all columns)
 * @param {number} row - Row index to check
 * @param {Object} selected - Currently selected cell {r: row, c: col}
 * @param {Object} selection - Current selection object
 * @param {number} totalRows - Total number of rows in the grid (unused but kept for API consistency)
 * @param {number} totalCols - Total number of columns in the grid
 * @returns {boolean} True if the entire row is selected
 */
export const isEntireRowSelected = (row, selected, selection, totalRows, totalCols) => {
  if (!selection.isRange) return false;
  
  const bounds = getSelectionBounds(selection);
  if (!bounds) return false;
  
  // Check if this row is selected AND the selection spans all columns
  return (row >= bounds.minRow && row <= bounds.maxRow) && 
         (bounds.minCol === 0 && bounds.maxCol === totalCols - 1);
};

/**
 * Calculates the range of columns that are currently visible in the viewport
 * Uses binary search for optimal performance with large datasets
 * @param {number} scrollLeft - Current horizontal scroll position
 * @param {number} canvasWidth - Total width of the canvas
 * @param {number} rowHeaderWidth - Width of the row header area
 * @param {Map} colWidths - Map of column indices to their widths
 * @param {number} totalCols - Total number of columns in the grid
 * @returns {Object} Object with startCol and endCol indices of visible columns
 */
export const getVisibleColRangeWithWidths = (scrollLeft, canvasWidth, rowHeaderWidth, colWidths, totalCols) => {
  const cumulativeWidths = getCumulativeColumnWidths(colWidths, totalCols);
  const viewportWidth = canvasWidth - rowHeaderWidth;
  
  // Binary search for start column - find the leftmost visible column
  let startCol = 0;
  let left = 0;
  let right = totalCols - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const cumWidth = cumulativeWidths.get(mid);
    
    if (cumWidth <= scrollLeft) {
      startCol = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // Find end column - iterate from start column until we exceed viewport width
  let endCol = startCol;
  let currentWidth = cumulativeWidths.get(startCol);
  const maxWidth = scrollLeft + viewportWidth;
  
  while (endCol < totalCols && currentWidth < maxWidth) {
    currentWidth += colWidths.get(endCol) || 80;
    endCol++;
  }
  
  return { startCol, endCol: Math.min(endCol + 1, totalCols) };
};

/**
 * Calculates the range of rows that are currently visible in the viewport
 * Uses binary search for optimal performance with large datasets
 * @param {number} scrollTop - Current vertical scroll position
 * @param {number} canvasHeight - Total height of the canvas
 * @param {number} colHeaderHeight - Height of the column header area
 * @param {Map} rowHeights - Map of row indices to their heights
 * @param {number} totalRows - Total number of rows in the grid
 * @returns {Object} Object with startRow and endRow indices of visible rows
 */
export const getVisibleRowRangeWithHeights = (scrollTop, canvasHeight, colHeaderHeight, rowHeights, totalRows) => {
  const cumulativeHeights = getCumulativeRowHeights(rowHeights, totalRows);
  const viewportHeight = canvasHeight - colHeaderHeight;
  
  // Binary search for start row - find the topmost visible row
  let startRow = 0;
  let left = 0;
  let right = totalRows - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const cumHeight = cumulativeHeights.get(mid);
    
    if (cumHeight <= scrollTop) {
      startRow = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  // Find end row - iterate from start row until we exceed viewport height
  let endRow = startRow;
  let currentHeight = cumulativeHeights.get(startRow);
  const maxHeight = scrollTop + viewportHeight;
  
  while (endRow < totalRows && currentHeight < maxHeight) {
    currentHeight += rowHeights.get(endRow) || 24;
    endRow++;
  }
  
  return { startRow, endRow: Math.min(endRow + 1, totalRows) };
};