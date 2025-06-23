import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import './Grid.css';
import Header from '../Navbar/Header';

const INITIAL_CELL_WIDTH = 70;
const INITIAL_CELL_HEIGHT = 24;
const COL_HEADER_HEIGHT = 24;
const ROW_HEADER_WIDTH = 40;
const TOTAL_ROWS = 50000;

// Command Pattern Implementation
class Command {
  execute() {
    throw new Error('Execute method must be implemented');
  }
  
  undo() {
    throw new Error('Undo method must be implemented');
  }
}

class UpdateCellCommand extends Command {
  constructor(key, newValue, oldValue, setCellData) {
    super();
    this.key = key;
    this.newValue = newValue;
    this.oldValue = oldValue;
    this.setCellData = setCellData;
  }
  
  execute() {
    this.setCellData(prev => ({ ...prev, [this.key]: this.newValue }));
  }
  
  undo() {
    if (this.oldValue === undefined) {
      this.setCellData(prev => {
        const { [this.key]: _, ...rest } = prev;
        return rest;
      });
    } else {
      this.setCellData(prev => ({ ...prev, [this.key]: this.oldValue }));
    }
  }
}

class SelectAllCommand extends Command {
  constructor(visibleCols, setSelectionType, setRangeStart, setRangeEnd, setSelectedColumns, setSelectedRows) {
    super();
    this.visibleCols = visibleCols;
    this.setSelectionType = setSelectionType;
    this.setRangeStart = setRangeStart;
    this.setRangeEnd = setRangeEnd;
    this.setSelectedColumns = setSelectedColumns;
    this.setSelectedRows = setSelectedRows;
    this.previousState = null;
  }
  
  execute() {
    // Store previous state for undo
    this.previousState = {
      selectionType: 'range',
      rangeStart: { r: 0, c: 0 },
      rangeEnd: { r: TOTAL_ROWS - 1, c: this.visibleCols - 1 }
    };
    
    this.setSelectionType('range');
    this.setRangeStart({ r: 0, c: 0 });
    this.setRangeEnd({ r: TOTAL_ROWS - 1, c: this.visibleCols - 1 });
    this.setSelectedColumns(new Set());
    this.setSelectedRows(new Set());
  }
  
  undo() {
    // Reset to single cell selection
    this.setSelectionType('cell');
    this.setRangeStart(null);
    this.setRangeEnd(null);
    this.setSelectedColumns(new Set());
    this.setSelectedRows(new Set());
  }
}

class CommandHistory {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
  }
  
  execute(command) {
    // Remove any commands after current index (when redoing after undo)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Execute the command
    command.execute();
    
    // Add to history
    this.history.push(command);
    this.currentIndex++;
    
    // Limit history size to prevent memory issues
    if (this.history.length > 100) {
      this.history.shift();
      this.currentIndex--;
    }
  }
  
  canUndo() {
    return this.currentIndex >= 0;
  }
  
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }
  
  undo() {
    if (this.canUndo()) {
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;
      return true;
    }
    return false;
  }
  
  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.execute();
      return true;
    }
    return false;
  }   
}

const measureTextDimensions = (text, font = '14px Arial') => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  return {
    width: m.width,
    height: (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0),
  };
};

const getColLetter = n => {
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
};

const isNumeric = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

const calculateStats = (values) => {
  const numericValues = values.filter(v => v !== '' && isNumeric(v)).map(v => parseFloat(v));
  
  if (numericValues.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
  }
  
  const sum = numericValues.reduce((a, b) => a + b, 0);
  const avg = sum / numericValues.length;
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  
  return {
    count: numericValues.length,
    sum: parseFloat(sum.toFixed(2)),
    avg: parseFloat(avg.toFixed(2)),
    min: parseFloat(min.toFixed(2)),
    max: parseFloat(max.toFixed(2))
  };
};

