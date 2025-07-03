
import React, { useRef, useEffect, useState, useCallback } from 'react';
import "./Grid.css"
import StatsPanel from './ExcelFormulaBar';
import Header from '../Navbar/Header';
import { getColLetter, calculateStats } from '../../Utils'
import { getVisibleRowRange , getVisibleColRange } from '../../Utils';
import { 
  getColumnResizeHandle, 
  getRowResizeHandle, 
  handleColumnResize, 
  handleRowResize,
  getVisibleColRangeWithWidths,
  getVisibleRowRangeWithHeights,
  getCellFromPointerWithSizes,
  getTotalScrollWidth,
  getTotalScrollHeight,
  RESIZE_HANDLE_WIDTH,
  MIN_COL_WIDTH,
  MIN_ROW_HEIGHT 
} from '../../ResizeHelper';
import { 
  handleColumnSelection, 
  handleRowSelection, 
  getColumnFromHeaderClick, 
  getRowFromHeaderClick,
  isColumnInSelection,
  isRowInSelection ,
  isEntireColumnSelected,
  isEntireRowSelected  
} from '../../SelectionHelper';
import { insertRow , insertColumn } from '../../Utils';

const TOTAL_ROWS = 100000;
const TOTAL_COLS = 500; // A-Z columns
const COL_WIDTH = 80;
const ROW_HEIGHT = 24;
const ROW_HEADER_WIDTH = 60;
const COL_HEADER_HEIGHT = 24;
let dpr = window.getdevicePixelRatio || 1;
const CANVAS_WIDTH = 1880;
const CANVAS_HEIGHT = 850;

