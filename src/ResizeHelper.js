// ResizeHelper.js - Helper functions for row and column resizing

export const RESIZE_HANDLE_WIDTH = 4; // Width of the resize handle area
export const MIN_COL_WIDTH = 20;
export const MIN_ROW_HEIGHT = 16;

/**
 * Check if pointer is over a column resize handle
 */
export const getColumnResizeHandle = (x, y, scrollLeft, colHeaderHeight, rowHeaderWidth, colWidths, totalCols) => {
  if (y > colHeaderHeight) return null;
  if (x < rowHeaderWidth) return null;

  let currentX = rowHeaderWidth;
  let visibleCol = 0;
  
  // Find which column based on scroll position
  let scrollOffset = 0;
  for (let c = 0; c < totalCols && scrollOffset < scrollLeft; c++) {
    const colWidth = colWidths.get(c) || 80; // Default width
    if (scrollOffset + colWidth > scrollLeft) {
      visibleCol = c;
      currentX = rowHeaderWidth - (scrollLeft - scrollOffset);
      break;
    }
    scrollOffset += colWidth;
  }

  // Check each visible column's right edge
  for (let c = visibleCol; c < totalCols; c++) {
    const colWidth = colWidths.get(c) || 80;
    currentX += colWidth;
    
    if (currentX > x + 1000) break; // Stop checking if we're way past the visible area
    
    // Check if we're near the right edge of this column
    if (Math.abs(x - currentX) <= RESIZE_HANDLE_WIDTH / 2) {
      return c;
    }
  }
  
  return null;
};

/**
 * Check if pointer is over a row resize handle
 */
export const getRowResizeHandle = (x, y, scrollTop, colHeaderHeight, rowHeaderWidth, rowHeights, totalRows) => {
  if (x > rowHeaderWidth) return null;
  if (y < colHeaderHeight) return null;

  let currentY = colHeaderHeight;
  let visibleRow = 0;
  
  // Find which row based on scroll position
  let scrollOffset = 0;
  for (let r = 0; r < totalRows && scrollOffset < scrollTop; r++) {
    const rowHeight = rowHeights.get(r) || 24; // Default height
    if (scrollOffset + rowHeight > scrollTop) {
      visibleRow = r;
      currentY = colHeaderHeight - (scrollTop - scrollOffset);
      break;
    }
    scrollOffset += rowHeight;
  }

  // Check each visible row's bottom edge
  for (let r = visibleRow; r < totalRows; r++) {
    const rowHeight = rowHeights.get(r) || 24;
    currentY += rowHeight;
    
    if (currentY > y + 1000) break; // Stop checking if we're way past the visible area
    
    // Check if we're near the bottom edge of this row
    if (Math.abs(y - currentY) <= RESIZE_HANDLE_WIDTH / 2) {
      return r;
    }
  }
  
  return null;
};

/**
 * Calculate total width up to a specific column
 */
export const getTotalWidthToColumn = (colIndex, colWidths) => {
  let totalWidth = 0;
  for (let c = 0; c < colIndex; c++) {
    totalWidth += colWidths.get(c) || 80;
  }
  return totalWidth;
};

/**
 * Calculate total height up to a specific row
 */
export const getTotalHeightToRow = (rowIndex, rowHeights) => {
  let totalHeight = 0;
  for (let r = 0; r < rowIndex; r++) {
    totalHeight += rowHeights.get(r) || 24;
  }
  return totalHeight;
};

/**
 * Get visible column range with custom widths
 */
export const getVisibleColRangeWithWidths = (scrollLeft, canvasWidth, rowHeaderWidth, colWidths, totalCols) => {
  let currentX = 0;
  let startCol = 0;
  let endCol = 0;
  
  // Find start column
  for (let c = 0; c < totalCols; c++) {
    const colWidth = colWidths.get(c) || 80;
    if (currentX + colWidth > scrollLeft) {
      startCol = c;
      break;
    }
    currentX += colWidth;
  }
  
  // Find end column
  const visibleWidth = canvasWidth - rowHeaderWidth;
  currentX = getTotalWidthToColumn(startCol, colWidths) - scrollLeft;
  
  for (let c = startCol; c < totalCols; c++) {
    const colWidth = colWidths.get(c) || 80;
    if (currentX > visibleWidth) {
      endCol = c;
      break;
    }
    currentX += colWidth;
    endCol = c + 1;
  }
  
  return { startCol, endCol };
};

