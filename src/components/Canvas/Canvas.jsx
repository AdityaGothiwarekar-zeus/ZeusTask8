import React, { useRef, useEffect, useState, useCallback } from 'react';
import "./Grid.css"
import StatsPanel from './ExcelFormulaBar';
import Header from '../Navbar/Header';
import { getColLetter, calculateStats } from '../../Utils'
import { getVisibleRowRange , getVisibleColRange } from '../../Utils';
import { 
  handleColumnSelection, 
  handleRowSelection, 
  getColumnFromHeaderClick, 
  getRowFromHeaderClick,
  isColumnInSelection,
  isRowInSelection 
} from '../../SelectionHelper';
import { insertRow , insertColumn } from '../../Utils';

const TOTAL_ROWS = 100000;
const TOTAL_COLS = 500; // A-Z columns
const COL_WIDTH = 80;
const ROW_HEIGHT = 24;
const ROW_HEADER_WIDTH = 40;
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
  const [editPosition, setEditPosition] = useState({ x: 0, y: 0 });

  // Add state for tracking pointer/touch
  const [pointerDownId, setPointerDownId] = useState(null);
  const [startSelection, setStartSelection] = useState(null);
  const [shiftKey, setShiftKey] = useState(false);

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
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform first
  ctx.scale(dpr, dpr); // Now all drawing uses logical units

  // Clear and set font
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.font = `14px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 0.4 / dpr; // Always 1px regardless of zoom

  const { startRow, endRow } = visibleRange;
  const { startCol, endCol } = getVisibleColRange(scrollLeft, COL_WIDTH, CANVAS_WIDTH, ROW_HEADER_WIDTH, TOTAL_COLS);

  // Draw top-left corner (select all)
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);
  ctx.strokeStyle = '#d8d9db';
  ctx.strokeRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

  // === Column Headers ===
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(ROW_HEADER_WIDTH, 0, CANVAS_WIDTH - ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

  for (let c = startCol; c < endCol; c++) {
    const x = ROW_HEADER_WIDTH + (c - startCol) * COL_WIDTH;
    if (x >= CANVAS_WIDTH) break;

    const shouldHighlight = isColumnInSelection(c, selected, selection, TOTAL_ROWS, TOTAL_COLS);

    // Background color
    ctx.fillStyle = shouldHighlight ? '#caead8' : '#f0f0f0';
    ctx.fillRect(x, 0, COL_WIDTH, COL_HEADER_HEIGHT);

    // Text
    ctx.fillStyle = shouldHighlight ? '#0F7937' : 'black';
    ctx.textAlign = 'center';
    ctx.fillText(getColLetter(c), x + COL_WIDTH / 2, COL_HEADER_HEIGHT / 2);

    // Borders
    ctx.strokeStyle = '#d8d9db';
    ctx.strokeRect(x, 0, COL_WIDTH, COL_HEADER_HEIGHT);

    if (shouldHighlight) {
      ctx.strokeStyle = '#0F7937'; // dark green
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, COL_HEADER_HEIGHT - 1);
      ctx.lineTo(x + COL_WIDTH, COL_HEADER_HEIGHT - 1);
      ctx.stroke();
    }
  }

  // === Row Headers ===
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, COL_HEADER_HEIGHT, ROW_HEADER_WIDTH, CANVAS_HEIGHT - COL_HEADER_HEIGHT);

  for (let r = startRow; r < endRow; r++) {
    const y = COL_HEADER_HEIGHT + (r - startRow) * ROW_HEIGHT;
    if (y >= CANVAS_HEIGHT) break;

    const shouldHighlight = isRowInSelection(r, selected, selection, TOTAL_ROWS, TOTAL_COLS);

    // Background
    ctx.fillStyle = shouldHighlight ? '#caead8' : '#f0f0f0';
    ctx.fillRect(0, y, ROW_HEADER_WIDTH, ROW_HEIGHT);

    // Text
    ctx.fillStyle = shouldHighlight ? '#0F7937' : 'black';
    ctx.textAlign = 'center';
    ctx.fillText(r + 1, ROW_HEADER_WIDTH / 2, y + ROW_HEIGHT / 2);

    // Border
    ctx.strokeStyle = '#d8d9db';
    ctx.strokeRect(0, y, ROW_HEADER_WIDTH, ROW_HEIGHT);

    if (shouldHighlight) {
      ctx.strokeStyle = '#0F7937'; // dark green
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ROW_HEADER_WIDTH - 1, y);
      ctx.lineTo(ROW_HEADER_WIDTH - 1, y + ROW_HEIGHT);
      ctx.stroke();
    }
  }

  // === Cells ===
  for (let r = startRow; r < endRow; r++) {
    const y = COL_HEADER_HEIGHT + (r - startRow) * ROW_HEIGHT;
    if (y >= CANVAS_HEIGHT) break;

    for (let c = startCol; c < endCol; c++) {
      const x = ROW_HEADER_WIDTH + (c - startCol) * COL_WIDTH;
      if (x >= CANVAS_WIDTH) break;

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
      console.log(selection.startRow);
      console.log(selection.startCol);
      // Set background
      let bgColor = 'white';
      if (isInSelection) {
        bgColor = isFirstSelected ? 'white' : '#f1faf1';
      } else if (isCurrent) {
        bgColor = '#f1faf1';
      }


      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, COL_WIDTH, ROW_HEIGHT);

      // Cell border
      ctx.strokeStyle = '#d8d9db';
      ctx.strokeRect(x + 0.5, y + 0.5, COL_WIDTH - 1, ROW_HEIGHT - 1);
      ctx.lineWidth = 0.4;

      // Cell content
      const val = cellData[key];
      if (val && !(isEditing && isCurrent)) {
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.fillText(String(val).substring(0, 10), x + 4, y + ROW_HEIGHT / 2);
      }
    }
  }

  // === Selection Border ===
  if (selection.isRange) {
    const selStartRow = Math.max(selection.startRow, startRow);
    const selEndRow = Math.min(selection.endRow, endRow - 1);
    const selStartCol = Math.max(selection.startCol, startCol);
    const selEndCol = Math.min(selection.endCol, endCol - 1);

    if (selStartRow <= selEndRow && selStartCol <= selEndCol) {
      const selStartY = COL_HEADER_HEIGHT + ((selStartRow - startRow) * ROW_HEIGHT);
      const selEndY = COL_HEADER_HEIGHT + ((selEndRow - startRow + 1) * ROW_HEIGHT);
      const selStartX = ROW_HEADER_WIDTH + ((selStartCol - startCol) * COL_WIDTH);
      const selWidth = (selEndCol - selStartCol + 1) * COL_WIDTH;

      ctx.strokeStyle = '#0F7937';
      ctx.lineWidth = 2;
      ctx.strokeRect(selStartX, selStartY, selWidth, selEndY - selStartY);
      ctx.lineWidth = 1.5;
    }
  } else {
    // Single cell border
    if (selected.r >= startRow && selected.r < endRow && selected.c >= startCol && selected.c < endCol) {
      const selY = COL_HEADER_HEIGHT + ((selected.r - startRow) * ROW_HEIGHT);
      const selX = ROW_HEADER_WIDTH + ((selected.c - startCol) * COL_WIDTH);

      ctx.strokeStyle = '#0F7937';
      ctx.lineWidth = 2;
      ctx.strokeRect(selX, selY, COL_WIDTH, ROW_HEIGHT);
      ctx.lineWidth = 1.5;
    }
  }
}, [cellData, selected, selection, scrollTop, scrollLeft, fontFamily, visibleRange, isEditing]);


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
// Replace your startEditing function with this:
const startEditing = useCallback((row, col) => {
  const { startRow } = visibleRange;
  const { startCol } = getVisibleColRange(scrollLeft, COL_WIDTH, CANVAS_WIDTH, ROW_HEADER_WIDTH, TOTAL_COLS);
  const canvasRect = canvasRef.current?.getBoundingClientRect();
  if (!canvasRect) return;

  const x = canvasRect.left + ROW_HEADER_WIDTH + ((col - startCol) * COL_WIDTH);
  const y = canvasRect.top + COL_HEADER_HEIGHT + ((row - startRow) * ROW_HEIGHT);

  const key = `${row},${col}`;
  const currentValue = cellData[key] || '';

  setEditValue(currentValue);
  setEditPosition({ x, y });
  setIsEditing(true);
  
  // Focus the input after state update
  setTimeout(() => {
    if (cellInputRef.current) {
      cellInputRef.current.focus();
      // cellInputRef.current.select();
    }
  }, 0);
}, [cellData, visibleRange, scrollLeft]);

  const finishEditing = useCallback((save = true) => {
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
    
    // Return focus to canvas
    if (canvasRef.current) {
      canvasRef.current.focus();
    }
  }, [isEditing, editValue, selected, cellData, addToHistory]);


  // Helper function to get cell coordinates from pointer event
// Replace your getCellFromPointer function with this:
const getCellFromPointer = useCallback((e) => {
  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return null;

  const { startCol } = getVisibleColRange(scrollLeft, COL_WIDTH, CANVAS_WIDTH, ROW_HEADER_WIDTH, TOTAL_COLS);
  const canvasColIndex = Math.floor((x - ROW_HEADER_WIDTH) / COL_WIDTH);
  const c = startCol + canvasColIndex;
  
  const canvasRowIndex = Math.floor((y - COL_HEADER_HEIGHT) / ROW_HEIGHT);
  const { startRow } = visibleRange;
  const r = startRow + canvasRowIndex;

  if (c >= 0 && c < TOTAL_COLS && r >= 0 && r < TOTAL_ROWS) {
    return { r, c };
  }
  return null;
}, [visibleRange, scrollLeft]);

  // Pointer event handlers
  const handlePointerDown = useCallback((e) => {
    console.log("pointer down", e.pointerId);
    
    // Prevent default to avoid text selection and other browser behaviors
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Store shift key state
    setShiftKey(e.shiftKey);

    // If we're currently editing, finish editing first
    if (isEditing) {
      finishEditing(true);
    }

    // Check for select all click (top-left corner)
    // if (handleSelectAllClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, setSelection, setSelected, TOTAL_ROWS, TOTAL_COLS)) {
    //   return;
    // }

    // Check for column header click
    const colIndex = getColumnFromHeaderClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, COL_WIDTH, TOTAL_COLS);
    if (colIndex !== null) {
      handleColumnSelection(colIndex, selection, setSelection, setSelected, TOTAL_ROWS);
      return;
    }

    // Check for row header click
    const rowIndex = getRowFromHeaderClick(x, y, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT, ROW_HEIGHT, visibleRange.startRow, TOTAL_ROWS);
    if (rowIndex !== null) {
      handleRowSelection(rowIndex, selection, setSelection, setSelected, TOTAL_COLS);
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
  }, [getCellFromPointer, isEditing, finishEditing, selection, visibleRange]);

  const handlePointerMove = useCallback((e) => {
    if (!isSelecting || isEditing || e.pointerId !== pointerDownId || !startSelection) return;
    
    const cell = getCellFromPointer(e);
    if (!cell) return;

    const { r, c } = cell;

    const newSelection = {
      startRow: Math.min(startSelection.r, r),
      endRow: Math.max(startSelection.r, r),
      startCol: Math.min(startSelection.c, c),
      endCol: Math.max(startSelection.c, c),
      isRange: startSelection.r !== r || startSelection.c !== c
    };
    setSelection(newSelection);
  }, [isSelecting, isEditing, pointerDownId, startSelection, getCellFromPointer]);

  const handlePointerUp = useCallback((e) => {
    if (e.pointerId === pointerDownId) {
      console.log("pointer up", e.pointerId);
      setIsSelecting(false);
      setPointerDownId(null);
      setStartSelection(null);
      setShiftKey(false);
      
      // Release pointer capture
      if (canvasRef.current) {
        canvasRef.current.releasePointerCapture(e.pointerId);
      }
    }
  }, [pointerDownId]);

  const handlePointerCancel = useCallback((e) => {
    if (e.pointerId === pointerDownId) {
      console.log("pointer cancel", e.pointerId);
      setIsSelecting(false);
      setPointerDownId(null);
      setStartSelection(null);
      setShiftKey(false);
    }
  }, [pointerDownId]);

  // Double click/tap handler
  const handleDoubleClick = useCallback((e) => {
    const cell = getCellFromPointer(e);
    if (!cell) return;

    const { r, c } = cell;
    startEditing(r, c);
  }, [getCellFromPointer, startEditing]);

  const handleKeyDown = (e) => {
    // If we're editing, handle edit-specific keys
    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing(false);
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
        startEditing(selected.r, selected.c);
        return;
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
    
    // Auto-scroll logic
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

const totalScrollHeight = TOTAL_ROWS * ROW_HEIGHT;
const totalScrollWidth = TOTAL_COLS * COL_WIDTH;

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


        {isEditing && (
          <input
            ref={cellInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                finishEditing(true);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEditing(false);
              }
            }}
            onBlur={() => finishEditing(true)}
            className="cell-input"
            style={{
              left: editPosition.x,
              top: editPosition.y,
              width: COL_WIDTH - 10,
              height: ROW_HEIGHT - 2,
              fontFamily: fontFamily
            }}
          />
        )}
      </div>
    </div>
  </div>
);
}