export default function GridPage() {
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const cellInputRef = useRef(null);
  const horizontalScrollRef = useRef(null);
  const [cellData, setCellData] = useState(new Map());
  const [selected, setSelected] = useState({ r: 0, c: 0 });
  const [selection, setSelection] = useState({ 
    startRow: 0, 
    startCol: 0, 
    endRow: 0, 
    endCol: 0, 
    isRange: false 
  });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [isSelecting, setIsSelecting] = useState(false);
  const [history, setHistory] = useState([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [clipboard, setClipboard] = useState(null);
  
  // New state for direct cell editing
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editPosition, setEditPosition] = useState({ x: 0, y: 0, width: COL_WIDTH, height: ROW_HEIGHT });

  // Add state for tracking pointer/touch
  const [pointerDownId, setPointerDownId] = useState(null);
  const [startSelection, setStartSelection] = useState(null);
  const [shiftKey, setShiftKey] = useState(false);
  

  // Add state for auto-scrolling
  const [autoScrollInterval, setAutoScrollInterval] = useState(null);

  //resize helper hooks
  const [colWidths, setColWidths] = useState(new Map());
  const [rowHeights, setRowHeights] = useState(new Map());
  const [isResizing, setIsResizing] = useState(false);
  const [resizeType, setResizeType] = useState(null); // 'column' or 'row'
  const [resizeIndex, setResizeIndex] = useState(null);
  const [resizeStartPos, setResizeStartPos] = useState(0);
  const [resizeStartSize, setResizeStartSize] = useState(0);
  
  // Add state for header selection
  const [isSelectingHeader, setIsSelectingHeader] = useState(false);
  const [headerSelectionType, setHeaderSelectionType] = useState(null); // 'column' or 'row'
  
  // Calculate statistics for current selection
  const stats = calculateStats(cellData, selection);

  // Calculate which rows should be visible based on scroll position
  const visibleRange = getVisibleRowRange(scrollTop, ROW_HEIGHT, CANVAS_HEIGHT, COL_HEADER_HEIGHT, TOTAL_ROWS);

const drawGrid = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas physical size (scaled by dpr)
  canvas.width = CANVAS_WIDTH * dpr;
  canvas.height = CANVAS_HEIGHT * dpr;

  // Set canvas style size (logical dimensions)
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${CANVAS_HEIGHT}px`;

  // Scale drawing context
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // Clear and set font
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.font = `14px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 0.4 / dpr;

  // Use the new helper functions for visible ranges
  const { startRow, endRow } = getVisibleRowRangeWithHeights(scrollTop, CANVAS_HEIGHT, COL_HEADER_HEIGHT, rowHeights, TOTAL_ROWS);
  const { startCol, endCol } = getVisibleColRangeWithWidths(scrollLeft, CANVAS_WIDTH, ROW_HEADER_WIDTH, colWidths, TOTAL_COLS);

  // Draw top-left corner (select all)
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);
  ctx.strokeStyle = '#d8d9db';
  ctx.strokeRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

  // === Column Headers ===
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(ROW_HEADER_WIDTH, 0, CANVAS_WIDTH - ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

  let currentX = ROW_HEADER_WIDTH;
  // Calculate starting X position based on ONLY horizontal scroll
  let scrollOffsetX = 0;
  for (let c = 0; c < startCol; c++) {
    scrollOffsetX += colWidths.get(c) || COL_WIDTH;
  }
  currentX -= (scrollLeft - scrollOffsetX);

  for (let c = startCol; c < endCol; c++) {
    const colWidth = colWidths.get(c) || COL_WIDTH;
    if (currentX >= CANVAS_WIDTH) break;

    const shouldHighlight = isColumnInSelection(c, selected, selection, TOTAL_ROWS, TOTAL_COLS);
    const isEntireColumn = isEntireColumnSelected(c, selected, selection, TOTAL_ROWS, TOTAL_COLS);

    // Background color
    ctx.fillStyle = shouldHighlight ? (isEntireColumn ? '#0F7937' : '#caead8') : '#f0f0f0';
    ctx.fillRect(currentX, 0, colWidth, COL_HEADER_HEIGHT);

    // Text color
    ctx.fillStyle = shouldHighlight ? (isEntireColumn ? 'white' : '#0F7937') : 'black';
    ctx.textAlign = 'center';
    ctx.fillText(getColLetter(c), currentX + colWidth / 2, COL_HEADER_HEIGHT / 2);

    // Borders
    ctx.strokeStyle = '#d8d9db';
    ctx.strokeRect(currentX, 0, colWidth, COL_HEADER_HEIGHT);

    if (shouldHighlight) {
      ctx.strokeStyle = '#0F7937';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, COL_HEADER_HEIGHT - 1);
      ctx.lineTo(currentX + colWidth, COL_HEADER_HEIGHT - 1);
      ctx.stroke();
      ctx.lineWidth = 0.4 / dpr;
    }

    currentX += colWidth;
  }

  // === Row Headers ===
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, CANVAS_HEIGHT - COL_HEADER_HEIGHT);

  let currentY = COL_HEADER_HEIGHT;
  // Calculate starting Y position based on ONLY vertical scroll
  let scrollOffsetY = 0;
  for (let r = 0; r < startRow; r++) {
    scrollOffsetY += rowHeights.get(r) || ROW_HEIGHT;
  }
  currentY -= (scrollTop - scrollOffsetY);

  for (let r = startRow; r < endRow; r++) {
    const rowHeight = rowHeights.get(r) || ROW_HEIGHT;
    if (currentY >= CANVAS_HEIGHT) break;

    const shouldHighlight = isRowInSelection(r, selected, selection, TOTAL_ROWS, TOTAL_COLS);
    const isEntireRow = isEntireRowSelected(r, selected, selection, TOTAL_ROWS, TOTAL_COLS);

    // Background
    ctx.fillStyle = shouldHighlight ? (isEntireRow ? '#0F7937' : '#caead8') : '#f0f0f0';
    ctx.fillRect(0, currentY, ROW_HEADER_WIDTH, rowHeight);

    // Text color
    ctx.fillStyle = shouldHighlight ? (isEntireRow ? 'white' : '#0F7937') : 'black';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(r + 1, ROW_HEADER_WIDTH - 5, currentY + rowHeight / 2);

    // Border
    ctx.strokeStyle = '#d8d9db';
    ctx.strokeRect(0, currentY, ROW_HEADER_WIDTH, rowHeight);

    if (shouldHighlight) {
      ctx.strokeStyle = '#0F7937';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ROW_HEADER_WIDTH - 1, currentY);
      ctx.lineTo(ROW_HEADER_WIDTH - 1, currentY + rowHeight);
      ctx.stroke();
      ctx.lineWidth = 0.4 / dpr;
    }

    currentY += rowHeight;
  }

  // === Cells ===
  // IMPORTANT: Clip the cell drawing area to prevent overlap with headers
  ctx.save();
  ctx.beginPath();
  ctx.rect(ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, CANVAS_WIDTH - ROW_HEADER_WIDTH, CANVAS_HEIGHT - COL_HEADER_HEIGHT);
  ctx.clip();

  // Reset currentY for cells (same calculation as row headers)
  currentY = COL_HEADER_HEIGHT;
  scrollOffsetY = 0;
  for (let r = 0; r < startRow; r++) {
    scrollOffsetY += rowHeights.get(r) || ROW_HEIGHT;
  }
  currentY -= (scrollTop - scrollOffsetY);

  for (let r = startRow; r < endRow; r++) {
    const rowHeight = rowHeights.get(r) || ROW_HEIGHT;
    if (currentY >= CANVAS_HEIGHT) break;

    // Reset currentX for each row (same calculation as column headers)
    currentX = ROW_HEADER_WIDTH;
    scrollOffsetX = 0;
    for (let c = 0; c < startCol; c++) {
      scrollOffsetX += colWidths.get(c) || COL_WIDTH;
    }
    currentX -= (scrollLeft - scrollOffsetX);

    for (let c = startCol; c < endCol; c++) {
      const colWidth = colWidths.get(c) || COL_WIDTH;
      if (currentX >= CANVAS_WIDTH) break;

      const key = `${r},${c}`;
      const isCurrent = r === selected.r && c === selected.c;

      // Define the selection bounds
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      // Is this cell part of the selection?
      const isInSelection = selection.isRange &&
        r >= minRow && r <= maxRow &&
        c >= minCol && c <= maxCol;

      // Is this the visual top-left cell of the selection?
      const isFirstSelected = isInSelection &&
        r === selection.startRow &&
        c === selection.startCol;

      // Set background
      let bgColor = 'white';
      if (isInSelection) {
        bgColor = isFirstSelected ? 'white' : '#f1faf1';
      } else if (isCurrent) {
        bgColor = '#f1faf1';
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(currentX, currentY, colWidth, rowHeight);

      // Cell border
      ctx.strokeStyle = '#d8d9db';
      ctx.strokeRect(currentX + 0.5, currentY + 0.5, colWidth - 1, rowHeight - 1);
      ctx.lineWidth = 0.4;

      // Cell content
      const val = cellData[key];
      if (val && !(isEditing && isCurrent)) {
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.fillText(String(val).substring(0, 10), currentX + 4, currentY + rowHeight / 2);
      }

      currentX += colWidth;
    }
    currentY += rowHeight;
  }

  // Restore the clipping context
  ctx.restore();

  // === Selection Border ===
  if (selection.isRange) {
    const selStartRow = Math.max(selection.startRow, startRow);
    const selEndRow = Math.min(selection.endRow, endRow - 1);
    const selStartCol = Math.max(selection.startCol, startCol);
    const selEndCol = Math.min(selection.endCol, endCol - 1);

    if (selStartRow <= selEndRow && selStartCol <= selEndCol) {
      // Calculate Y positions (vertical scroll affects this)
      let selStartY = COL_HEADER_HEIGHT;
      let selEndY = COL_HEADER_HEIGHT;
      
      scrollOffsetY = 0;
      for (let r = 0; r < startRow; r++) {
        scrollOffsetY += rowHeights.get(r) || ROW_HEIGHT;
      }
      selStartY -= (scrollTop - scrollOffsetY);

      for (let r = startRow; r <= selStartRow; r++) {
        if (r === selStartRow) break;
        selStartY += rowHeights.get(r) || ROW_HEIGHT;
      }

      selEndY = selStartY;
      for (let r = selStartRow; r <= selEndRow; r++) {
        selEndY += rowHeights.get(r) || ROW_HEIGHT;
      }

      // Calculate X positions (horizontal scroll affects this)
      let selStartX = ROW_HEADER_WIDTH;
      let selWidth = 0;

      scrollOffsetX = 0;
      for (let c = 0; c < startCol; c++) {
        scrollOffsetX += colWidths.get(c) || COL_WIDTH;
      }
      selStartX -= (scrollLeft - scrollOffsetX);

      for (let c = startCol; c <= selStartCol; c++) {
        if (c === selStartCol) break;
        selStartX += colWidths.get(c) || COL_WIDTH;
      }

      for (let c = selStartCol; c <= selEndCol; c++) {
        selWidth += colWidths.get(c) || COL_WIDTH;
      }

      // Only draw selection border if it's within the cell area
      if (selStartY >= COL_HEADER_HEIGHT && selStartX >= ROW_HEADER_WIDTH) {
        ctx.strokeStyle = '#0F7937';
        ctx.lineWidth = 2;
        ctx.strokeRect(selStartX, selStartY, selWidth, selEndY - selStartY);
        ctx.lineWidth = 1.5;
      }
    }
  } else {
    // Single cell border with custom size
    if (selected.r >= startRow && selected.r < endRow && selected.c >= startCol && selected.c < endCol) {
      // Calculate Y position (vertical scroll affects this)
      let selY = COL_HEADER_HEIGHT;
      
      scrollOffsetY = 0;
      for (let r = 0; r < startRow; r++) {
        scrollOffsetY += rowHeights.get(r) || ROW_HEIGHT;
      }
      selY -= (scrollTop - scrollOffsetY);

      for (let r = startRow; r <= selected.r; r++) {
        if (r === selected.r) break;
        selY += rowHeights.get(r) || ROW_HEIGHT;
      }

      // Calculate X position (horizontal scroll affects this)
      let selX = ROW_HEADER_WIDTH;
      
      scrollOffsetX = 0;
      for (let c = 0; c < startCol; c++) {
        scrollOffsetX += colWidths.get(c) || COL_WIDTH;
      }
      selX -= (scrollLeft - scrollOffsetX);

      for (let c = startCol; c <= selected.c; c++) {
        if (c === selected.c) break;
        selX += colWidths.get(c) || COL_WIDTH;
      }

      const cellWidth = colWidths.get(selected.c) || COL_WIDTH;
      const cellHeight = rowHeights.get(selected.r) || ROW_HEIGHT;

      // Only draw selection border if it's within the cell area
      if (selY >= COL_HEADER_HEIGHT && selX >= ROW_HEADER_WIDTH) {
        ctx.strokeStyle = '#0F7937';
        ctx.lineWidth = 2;
        ctx.strokeRect(selX, selY, cellWidth, cellHeight);
        ctx.lineWidth = 1.5;
      }
    }
  }
}, [cellData, selected, selection, scrollTop, scrollLeft, fontFamily, colWidths, rowHeights, isEditing]);

  // ... keep existing code (useEffect, addToHistory, startEditing, finishEditing functions)

  useEffect(() => {
    window.addEventListener('resize', drawGrid);
    window.addEventListener('scroll', drawGrid);
    drawGrid();

    return () => {
      window.removeEventListener('resize', drawGrid);
      window.removeEventListener('scroll', drawGrid);
    };
  }, [drawGrid]);

  const addToHistory = useCallback((newData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ ...newData });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // startEditing cells
  const startEditing = useCallback((row, col) => {
  const canvasRect = canvasRef.current?.getBoundingClientRect();
  if (!canvasRect) return;

  // Use the helper functions to get visible ranges with custom sizes
  const { startRow } = getVisibleRowRangeWithHeights(scrollTop, CANVAS_HEIGHT, COL_HEADER_HEIGHT, rowHeights, TOTAL_ROWS);
  const { startCol } = getVisibleColRangeWithWidths(scrollLeft, CANVAS_WIDTH, ROW_HEADER_WIDTH, colWidths, TOTAL_COLS);

  // Calculate X position accounting for custom column widths
  let x = canvasRect.left + ROW_HEADER_WIDTH;
  let scrollOffsetX = 0;
  for (let c = 0; c < startCol; c++) {
    scrollOffsetX += colWidths.get(c) || COL_WIDTH;
  }
  x -= (scrollLeft - scrollOffsetX);

  for (let c = startCol; c < col; c++) {
    x += colWidths.get(c) || COL_WIDTH;
  }

  // Calculate Y position accounting for custom row heights
  let y = canvasRect.top + COL_HEADER_HEIGHT;
  let scrollOffsetY = 0;
  for (let r = 0; r < startRow; r++) {
    scrollOffsetY += rowHeights.get(r) || ROW_HEIGHT;
  }
  y -= (scrollTop - scrollOffsetY);

  for (let r = startRow; r < row; r++) {
    y += rowHeights.get(r) || ROW_HEIGHT;
  }

  const key = `${row},${col}`;
  const currentValue = cellData[key] || '';

  // Get the actual cell dimensions
  const cellWidth = colWidths.get(col) || COL_WIDTH;
  const cellHeight = rowHeights.get(row) || ROW_HEIGHT;

  setEditValue(currentValue);
  setEditPosition({ x, y, width: cellWidth, height: cellHeight });
  setIsEditing(true);
  
  // Focus the input after state update
  setTimeout(() => {
    if (cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, 0);
}, [cellData, scrollTop, scrollLeft, colWidths, rowHeights]);

  const finishEditing = useCallback((save = true, moveToNext = false) => {
    if (!isEditing) return;

    if (save) {
      const key = `${selected.r},${selected.c}`;
      const newData = { ...cellData };
      
      if (editValue.trim() === '') {
        delete newData[key];
      } else {
        newData[key] = editValue;
      }
      
      setCellData(newData);
      addToHistory(newData);
    }

    setIsEditing(false);
    setEditValue('');
    
    // Move to next row if requested and not at the bottom
    if (moveToNext && selected.r < TOTAL_ROWS - 1) {
      const newRow = selected.r + 1;
      const newCol = selected.c;
      
      // Update selection immediately
      setSelected({ r: newRow, c: newCol });
      setSelection({
        startRow: newRow,
        startCol: newCol,
        endRow: newRow,
        endCol: newCol,
        isRange: false
      });
      
      // Handle scrolling
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const rowPosition = newRow * ROW_HEIGHT;
          const containerHeight = CANVAS_HEIGHT - COL_HEADER_HEIGHT;
          const currentScrollTop = scrollContainerRef.current.scrollTop;
          const visibleEnd = currentScrollTop + containerHeight;
          
          // Check if we need to scroll down
          if (rowPosition + ROW_HEIGHT > visibleEnd) {
            const newScrollTop = rowPosition - containerHeight + ROW_HEIGHT;
            scrollContainerRef.current.scrollTop = newScrollTop;
          }
          // Check if we need to scroll up (shouldn't happen with Enter, but just in case)
          else if (rowPosition < currentScrollTop) {
            scrollContainerRef.current.scrollTop = rowPosition;
          }
        }
        
        // Handle horizontal scrolling if needed
        if (horizontalScrollRef.current) {
          const colPosition = newCol * COL_WIDTH;
          const containerWidth = CANVAS_WIDTH - ROW_HEADER_WIDTH;
          const currentScrollLeft = horizontalScrollRef.current.scrollLeft;
          const visibleRightEnd = currentScrollLeft + containerWidth;
          
          if (colPosition + COL_WIDTH > visibleRightEnd) {
            horizontalScrollRef.current.scrollLeft = colPosition - containerWidth + COL_WIDTH;
          } else if (colPosition < currentScrollLeft) {
            horizontalScrollRef.current.scrollLeft = colPosition;
          }
        }
        
        // Return focus to canvas
        if (canvasRef.current) {
          canvasRef.current.focus();
        }
      });
    } else {
      // Return focus to canvas immediately if not moving
      requestAnimationFrame(() => {
        if (canvasRef.current) {
          canvasRef.current.focus();
        }
      });
    }
  }, [isEditing, editValue, selected, cellData, addToHistory, TOTAL_ROWS, ROW_HEIGHT, CANVAS_HEIGHT, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, CANVAS_WIDTH, COL_WIDTH]);

  // Helper function to get cell coordinates from pointer event