/**
 * Get visible row range with custom heights
 */
export const getVisibleRowRangeWithHeights = (scrollTop, canvasHeight, colHeaderHeight, rowHeights, totalRows) => {
  let currentY = 0;
  let startRow = 0;
  let endRow = 0;
  
  // Find start row
  for (let r = 0; r < totalRows; r++) {
    const rowHeight = rowHeights.get(r) || 24;
    if (currentY + rowHeight > scrollTop) {
      startRow = r;
      break;
    }
    currentY += rowHeight;
  }
  
  // Find end row
  const visibleHeight = canvasHeight - colHeaderHeight;
  currentY = getTotalHeightToRow(startRow, rowHeights) - scrollTop;
  
  for (let r = startRow; r < totalRows; r++) {
    const rowHeight = rowHeights.get(r) || 24;
    if (currentY > visibleHeight) {
      endRow = r;
      break;
    }
    currentY += rowHeight;
    endRow = r + 1;
  }
  
  return { startRow, endRow };
};

/**
 * Get cell coordinates from pointer with custom widths/heights
 */
export const getCellFromPointerWithSizes = (x, y, scrollLeft, scrollTop, colHeaderHeight, rowHeaderWidth, colWidths, rowHeights, totalCols, totalRows) => {
  if (x < rowHeaderWidth || y < colHeaderHeight) return null;

  const { startCol } = getVisibleColRangeWithWidths(scrollLeft, x + 1000, rowHeaderWidth, colWidths, totalCols);
  const { startRow } = getVisibleRowRangeWithHeights(scrollTop, y + 1000, colHeaderHeight, rowHeights, totalRows);

  // Find exact column
  let currentX = rowHeaderWidth;
  let targetCol = startCol;
  
  const scrollOffsetX = getTotalWidthToColumn(startCol, colWidths) - scrollLeft;
  currentX += scrollOffsetX;
  
  for (let c = startCol; c < totalCols; c++) {
    const colWidth = colWidths.get(c) || 80;
    if (x >= currentX && x < currentX + colWidth) {
      targetCol = c;
      break;
    }
    currentX += colWidth;
  }

  // Find exact row
  let currentY = colHeaderHeight;
  let targetRow = startRow;
  
  const scrollOffsetY = getTotalHeightToRow(startRow, rowHeights) - scrollTop;
  currentY += scrollOffsetY;
  
  for (let r = startRow; r < totalRows; r++) {
    const rowHeight = rowHeights.get(r) || 24;
    if (y >= currentY && y < currentY + rowHeight) {
      targetRow = r;
      break;
    }
    currentY += rowHeight;
  }

  if (targetCol >= 0 && targetCol < totalCols && targetRow >= 0 && targetRow < totalRows) {
    return { r: targetRow, c: targetCol };
  }
  return null;
};

/**
 * Calculate total scroll width with custom column widths
 */
export const getTotalScrollWidth = (colWidths, totalCols) => {
  let totalWidth = 0;
  for (let c = 0; c < totalCols; c++) {
    totalWidth += colWidths.get(c) || 80;
  }
  return totalWidth;
};

/**
 * Calculate total scroll height with custom row heights
 */
export const getTotalScrollHeight = (rowHeights, totalRows) => {
  let totalHeight = 0;
  for (let r = 0; r < totalRows; r++) {
    totalHeight += rowHeights.get(r) || 24;
  }
  return totalHeight;
};

/**
 * Handle column resize operation
 */
export const handleColumnResize = (colIndex, newWidth, colWidths, setColWidths, addToHistory) => {
  const clampedWidth = Math.max(MIN_COL_WIDTH, newWidth);
  const newColWidths = new Map(colWidths);
  newColWidths.set(colIndex, clampedWidth);
  setColWidths(newColWidths);
  
  // Add to history for undo/redo
  if (addToHistory) {
    addToHistory({ type: 'resize', colWidths: newColWidths });
  }
};

/**
 * Handle row resize operation
 */
export const handleRowResize = (rowIndex, newHeight, rowHeights, setRowHeights, addToHistory) => {
  const clampedHeight = Math.max(MIN_ROW_HEIGHT, newHeight);
  const newRowHeights = new Map(rowHeights);
  newRowHeights.set(rowIndex, clampedHeight);
  setRowHeights(newRowHeights);
  
  // Add to history for undo/redo
  if (addToHistory) {
    addToHistory({ type: 'resize', rowHeights: newRowHeights });
  }
};