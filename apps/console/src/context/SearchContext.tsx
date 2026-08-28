import React, { createContext, useContext, useState, useEffect } from 'react';

export interface SearchTag {
  id?: string;
  name: string;
  slug: string;
  color?: string;
  domains?: string | null;
}

export interface SearchCategory {
  id?: string;
  name: string;
  slug: string;
  color?: string;
  keywords?: string | null;
}

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedSearchQuery: string;
  selectedTag: SearchTag | null;
  setSelectedTag: (tag: SearchTag | null) => void;
  selectedCategory: SearchCategory | null;
  setSelectedCategory: (cat: SearchCategory | null) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<SearchTag | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        selectedTag,
        setSelectedTag,
        selectedCategory,
        setSelectedCategory,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