const getCellFromPointer = useCallback((e) => {
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return null;

  // Calculate column using custom widths
  const { startCol } = getVisibleColRangeWithWidths(scrollLeft, CANVAS_WIDTH, ROW_HEADER_WIDTH, colWidths, TOTAL_COLS);
  
  let currentX = ROW_HEADER_WIDTH;
  let scrollOffsetX = 0;
  for (let c = 0; c < startCol; c++) {
    scrollOffsetX += colWidths.get(c) || COL_WIDTH;
  }
  currentX -= (scrollLeft - scrollOffsetX);

  let c = -1;
  for (let col = startCol; col < TOTAL_COLS; col++) {
    const colWidth = colWidths.get(col) || COL_WIDTH;
    if (x >= currentX && x < currentX + colWidth) {
      c = col;
      break;
    }
    currentX += colWidth;
    if (currentX > CANVAS_WIDTH) break;
  }

  // Calculate row using custom heights
  const { startRow } = getVisibleRowRangeWithHeights(scrollTop, CANVAS_HEIGHT, COL_HEADER_HEIGHT, rowHeights, TOTAL_ROWS);
  
  let currentY = COL_HEADER_HEIGHT;
  let scrollOffsetY = 0;
  for (let r = 0; r < startRow; r++) {
    scrollOffsetY += rowHeights.get(r) || ROW_HEIGHT;
  }
  currentY -= (scrollTop - scrollOffsetY);

  let r = -1;
  for (let row = startRow; row < TOTAL_ROWS; row++) {
    const rowHeight = rowHeights.get(row) || ROW_HEIGHT;
    if (y >= currentY && y < currentY + rowHeight) {
      r = row;
      break;
    }
    currentY += rowHeight;
    if (currentY > CANVAS_HEIGHT) break;
  }

  if (c >= 0 && c < TOTAL_COLS && r >= 0 && r < TOTAL_ROWS) {
    return { r, c };
  }
  return null;
}, [scrollLeft, scrollTop, colWidths, rowHeights]);

  const handlePointerDown = useCallback((e) => {
  console.log("pointer down", e.pointerId);
  
  e.preventDefault();
  
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check for resize handles first
  const colResizeHandle = getColumnResizeHandle(x, y, scrollLeft, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, colWidths, TOTAL_COLS);
  const rowResizeHandle = getRowResizeHandle(x, y, scrollTop, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, rowHeights, TOTAL_ROWS);

  if (colResizeHandle !== null) {
    // If we're currently editing, finish editing first
    if (isEditing) {
      finishEditing(true);
    }
    
    setIsResizing(true);
    setResizeType('column');
    setResizeIndex(colResizeHandle);
    setResizeStartPos(x);
    setResizeStartSize(colWidths.get(colResizeHandle) || COL_WIDTH);
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
    }
    setPointerDownId(e.pointerId);
    return;
  }

  if (rowResizeHandle !== null) {
    // If we're currently editing, finish editing first
    if (isEditing) {
      finishEditing(true);
    }
    
    setIsResizing(true);
    setResizeType('row');
    setResizeIndex(rowResizeHandle);
    setResizeStartPos(y);
    setResizeStartSize(rowHeights.get(rowResizeHandle) || ROW_HEIGHT);
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
    }
    setPointerDownId(e.pointerId);
    return;
  }

  // Store shift key state
  setShiftKey(e.shiftKey);

  // If we're currently editing, finish editing first
  if (isEditing) {
    finishEditing(true);
  }

  // Check for column header click
  const colIndex = getColumnFromHeaderClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, scrollLeft, colWidths, TOTAL_COLS, CANVAS_WIDTH);
  if (colIndex !== null) {
    handleColumnSelection(colIndex, selection, setSelection, setSelected, TOTAL_ROWS);
    setIsSelectingHeader(true);
    setHeaderSelectionType('column');
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
    }
    setPointerDownId(e.pointerId);
    return;
  }

  // Check for row header click
  const rowIndex = getRowFromHeaderClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, scrollTop, rowHeights, TOTAL_ROWS, CANVAS_HEIGHT);
  if (rowIndex !== null) {
    handleRowSelection(rowIndex, selection, setSelection, setSelected, TOTAL_COLS);
    setIsSelectingHeader(true);
    setHeaderSelectionType('row');
    if (canvasRef.current) {
      canvasRef.current.setPointerCapture(e.pointerId);
    }
    setPointerDownId(e.pointerId);
    return;
  }

  // Regular cell selection
  const cell = getCellFromPointer(e);
  if (!cell) return;

  const { r, c } = cell;

  // Capture the pointer
  if (canvasRef.current) {
    canvasRef.current.setPointerCapture(e.pointerId);
  }

  setPointerDownId(e.pointerId);
  setStartSelection({ r, c });
  setSelected({ r, c });
  setSelection({ 
    startRow: r, 
    startCol: c, 
    endRow: r, 
    endCol: c, 
    isRange: false 
  });
  setIsSelecting(true);
}, [getCellFromPointer, isEditing, finishEditing, selection, scrollLeft, scrollTop, colWidths, rowHeights]);

  // Add this new function for checking resize cursors
