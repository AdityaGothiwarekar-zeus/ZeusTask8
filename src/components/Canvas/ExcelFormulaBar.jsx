
import React from 'react';
import './StatsPanel.css';
import { getColLetter } from '../../Utils';

function StatsPanel({ stats, selection }) {
  const emptyStats = {
    count: 0,
    sum: 0,
    avg: 0,
    min: 0,
    max: 0,
  };

  const safeStats = stats || emptyStats;

  return (
    <div className="formula-bar">
      {/* <span><strong>Count:</strong> {safeStats.count}</span> */}
      <span><strong>Sum:</strong> {safeStats.sum.toFixed(2)}</span>
      <span><strong>Avg:</strong> {safeStats.avg.toFixed(2)}</span>
      <span><strong>Min:</strong> {safeStats.min}</span>
      <span><strong>Max:</strong> {safeStats.max}</span>
      <span className="range-display">
        Range: {getColLetter(selection.startCol)}{selection.startRow + 1}:{getColLetter(selection.endCol)}{selection.endRow + 1}
      </span>
    </div>
  );
}

export default StatsPanel;