export default function GridPage() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const commandHistory = useRef(new CommandHistory());

  const [visibleCols, setVisibleCols] = useState(0);
  const [colWidths, setColWidths] = useState([]);
  const [rowHeights, setRowHeights] = useState(new Array(TOTAL_ROWS).fill(INITIAL_CELL_HEIGHT));
  const [selectedCell, setSelectedCell] = useState({ r: 0, c: 0 });
  const [cellData, setCellData] = useState({});
  const [formula, setFormula] = useState('');
  const [showInput, setShowInput] = useState(false);
  const resizing = useRef({ type: null, index: null, startPos: 0, startSize: 0 });
  const [fontFamily, setFontFamily] = useState('Arial, sans-serif');
  const [scrollTop, setScrollTop] = useState(0);
  
  // Selection states
  const [selectionType, setSelectionType] = useState('cell');
  const [selectedColumns, setSelectedColumns] = useState(new Set());
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statistics, setStatistics] = useState({ count: 0, sum: 0, avg: 0, min: 0, max: 0 });

  // Command states
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateCommandState = useCallback(() => {
    setCanUndo(commandHistory.current.canUndo());
    setCanRedo(commandHistory.current.canRedo());
  }, []);

  const handleFontChange = newFont => setFontFamily(newFont);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z / Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y / Cmd+Shift+Z for redo
      else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
               ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+A / Cmd+A for select all
      else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
      else if (e.key === 'ArrowRight') {
  e.preventDefault();
  setSelectionType('cell');
  setSelectedColumns(new Set());
  setSelectedRows(new Set());
  setRangeStart(null);
  setRangeEnd(null);
  setSelectedCell(prev => ({ r: prev.r, c: Math.min(prev.c + 1, visibleCols - 1) }));
} else if (e.key === 'ArrowLeft') {
  e.preventDefault();
  setSelectionType('cell');
  setSelectedColumns(new Set());
  setSelectedRows(new Set());
  setRangeStart(null);
  setRangeEnd(null);
  setSelectedCell(prev => ({ r: prev.r, c: Math.max(prev.c - 1, 0) }));
} else if (e.key === 'ArrowDown') {
  e.preventDefault();
  setSelectionType('cell');
  setSelectedColumns(new Set());
  setSelectedRows(new Set());
  setRangeStart(null);
  setRangeEnd(null);
  setSelectedCell(prev => ({ r: Math.min(prev.r + 1, TOTAL_ROWS - 1), c: prev.c }));
} else if (e.key === 'ArrowUp') {
  e.preventDefault();
  setSelectionType('cell');
  setSelectedColumns(new Set());
  setSelectedRows(new Set());
  setRangeStart(null);
  setRangeEnd(null);
  setSelectedCell(prev => ({ r: Math.max(prev.r - 1, 0), c: prev.c }));
}

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleCols]);

  const handleUndo = useCallback(() => {
    if (commandHistory.current.undo()) {
      updateCommandState();
    }
  }, [updateCommandState]);

  const handleRedo = useCallback(() => {
    if (commandHistory.current.redo()) {
      updateCommandState();
    }
  }, [updateCommandState]);

  const handleSelectAll = useCallback(() => {
    if (visibleCols > 0) {
      const command = new SelectAllCommand(
        visibleCols,
        setSelectionType,
        setRangeStart,
        setRangeEnd,
        setSelectedColumns,
        setSelectedRows
      );
      commandHistory.current.execute(command);
      updateCommandState();
    }
  }, [visibleCols, updateCommandState]);

  useEffect(() => {
    const calculate = () => {
      const box = wrapperRef.current?.getBoundingClientRect();
      if (!box) return;
      const cw = box.width - ROW_HEADER_WIDTH;
      const vc = Math.max(1, Math.floor(cw / INITIAL_CELL_WIDTH));
      setVisibleCols(vc);
    };
    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, []);

  useEffect(() => {
    setColWidths(new Array(visibleCols).fill(INITIAL_CELL_WIDTH));
  }, [visibleCols]);

  // Calculate statistics when selection changes
  useEffect(() => {
    const getSelectedValues = () => {
      const values = [];
      
      if (selectionType === 'column') {
        selectedColumns.forEach(col => {
          for (let row = 0; row < TOTAL_ROWS; row++) {
            const key = `${row},${col}`;
            if (cellData[key]) {
              values.push(cellData[key]);
            }
          }
        });
      } else if (selectionType === 'row') {
        selectedRows.forEach(row => {
          for (let col = 0; col < visibleCols; col++) {
            const key = `${row},${col}`;
            if (cellData[key]) {
              values.push(cellData[key]);
            }
          }
        });
      } else if (selectionType === 'range' && rangeStart && rangeEnd) {
        const minRow = Math.min(rangeStart.r, rangeEnd.r);
        const maxRow = Math.max(rangeStart.r, rangeEnd.r);
        const minCol = Math.min(rangeStart.c, rangeEnd.c);
        const maxCol = Math.max(rangeStart.c, rangeEnd.c);
        
        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const key = `${row},${col}`;
            if (cellData[key]) {
              values.push(cellData[key]);
            }
          }
        }
      } else if (selectionType === 'cell') {
        const key = `${selectedCell.r},${selectedCell.c}`;
        if (cellData[key]) {
          values.push(cellData[key]);
        }
      }
      
      return values;
    };

    const values = getSelectedValues();
    setStatistics(calculateStats(values));
  }, [selectionType, selectedColumns, selectedRows, rangeStart, rangeEnd, selectedCell, cellData, visibleCols]);

  const totalHeight = COL_HEADER_HEIGHT + rowHeights.reduce((a, h) => a + h, 0);
  const totalWidth = ROW_HEADER_WIDTH + colWidths.reduce((a, w) => a + w, 0);

  const getVisibleRowRange = () => {
    let startY = 0;
    let startRow = 0;
    for (let i = 0; i < rowHeights.length; i++) {
      if (startY + rowHeights[i] > scrollTop) {
        startRow = i;
        break;
      }
      startY += rowHeights[i];
    }

    const visibleHeight = (wrapperRef.current?.clientHeight || window.innerHeight) - COL_HEADER_HEIGHT;
    let endY = startY;
    let endRow = startRow;
    for (let i = startRow; i < rowHeights.length; i++) {
      endY += rowHeights[i];
      if (endY > scrollTop + visibleHeight) {
        endRow = i;
        break;
      }
    }
    return [startRow, endRow, startY];
  };

  const getColStartX = col => ROW_HEADER_WIDTH + colWidths.slice(0, col).reduce((a, w) => a + w, 0);
  const getRowStartY = row => COL_HEADER_HEIGHT + rowHeights.slice(0, row).reduce((a, h) => a + h, 0);

  const getCellFromCoords = (x, y) => {
    if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return null;

    let cx = ROW_HEADER_WIDTH;
    let c = -1;
    for (let i = 0; i < visibleCols; i++) {
      cx += colWidths[i];
      if (x < cx) { c = i; break; }
    }
    if (c < 0) return null;

    const [startRow, endRow, startY] = getVisibleRowRange();
    let cy = COL_HEADER_HEIGHT - (scrollTop - startY);
    let r = -1;
    for (let i = startRow; i <= endRow; i++) {
      const h = rowHeights[i];
      if (y < cy + h) {
        r = i;
        break;
      }
      cy += h;
    }
    if (r < 0) return null;

    return { r, c };
  };

  const onMouseDownColResize = (e, colIndex) => {
    resizing.current = { type: 'col', index: colIndex, startPos: e.clientX, startSize: colWidths[colIndex] };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  };

  const onMouseDownRowResize = (e, rowIndex) => {
    resizing.current = { type: 'row', index: rowIndex, startPos: e.clientY, startSize: rowHeights[rowIndex] };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  };

  const onMouseMove = e => {
  const rect = canvasRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cellX = getColStartX(selectedCell.c);
  const cellY = getRowStartY(selectedCell.r) - scrollTop;
  const cellWidth = colWidths[selectedCell.c];
  const cellHeight = rowHeights[selectedCell.r];

  const inCorner =
    x >= cellX + cellWidth - 10 &&
    x <= cellX + cellWidth &&
    y >= cellY + cellHeight - 10 &&
    y <= cellY + cellHeight;

  canvasRef.current.style.cursor = inCorner ? 'cell' : 'default';

    const { type, index, startPos, startSize } = resizing.current;
    if (!type) return;
    if (type === 'col') {
      const newWidth = Math.max(20, startSize + (e.clientX - startPos));
      setColWidths(w => {
        const u = [...w];
        u[index] = newWidth;
        return u;
      });
    } else {
      const newHeight = Math.max(20, startSize + (e.clientY - startPos));
      setRowHeights(h => {
        const u = [...h];
        u[index] = newHeight;
        return u;
      });
    }
  };

  const onMouseUp = () => {
    resizing.current.type = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    setIsDragging(false);
  };

  const onCanvasMouseDown = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Column header click
    if (y < COL_HEADER_HEIGHT && x >= ROW_HEADER_WIDTH) {
      let cx = ROW_HEADER_WIDTH;
      let c = -1;
      for (let i = 0; i < visibleCols; i++) {
        cx += colWidths[i];
        if (x < cx) { c = i; break; }
      }
      if (c >= 0) {
        setSelectionType('column');
        if (e.ctrlKey || e.metaKey) {
          setSelectedColumns(prev => {
            const newSet = new Set(prev);
            if (newSet.has(c)) {
              newSet.delete(c);
            } else {
              newSet.add(c);
            }
            return newSet;
          });
        } else {
          setSelectedColumns(new Set([c]));
        }
        setSelectedRows(new Set());
        setRangeStart(null);
        setRangeEnd(null);
        return;
      }
    }

    // Row header click
    if (x < ROW_HEADER_WIDTH && y >= COL_HEADER_HEIGHT) {
      const [startRow, endRow, startY] = getVisibleRowRange();
      let cy = COL_HEADER_HEIGHT - (scrollTop - startY);
      let r = -1;
      for (let i = startRow; i <= endRow; i++) {
        const h = rowHeights[i];
        if (y < cy + h) {
          r = i;
          break;
        }
        cy += h;
      }
      if (r >= 0) {
        setSelectionType('row');
        if (e.ctrlKey || e.metaKey) {
          setSelectedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(r)) {
              newSet.delete(r);
            } else {
              newSet.add(r);
            }
            return newSet;
          });
        } else {
          setSelectedRows(new Set([r]));
        }
        setSelectedColumns(new Set());
        setRangeStart(null);
        setRangeEnd(null);
        return;
      }
    }

    // Cell click
    const cell = getCellFromCoords(x, y);
    if (cell) {
      if (e.shiftKey && selectionType === 'range' && rangeStart) {
        // Extend range selection
        setRangeEnd(cell);
      } else {
        // Start new selection
        setSelectionType('range');
        setRangeStart(cell);
        setRangeEnd(cell);
        setSelectedCell(cell);
        setIsDragging(true);
        
        const key = `${cell.r},${cell.c}`;
        setFormula(cellData[key] || '');
        setShowInput(true);
        setTimeout(() => inputRef.current?.focus());
      }
      
      setSelectedColumns(new Set());
      setSelectedRows(new Set());
      
      // Add mouse move listener for drag selection
      const handleMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const moveRect = canvasRef.current.getBoundingClientRect();
        const moveX = moveEvent.clientX - moveRect.left;
        const moveY = moveEvent.clientY - moveRect.top;
        const moveCell = getCellFromCoords(moveX, moveY);
        if (moveCell) {
          setRangeEnd(moveCell);
        }
      };
      
      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

  const updateCellData = val => {
    const { r, c } = selectedCell;
    const key = `${r},${c}`;
    const oldValue = cellData[key];
    
    // Create and execute command
    const command = new UpdateCellCommand(key, val, oldValue, setCellData);
    commandHistory.current.execute(command);
    updateCommandState();
    
    setFormula(val);
    
    // Update dimensions
    const { width, height } = measureTextDimensions(val);
    const dw = width + 10, dh = height + 8;
    setColWidths(w => { const u = [...w]; if (dw > u[c]) u[c] = dw; return u; });
    setRowHeights(h => { const u = [...h]; if (dh > u[r]) u[r] = dh; return u; });
  };

  const handleLoadData = dt => {
    if (!Array.isArray(dt) || dt.length === 0) return;
    const headers = Object.keys(dt[0]);
    const newData = {};
    headers.forEach((h, ci) => newData[`0,${ci}`] = h);
    dt.forEach((row, ri) =>
      headers.forEach((h, ci) => newData[`${ri + 1},${ci}`] = String(row[h] ?? '')));
    setCellData(newData);
    headers.forEach((h, ci) => {
      const maxLen = Math.max(h.length, ...dt.map(r => String(r[h] ?? '').length));
      const { width } = measureTextDimensions('M'.repeat(maxLen + 2));
      setColWidths(w => {
        const u = [...w];
        if (width > (u[ci] || 0)) u[ci] = width;
        return u;
      });
    });
    setRowHeights(h => {
      const u = [...h];
      const rowCount = dt.length + 1;
      for (let i = 0; i < rowCount; i++) u[i] = INITIAL_CELL_HEIGHT;
      return u;
    });
  };

  const onScroll = e => setScrollTop(e.currentTarget.scrollTop);

  const isCellInRange = (row, col) => {
    if (selectionType === 'column') {
      return selectedColumns.has(col);
    } else if (selectionType === 'row') {
      return selectedRows.has(row);
    } else if (selectionType === 'range' && rangeStart && rangeEnd) {
      const minRow = Math.min(rangeStart.r, rangeEnd.r);
      const maxRow = Math.max(rangeStart.r, rangeEnd.r);
      const minCol = Math.min(rangeStart.c, rangeEnd.c);
      const maxCol = Math.max(rangeStart.c, rangeEnd.c);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    }
    return false;
  };

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const [startRow, endRow, startY] = getVisibleRowRange();
    const height = wrapperRef.current?.clientHeight || window.innerHeight;
    canvasRef.current.width = totalWidth;
    canvasRef.current.height = height;

    ctx.clearRect(0, 0, totalWidth, height);
    ctx.font = `14px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    // Draw column headers
    let x = ROW_HEADER_WIDTH;
    for (let ci = 0; ci < visibleCols; ci++) {
      const w = colWidths[ci];
      const isSelected = selectedColumns.has(ci) || (selectedCell.c === ci && selectionType === 'cell');
      ctx.fillStyle = isSelected ? '#107c41' : '#f0f0f0';
      ctx.fillRect(x, 0, w, COL_HEADER_HEIGHT);
      ctx.fillStyle = isSelected ?'#ffffff':'black';
      ctx.textAlign = 'center';
      ctx.fillText(getColLetter(ci), x + w / 2, COL_HEADER_HEIGHT / 2);
      ctx.strokeStyle = '#d8d9db';
      ctx.strokeRect(x, 0, w, COL_HEADER_HEIGHT);
      ctx.lineWidth = 1
      x += w;
    }

    // Draw row headers
    let y = COL_HEADER_HEIGHT - (scrollTop - startY);
    for (let ri = startRow; ri <= endRow; ri++) {
      const h = rowHeights[ri];
      const isSelected = selectedRows.has(ri) || (selectedCell.r === ri && selectionType === 'cell');
      ctx.fillStyle = isSelected ? '#107c41' : '#f0f0f0';
      ctx.fillRect(0, y, ROW_HEADER_WIDTH, h);
      ctx.fillStyle = isSelected ?'#ffffff':'black';
      ctx.textAlign = 'center';
      ctx.fillText(ri + 1, ROW_HEADER_WIDTH / 2, y + h / 2);
      ctx.strokeStyle = '#d8d9db';
      ctx.strokeRect(0, y, ROW_HEADER_WIDTH, h);
      y += h;
    }

    // Draw cells
    x = ROW_HEADER_WIDTH;
    for (let ci = 0; ci < visibleCols; ci++) {
      const w = colWidths[ci];
      y = COL_HEADER_HEIGHT - (scrollTop - startY);
      for (let ri = startRow; ri <= endRow; ri++) {
        const h = rowHeights[ri];
        const key = `${ri},${ci}`;
        
        // Determine cell background color
       let fillColor = 'white';

const isCellSelected =
  (selectedCell.r === ri && selectedCell.c === ci && selectionType === 'cell') ||
  isCellInRange(ri, ci) ||
  selectedRows.has(ri) ||
  selectedColumns.has(ci);

// Prevent top-left of selected row/col from being green
const isFirstOfSelectedRow = selectedRows.has(ri) && ci === 0;
const isFirstOfSelectedCol = selectedColumns.has(ci) && ri === 0;

if (isCellSelected && !isFirstOfSelectedRow && !isFirstOfSelectedCol) {
  fillColor = '#f1faf1';
}

        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#d8d9db';
        ctx.strokeRect(x, y, w, h);
        
        
        if (cellData[key]) {
          ctx.fillStyle = 'black';
          ctx.textAlign = 'left';
          ctx.fillText(cellData[key], x + 4, y + h / 2);
        }
        y += h;
      }
      x += w;
    }

    // Draw selection border for range selection
    if (selectionType === 'range' && rangeStart && rangeEnd) {
      const minRow = Math.min(rangeStart.r, rangeEnd.r);
      const maxRow = Math.max(rangeStart.r, rangeEnd.r);
      const minCol = Math.min(rangeStart.c, rangeEnd.c);
      const maxCol = Math.max(rangeStart.c, rangeEnd.c);
      
      const startX = getColStartX(minCol);
      const startY = getRowStartY(minRow) - scrollTop;
      const endX = getColStartX(maxCol) + colWidths[maxCol];
      const endY = getRowStartY(maxRow) + rowHeights[maxRow] - scrollTop;
      
      // ctx.strokeStyle = '#107c41';
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, startY, endX - startX - 1, endY - startY - 1);
      // ctx.lineWidth = 1;
    }
  }, [visibleCols, colWidths, rowHeights, cellData, selectedCell, selectedColumns, selectedRows, rangeStart, rangeEnd, selectionType, scrollTop, fontFamily]);

  const inputLeft = getColStartX(selectedCell.c);
  const inputTop = getRowStartY(selectedCell.r) - scrollTop;
  const [startRow, endRow] = getVisibleRowRange();

  const getSelectionDescription = () => {
    if (selectionType === 'column') {
      const cols = Array.from(selectedColumns).sort((a, b) => a - b);
      return cols.length === 1 ? `Column ${getColLetter(cols[0])}` : `${cols.length} columns`;
    } else if (selectionType === 'row') {
      const rows = Array.from(selectedRows).sort((a, b) => a - b);
      return rows.length === 1 ? `Row ${rows[0] + 1}` : `${rows.length} rows`;
    } else if (selectionType === 'range' && rangeStart && rangeEnd) {
      const minRow = Math.min(rangeStart.r, rangeEnd.r);
      const maxRow = Math.max(rangeStart.r, rangeEnd.r);
      const minCol = Math.min(rangeStart.c, rangeEnd.c);
      const maxCol = Math.max(rangeStart.c, rangeEnd.c);
      
      if (minRow === maxRow && minCol === maxCol) {
        return `${getColLetter(minCol)}${minRow + 1}`;
      } else {
        return `${getColLetter(minCol)}${minRow + 1}:${getColLetter(maxCol)}${maxRow + 1}`;
      }
    }
    return `${getColLetter(selectedCell.c)}${selectedCell.r + 1}`;
  };

  return (
  <div
    ref={wrapperRef}
    className="grid-wrapper"
    onScroll={onScroll}
    style={{ height: '100vh', width: '100vw', overflow: 'auto', position: 'relative' }}
  >
    <Header onLoadData={handleLoadData} onFontChange={handleFontChange} />
    
    <div className="command-toolbar" style={{ 
      background: '#f8f9fa', 
      border: '1px solid #dee2e6', 
      padding: '4px 8px', 
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }}>
      <button onClick={handleUndo} disabled={!canUndo}>↶ Undo</button>
      <button onClick={handleRedo} disabled={!canRedo}>↷ Redo</button>
      <button onClick={handleSelectAll}>📋 Select All</button>
      <div style={{ marginLeft: '16px', fontSize: '12px', color: '#666' }}>
        Shortcuts: Ctrl+Z (Undo) | Ctrl+Y (Redo) | Ctrl+A (Select All)
      </div>
    </div>

    <div className="formula-bar">
      <div className="cell-label">{getSelectionDescription()}</div>
      <input
        type="text"
        className="formula-input"
        value={formula}
        onChange={e => updateCellData(e.target.value)}
      />
    </div>
    
    <div className="stats-bar" style={{ 
      background: '#f8f9fa', 
      border: '1px solid #dee2e6', 
      padding: '4px 8px', 
      fontSize: '12px',
      display: 'flex',
      gap: '16px'
    }}>
      <span>Count: {statistics.count}</span>
      <span>Sum: {statistics.sum}</span>
      <span>Avg: {statistics.avg}</span>
      <span>Min: {statistics.min}</span>
      <span>Max: {statistics.max}</span>
    </div>

    <div style={{ position: 'relative', width: totalWidth, height: totalHeight }}>
      <canvas
        ref={canvasRef}
        className="spreadsheet-canvas"
        onMouseDown={onCanvasMouseDown}
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}
      />
      {colWidths.map((w, ci) => (
        <div
          key={`col-resize-${ci}`}
          onMouseDown={e => onMouseDownColResize(e, ci)}
          style={{
            position: 'absolute',
            top: 0,
            left: getColStartX(ci) + w - 5,
            width: 10,
            height: totalHeight,
            cursor: 'col-resize',
            zIndex: 10,
          }}
        />
      ))}
      {rowHeights.slice(startRow, endRow + 1).map((h, i) => {
        const ri = startRow + i;
        return (
          <div
            key={`row-resize-${ri}`}
            onMouseDown={e => onMouseDownRowResize(e, ri)}
            style={{
              position: 'absolute',
              top: getRowStartY(ri) - scrollTop + h - 5,
              left: 0,
              width: totalWidth,
              height: 10,
              cursor: 'row-resize',
              zIndex: 10,
            }}
          />
        );
      })}

      {/* Row & Column Highlight Overlay */}
     {selectedCell && (
  <>
    {/* Row highlight */}
    <div
      style={{
        position: 'absolute',
        top: getRowStartY(selectedCell.r),
        left: 0,
        width: totalWidth,
        height: rowHeights[selectedCell.r],
        backgroundColor: '#d4f8d4', // light green
        borderBottom: '1px solid #107c41',
        zIndex: 0
      }}
    />
    {/* Column highlight */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: getColStartX(selectedCell.c),
        width: colWidths[selectedCell.c],
        height: totalHeight,
        backgroundColor: '#d4f8d4', // light green
        borderBottom: '1px solid #107c41',
        zIndex: 0
      }}
    />
  </>
)}


      {/* Input box for editing */}
      {showInput && inputTop >= COL_HEADER_HEIGHT && (
        <input
          ref={inputRef}
          type="text"
          className="cell-input"
          style={{
            position: 'absolute',
            top: inputTop,
            left: inputLeft,
            width: colWidths[selectedCell.c] - 2,
            height: rowHeights[selectedCell.r] - 2,
            fontFamily,
            zIndex: 2,
            padding: '2px',
            boxSizing: 'border-box',
          }}
          value={formula}
          onChange={e => updateCellData(e.target.value)}
          onBlur={() => setShowInput(false)}
        />
      )}
    </div>
  </div>
);

}