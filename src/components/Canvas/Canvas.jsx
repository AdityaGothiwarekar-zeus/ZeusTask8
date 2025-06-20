import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import './Grid.css';
import Header from '../Navbar/Header';

const INITIAL_CELL_WIDTH = 70;
const INITIAL_CELL_HEIGHT = 24;
const COL_HEADER_HEIGHT = 24;
const ROW_HEADER_WIDTH = 40;
const TOTAL_ROWS = 50000;

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

export default function GridPage() {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

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

  const handleFontChange = newFont => setFontFamily(newFont);

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
  };

  const onCanvasClick = e => {
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
    if (dx < ROW_HEADER_WIDTH || dy < COL_HEADER_HEIGHT) return;

    let cx = ROW_HEADER_WIDTH;
    let c = -1;
    for (let i = 0; i < visibleCols; i++) {
      cx += colWidths[i];
      if (dx < cx) { c = i; break; }
    }
    if (c < 0) return;

    const [startRow, endRow, startY] = getVisibleRowRange();
    let y = COL_HEADER_HEIGHT - (scrollTop - startY);
    let r = -1;
    for (let i = startRow; i <= endRow; i++) {
      const h = rowHeights[i];
      if (dy < y + h) {
        r = i;
        break;
      }
      y += h;
    }
    if (r < 0) return;

    setSelectedCell({ r, c });
    const key = `${r},${c}`;
    setFormula(cellData[key] || '');
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus());
  };

  const updateCellData = val => {
    const { r, c } = selectedCell;
    const key = `${r},${c}`;
    setFormula(val);
    setCellData(d => ({ ...d, [key]: val }));
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

    let x = ROW_HEADER_WIDTH;
    for (let ci = 0; ci < visibleCols; ci++) {
      const w = colWidths[ci];
      ctx.fillStyle = (selectedCell.c === ci) ? '#90ee90' : '#f0f0f0';
      ctx.fillRect(x, 0, w, COL_HEADER_HEIGHT);
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.fillText(getColLetter(ci), x + w / 2, COL_HEADER_HEIGHT / 2);
      ctx.strokeStyle = 'black';
      ctx.strokeRect(x, 0, w, COL_HEADER_HEIGHT);
      x += w;
    }

    let y = COL_HEADER_HEIGHT - (scrollTop - startY);
    for (let ri = startRow; ri <= endRow; ri++) {
      const h = rowHeights[ri];
      ctx.fillStyle = (selectedCell.r === ri) ? '#90ee90' : '#f0f0f0';
      ctx.fillRect(0, y, ROW_HEADER_WIDTH, h);
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.fillText(ri + 1, ROW_HEADER_WIDTH / 2, y + h / 2);
      ctx.strokeStyle = 'black';
      ctx.strokeRect(0, y, ROW_HEADER_WIDTH, h);
      y += h;
    }

    x = ROW_HEADER_WIDTH;
    for (let ci = 0; ci < visibleCols; ci++) {
      const w = colWidths[ci];
      y = COL_HEADER_HEIGHT - (scrollTop - startY);
      for (let ri = startRow; ri <= endRow; ri++) {
        const h = rowHeights[ri];
        const key = `${ri},${ci}`;
        ctx.fillStyle = (selectedCell.r === ri && selectedCell.c === ci) ? '#cde8ff' : 'white';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#ccc';
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
  }, [visibleCols, colWidths, rowHeights, cellData, selectedCell, scrollTop, fontFamily]);

  const inputLeft = getColStartX(selectedCell.c);
  const inputTop = getRowStartY(selectedCell.r) - scrollTop;
  const [startRow, endRow] = getVisibleRowRange();

  return (
    <div
      ref={wrapperRef}
      className="grid-wrapper"
      onScroll={onScroll}
      style={{ height: '100vh', width: '100vw', overflow: 'auto', position: 'relative' }}
    >
      <Header onLoadData={handleLoadData} onFontChange={handleFontChange} />
      <div className="formula-bar">
        <div className="cell-label">{getColLetter(selectedCell.c)}{selectedCell.r + 1}</div>
        <input
          type="text"
          className="formula-input"
          value={formula}
          onChange={e => updateCellData(e.target.value)}
        />
      </div>
      <div style={{ position: 'relative', width: totalWidth, height: totalHeight }}>
        <canvas
          ref={canvasRef}
          className="spreadsheet-canvas"
          onClick={onCanvasClick}
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