const updateCursor = useCallback((e) => {
  if (isResizing) return;

  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const colResizeHandle = getColumnResizeHandle(x, y, scrollLeft, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, colWidths, TOTAL_COLS);
  const rowResizeHandle = getRowResizeHandle(x, y, scrollTop, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, rowHeights, TOTAL_ROWS);

  if (colResizeHandle !== null) {
    canvasRef.current.style.cursor = 'col-resize';
  } else if (rowResizeHandle !== null) {
    canvasRef.current.style.cursor = 'row-resize';
  } else {
    canvasRef.current.style.cursor = 'default';
  }
}, [scrollLeft, scrollTop, colWidths, rowHeights, isResizing]);

 const handlePointerMove = useCallback((e) => {
  // Handle cursor updates when not selecting
  if (!isSelecting && !isResizing && !isSelectingHeader) {
    updateCursor(e);
  }

  // Handle resizing
  if (isResizing && e.pointerId === pointerDownId) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (resizeType === 'column') {
      const delta = x - resizeStartPos;
      const newWidth = resizeStartSize + delta;
      handleColumnResize(resizeIndex, newWidth, colWidths, setColWidths, addToHistory);
    } else if (resizeType === 'row') {
      const delta = y - resizeStartPos;
      const newHeight = resizeStartSize + delta;
      handleRowResize(resizeIndex, newHeight, rowHeights, setRowHeights, addToHistory);
    }
    return;
  }

  // Handle header selection (extending column/row selection)
  if (isSelectingHeader && e.pointerId === pointerDownId) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (headerSelectionType === 'column') {
      const colIndex = getColumnFromHeaderClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, scrollLeft, colWidths, TOTAL_COLS, CANVAS_WIDTH);
      if (colIndex !== null) {
        const currentStartCol = selection.startCol;
        const minCol = Math.min(currentStartCol, colIndex);
        const maxCol = Math.max(currentStartCol, colIndex);
        
        setSelection({
          startRow: 0,
          startCol: minCol,
          endRow: TOTAL_ROWS - 1,
          endCol: maxCol,
          isRange: true
        });
      }
    } else if (headerSelectionType === 'row') {
      const rowIndex = getRowFromHeaderClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, scrollTop, rowHeights, TOTAL_ROWS, CANVAS_HEIGHT);
      if (rowIndex !== null) {
        const currentStartRow = selection.startRow;
        const minRow = Math.min(currentStartRow, rowIndex);
        const maxRow = Math.max(currentStartRow, rowIndex);
        
        setSelection({
          startRow: minRow,
          startCol: 0,
          endRow: maxRow,
          endCol: TOTAL_COLS - 1,
          isRange: true
        });
      }
    }
    return;
  }

  // Rest of existing cell selection logic
  if (!isSelecting || e.pointerId !== pointerDownId || !startSelection) return;
  
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Calculate scroll values using custom sizes
  const totalScrollHeight = getTotalScrollHeight(rowHeights, TOTAL_ROWS);
  const totalScrollWidth = getTotalScrollWidth(colWidths, TOTAL_COLS);

  // Auto-scroll logic (same as before)
  const scrollSpeed = 20;
  const scrollZone = 50;
  let shouldScrollLeft = false;
  let shouldScrollRight = false;
  let shouldScrollUp = false;
  let shouldScrollDown = false;

  if (x < ROW_HEADER_WIDTH + scrollZone && x > ROW_HEADER_WIDTH) {
    shouldScrollLeft = true;
  } else if (x > CANVAS_WIDTH - scrollZone) {
    shouldScrollRight = true;
  }

  if (y < COL_HEADER_HEIGHT + scrollZone && y > COL_HEADER_HEIGHT) {
    shouldScrollUp = true;
  } else if (y > CANVAS_HEIGHT - scrollZone) {
    shouldScrollDown = true;
  }

  // Clear existing auto-scroll
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    setAutoScrollInterval(null);
  }

  // Start auto-scrolling if needed
  if (shouldScrollLeft || shouldScrollRight || shouldScrollUp || shouldScrollDown) {
    const interval = setInterval(() => {
      if (shouldScrollLeft && horizontalScrollRef.current) {
        const newScrollLeft = Math.max(0, horizontalScrollRef.current.scrollLeft - scrollSpeed);
        horizontalScrollRef.current.scrollLeft = newScrollLeft;
        setScrollLeft(newScrollLeft);
      }
      if (shouldScrollRight && horizontalScrollRef.current) {
        const maxScrollLeft = totalScrollWidth - (CANVAS_WIDTH - ROW_HEADER_WIDTH);
        const newScrollLeft = Math.min(maxScrollLeft, horizontalScrollRef.current.scrollLeft + scrollSpeed);
        horizontalScrollRef.current.scrollLeft = newScrollLeft;
        setScrollLeft(newScrollLeft);
      }
      if (shouldScrollUp && scrollContainerRef.current) {
        const newScrollTop = Math.max(0, scrollContainerRef.current.scrollTop - scrollSpeed);
        scrollContainerRef.current.scrollTop = newScrollTop;
        setScrollTop(newScrollTop);
      }
      if (shouldScrollDown && scrollContainerRef.current) {
        const maxScrollTop = totalScrollHeight - (CANVAS_HEIGHT - COL_HEADER_HEIGHT);
        const newScrollTop = Math.min(maxScrollTop, scrollContainerRef.current.scrollTop + scrollSpeed);
        scrollContainerRef.current.scrollTop = newScrollTop;
        setScrollTop(newScrollTop);
      }
    }, 30);
    
    setAutoScrollInterval(interval);
  }

  // Get cell coordinates
  const cell = getCellFromPointer(e);
  if (!cell) {
    if (shouldScrollLeft || shouldScrollRight || shouldScrollUp || shouldScrollDown) {
      const { startCol } = getVisibleColRangeWithWidths(scrollLeft, CANVAS_WIDTH, ROW_HEADER_WIDTH, colWidths, TOTAL_COLS);
      const { startRow } = getVisibleRowRangeWithHeights(scrollTop, CANVAS_HEIGHT, COL_HEADER_HEIGHT, rowHeights, TOTAL_ROWS);
      
      let targetCol = startCol;
      let targetRow = startRow;
      
      if (shouldScrollLeft) {
        targetCol = Math.max(0, startCol - 1);
      } else if (shouldScrollRight) {
        // Calculate how many columns fit in the visible area
        let visibleCols = 0;
        let currentWidth = 0;
        const maxWidth = CANVAS_WIDTH - ROW_HEADER_WIDTH;
        for (let c = startCol; c < TOTAL_COLS && currentWidth < maxWidth; c++) {
          currentWidth += colWidths.get(c) || COL_WIDTH;
          visibleCols++;
        }
        targetCol = Math.min(TOTAL_COLS - 1, startCol + visibleCols);
      }
      
      if (shouldScrollUp) {
        targetRow = Math.max(0, startRow - 1);
      } else if (shouldScrollDown) {
        // Calculate how many rows fit in the visible area
        let visibleRows = 0;
        let currentHeight = 0;
        const maxHeight = CANVAS_HEIGHT - COL_HEADER_HEIGHT;
        for (let r = startRow; r < TOTAL_ROWS && currentHeight < maxHeight; r++) {
          currentHeight += rowHeights.get(r) || ROW_HEIGHT;
          visibleRows++;
        }
        targetRow = Math.min(TOTAL_ROWS - 1, startRow + visibleRows);
      }
      
      const newSelection = {
        startRow: Math.min(startSelection.r, targetRow),
        endRow: Math.max(startSelection.r, targetRow),
        startCol: Math.min(startSelection.c, targetCol),
        endCol: Math.max(startSelection.c, targetCol),
        isRange: startSelection.r !== targetRow || startSelection.c !== targetCol
      };
      setSelection(newSelection);
    }
    return;
  }

  const { r, c } = cell;

  // Update selection
  const newSelection = {
    startRow: Math.min(startSelection.r, r),
    endRow: Math.max(startSelection.r, r),
    startCol: Math.min(startSelection.c, c),
    endCol: Math.max(startSelection.c, c),
    isRange: startSelection.r !== r || startSelection.c !== c
  };
  setSelection(newSelection);
}, [isSelecting, isResizing, isSelectingHeader, pointerDownId, startSelection, getCellFromPointer, autoScrollInterval, scrollLeft, scrollTop, colWidths, rowHeights, updateCursor, resizeType, resizeIndex, resizeStartPos, resizeStartSize, addToHistory, selection, headerSelectionType]);

