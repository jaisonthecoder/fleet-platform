import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

import styles from './GlobalTrackSearch.module.css';

export interface GlobalTrackSearchProps {
  label: string;
  placeholder: string;
  actionLabel: string;
  onSearch?: (query: string) => void;
}

/** Persistent shipment lookup. The search callback is wired by the tracking slice. */
export function GlobalTrackSearch({ label, placeholder, actionLabel, onSearch }: GlobalTrackSearchProps) {
  const [query, setQuery] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (value && onSearch) onSearch(value);
  };

  return (
    <form className={styles.search} role="search" onSubmit={submit}>
      <div className={styles.control}>
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          aria-label={label}
          placeholder={placeholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" aria-label={actionLabel} title={actionLabel} disabled={!query.trim() || !onSearch}>
          <Search aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
