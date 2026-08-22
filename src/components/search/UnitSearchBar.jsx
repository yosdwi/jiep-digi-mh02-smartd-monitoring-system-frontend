import React, { useState, useMemo } from 'react';
import styles from './UnitSearchBar.module.css';

export const UnitSearchBar = ({ units, onUnitSelect }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const filteredUnits = useMemo(() => {
    if (!query) return [];
    return units.filter(unit => 
      unit.unitNo.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5); // Batasi hingga 5 hasil untuk kejelasan
  }, [query, units]);

  const handleSelect = (unit) => {
    setQuery('');
    setIsFocused(false);
    onUnitSelect(unit);
  };

  const showSuggestions = isFocused && query.length > 0 && filteredUnits.length > 0;

  return (
    <div className={styles.searchContainer}>
      <input 
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)} // delay to allow click
        placeholder="Cari Unit No..."
        className={styles.searchInput}
      />
      {showSuggestions && (
        <ul className={styles.suggestionsList}>
          {filteredUnits.map(unit => (
            <li 
              key={unit.deviceId} 
              onMouseDown={() => handleSelect(unit)} // onMouseDown fires before onBlur
              className={styles.suggestionItem}
            >
              <span className={styles.unitNo}>{unit.unitNo}</span>
              <span className={styles.unitType}>{unit.deviceType}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