const handlePointerUp = useCallback((e) => {
  if (e.pointerId === pointerDownId) {
    console.log("pointer up", e.pointerId);
    
    if (isResizing) {
      setIsResizing(false);
      setResizeType(null);
      setResizeIndex(null);
      setResizeStartPos(0);
      setResizeStartSize(0);
    }
    
    setIsSelecting(false);
    setIsSelectingHeader(false);
    setHeaderSelectionType(null);
    setPointerDownId(null);
    setStartSelection(null);
    setShiftKey(false);
    
    // Clear auto-scroll interval
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
    
    // Release pointer capture
    if (canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
  }
}, [pointerDownId, autoScrollInterval, isResizing, isSelectingHeader]);

const handlePointerCancel = useCallback((e) => {
  if (e.pointerId === pointerDownId) {
    console.log("pointer cancel", e.pointerId);
    
    if (isResizing) {
      setIsResizing(false);
      setResizeType(null);
      setResizeIndex(null);
      setResizeStartPos(0);
      setResizeStartSize(0);
    }
    
    setIsSelecting(false);
    setIsSelectingHeader(false);
    setHeaderSelectionType(null);
    setPointerDownId(null);
    setStartSelection(null);
    setShiftKey(false);
    
    // Clear auto-scroll interval
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
  }
}, [pointerDownId, autoScrollInterval, isResizing, isSelectingHeader]);

  // ... keep existing code (handleDoubleClick, useEffect for auto-scroll cleanup, etc.)

  // Double click/tap handler
  const handleDoubleClick = useCallback((e) => {
    const cell = getCellFromPointer(e);
    if (!cell) return;

    const { r, c } = cell;
    startEditing(r, c);
  }, [getCellFromPointer, startEditing]);

  // Add cleanup effect for auto-scroll interval
  useEffect(() => {
    return () => {
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
      }
    };
  }, [autoScrollInterval]);

  // Auto-scroll effect for selection changes
  useEffect(() => {
    if (!isEditing && scrollContainerRef.current && horizontalScrollRef.current) {
      const rowPosition = selected.r * ROW_HEIGHT;
      const containerHeight = CANVAS_HEIGHT - COL_HEADER_HEIGHT;
      const currentScrollTop = scrollContainerRef.current.scrollTop;
      const visibleEnd = currentScrollTop + containerHeight;
      
      // Auto-scroll vertically if needed
      if (rowPosition + ROW_HEIGHT > visibleEnd) {
        scrollContainerRef.current.scrollTop = rowPosition - containerHeight + ROW_HEIGHT;
      } else if (rowPosition < currentScrollTop) {
        scrollContainerRef.current.scrollTop = rowPosition;
      }
      
      // Auto-scroll horizontally if needed
      const colPosition = selected.c * COL_WIDTH;
      const containerWidth = CANVAS_WIDTH - ROW_HEADER_WIDTH;
      const currentScrollLeft = horizontalScrollRef.current.scrollLeft;
      const visibleRightEnd = currentScrollLeft + containerWidth;
      
      if (colPosition + COL_WIDTH > visibleRightEnd) {
        horizontalScrollRef.current.scrollLeft = colPosition - containerWidth + COL_WIDTH;
      } else if (colPosition < currentScrollLeft) {
        horizontalScrollRef.current.scrollLeft = colPosition;
      }
    }
  }, [selected.r, selected.c, isEditing]);

  // ... keep existing code (handleKeyDown, handleVerticalScroll, handleHorizontalScroll, and all other functions)

  const handleKeyDown = (e) => {
    // If we're editing, handle edit-specific keys
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing(true, true); // Save and move to next row
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing(false); // Cancel without saving
      }
      return;
    }

    // Handle Ctrl combinations
    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          handleUndo();
          return;
        case 'y':
          e.preventDefault();
          handleRedo();
          return;
        case 'c':
          e.preventDefault();
          handleCopy();
          return;
        case 'x':
          e.preventDefault();
          handleCut();
          return;
        case 'v':
          e.preventDefault();
          handlePaste();
          return;
        case 'a':
          e.preventDefault();
          handleSelectAll();
          return;
      }
    }

    let newSelected = { ...selected };
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newSelected.r = Math.max(0, selected.r - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newSelected.r = Math.min(TOTAL_ROWS - 1, selected.r + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newSelected.c = Math.max(0, selected.c - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newSelected.c = Math.min(TOTAL_COLS - 1, selected.c + 1);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        handleDelete();
        return;
      case 'Enter':
        e.preventDefault();
        // Move down one row when Enter is pressed (Excel-like behavior)
        if (selected.r < TOTAL_ROWS - 1) {
          newSelected.r = selected.r + 1;
        } else {
          // If at bottom, just start editing current cell
          startEditing(selected.r, selected.c);
          return;
        }
        break;
      case 'F2':
        e.preventDefault();
        startEditing(selected.r, selected.c);
        return;
      default:
      // If it's a printable character, start editing
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setEditValue(e.key);
        startEditing(selected.r, selected.c);
      }
      return;
  }
  
  setSelected(newSelected);
  setSelection({
    startRow: newSelected.r,
    startCol: newSelected.c,
    endRow: newSelected.r,
    endCol: newSelected.c,
    isRange: false
  });
  
  // Auto-scroll logic for arrow keys and Enter
  setTimeout(() => {
    if (scrollContainerRef.current && horizontalScrollRef.current) {
      // Vertical scrolling
      const rowPosition = newSelected.r * ROW_HEIGHT;
      const containerHeight = CANVAS_HEIGHT - COL_HEADER_HEIGHT;
      const visibleStart = scrollTop;
      const visibleEnd = scrollTop + containerHeight;
      
      if (rowPosition < visibleStart) {
        scrollContainerRef.current.scrollTop = rowPosition;
      } else if (rowPosition + ROW_HEIGHT > visibleEnd) {
        scrollContainerRef.current.scrollTop = rowPosition - containerHeight + ROW_HEIGHT;
      }
      
      // Horizontal scrolling
      const colPosition = newSelected.c * COL_WIDTH;
      const containerWidth = CANVAS_WIDTH - ROW_HEADER_WIDTH;
      const visibleLeftStart = scrollLeft;
      const visibleLeftEnd = scrollLeft + containerWidth;
      
      if (colPosition < visibleLeftStart) {
        horizontalScrollRef.current.scrollLeft = colPosition;
      } else if (colPosition + COL_WIDTH > visibleLeftEnd) {
        horizontalScrollRef.current.scrollLeft = colPosition - containerWidth + COL_WIDTH;
      }
    }
  }, 0);
};

