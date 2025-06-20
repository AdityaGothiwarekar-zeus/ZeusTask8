import React, { useState, useRef } from 'react';
import './Header.css';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrosoft } from '@fortawesome/free-brands-svg-icons';

const Header = ({ onLoadData, onFontChange }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedFont, setSelectedFont] = useState('Arial');
  const fileInputRef = useRef(null);

  const tabs = ['File', 'Home', 'Insert', 'Formulas', 'Data', 'View'];

  const fonts = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  ];

  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target.result);
        if (Array.isArray(json)) {
          onLoadData(json);
        } else {
          alert("Invalid JSON format (expected an array of objects)");
        }
      } catch (err) {
        alert("Error parsing JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFontChange = e => {
    const newFont = e.target.value;
    setSelectedFont(newFont);
    if (onFontChange) onFontChange(newFont);
  };

  return (
    <header className="excel-header">
      <div className="logo">
        <FontAwesomeIcon icon={faMicrosoft} style={{ color: '#217346', marginRight: '8px', fontSize: '24px' }} />
        Excel Clone
      </div>

      <nav className="toolbar">
        {tabs.map(tab => (
          <div
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}

        {/* Font style dropdown */}
        <select
          className="font-dropdown"
          value={selectedFont}
          onChange={handleFontChange}
          title="Select Font Style"
        >
          {fonts.map(font => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Load JSON button */}
        <button
          className="load-json-btn"
          onClick={triggerFileInput}
          title="Load JSON file"
          type="button"
        >
          📂 Load JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          hidden
          onChange={handleFileChange}
        />
      </nav>
    </header>
  );
};

export default Header;