// Replace your handleScroll function with this:
const handleVerticalScroll = (e) => {
  setScrollTop(e.target.scrollTop);
  
  // If editing, close the editor when scrolling
  if (isEditing) {
    finishEditing(true);
  }
};

const handleHorizontalScroll = (e) => {
  setScrollLeft(e.target.scrollLeft);
  
  // If editing, close the editor when scrolling
  if (isEditing) {
    finishEditing(true);
  }
};

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setCellData(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setCellData(history[historyIndex + 1]);
    }
  };

  const handleCopy = () => {
    const data = [];
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      const row = [];
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        const key = `${r},${c}`;
        row.push(cellData[key] || '');
      }
      data.push(row);
    }
    setClipboard({ data, cut: false });
  };

  const handleCut = () => {
    handleCopy();
    setClipboard(prev => ({ ...prev, cut: true }));
    handleDelete();
  };

  const handlePaste = () => {
    if (!clipboard) return;
    
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
    
    setCellData(newData);
    addToHistory(newData);
  };

  const handleDelete = () => {
    const newData = { ...cellData };
    for (let r = selection.startRow; r <= selection.endRow; r++) {
      for (let c = selection.startCol; c <= selection.endCol; c++) {
        const key = `${r},${c}`;
        delete newData[key];
      }
    }
    setCellData(newData);
    addToHistory(newData);
  };

  const handleSelectAll = () => {
    setSelection({
      startRow: 0,
      startCol: 0,
      endRow: TOTAL_ROWS - 1,
      endCol: TOTAL_COLS - 1,
      isRange: true
    });
  };

  const handleSave = () => {
    // const dataBlob = new Blob([JSON.stringify(cellData, null, 2)], {
    //   type: 'application/json'
    // });
    // const url = URL.createObjectURL(dataBlob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = 'spreadsheet_data.json';
    // a.click();
    // URL.revokeObjectURL(url);
  };

  const handleLoadData = (data) => {
    if (!Array.isArray(data) || data.length === 0) return;
    
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
    
    setCellData(newData);
    addToHistory(newData);
  };

  // Updated useEffect for event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      console.log("add pointer listeners");
      
      // Add pointer event listeners
      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointercancel', handlePointerCancel);
      canvas.addEventListener('dblclick', handleDoubleClick);

      // Prevent context menu on right click
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      
      return () => {
        console.log("remove pointer listeners");
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerCancel);
        canvas.removeEventListener('dblclick', handleDoubleClick);
        canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
      };
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, handleDoubleClick]);

const totalScrollHeight = getTotalScrollHeight(rowHeights, TOTAL_ROWS);
const totalScrollWidth = getTotalScrollWidth(colWidths, TOTAL_COLS);

return (
  <div className="spreadsheet-container">
    <Header 
      onLoadData={handleLoadData} 
      onFontChange={setFontFamily}
      onUndo={handleUndo}
      onRedo={handleRedo}
      canUndo={historyIndex > 0}
      canRedo={historyIndex < history.length - 1}
      onSave={handleSave}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onCut={handleCut}
      cellData={cellData}
      selected={selected}
      setCellData={setCellData}
      addToHistory={addToHistory}
      setSelected={setSelected}
    />

    <div className="toolbar">
      <div className="cell-indicator">
        {getColLetter(selected.c)}{selected.r + 1}
      </div>
      <div className="cell-preview">
        {isEditing ? 'Editing...' : `${cellData[`${selected.r},${selected.c}`] || ''}`}
      </div>
    </div>

    {stats && <StatsPanel stats={stats} selection={selection} />}

    <div className="canvas-wrapper">
      <div className="canvas-inner">
        <canvas
          ref={canvasRef}
          className="grid-canvas"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          style={{ touchAction: 'none' }} // Prevents default touch behaviors
        />

        <div
          ref={scrollContainerRef}
          className="vertical-scroll"
          onScroll={handleVerticalScroll}
        >
          <div style={{ height: totalScrollHeight, width: 1 }} className="scroll-spacer" />
        </div>

        <div
  ref={horizontalScrollRef}
  className="horizontal-scroll"
  onScroll={handleHorizontalScroll}
>
  <div style={{ width: totalScrollWidth, height: 1 }} className="scroll-spacer" />
</div>


       {isEditing && !isResizing && (
  <input
    ref={cellInputRef}
    type="text"
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishEditing(true, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishEditing(false);
      }
    }}
    onBlur={() => finishEditing(true)}
    className="cell-input"
    style={{
      left: editPosition.x,
      top: editPosition.y,
      width: editPosition.width - 10,
      height: editPosition.height - 2,
      fontFamily: fontFamily
    }}
  />
)}
      </div>
    </div>
  </div>
);
}
