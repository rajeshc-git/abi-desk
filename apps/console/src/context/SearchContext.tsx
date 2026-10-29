import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

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
  ticketSearchQuery: string;
  setTicketSearchQuery: (query: string) => void;
  debouncedTicketSearchQuery: string;
  chatSearchQuery: string;
  setChatSearchQuery: (query: string) => void;
  debouncedChatSearchQuery: string;
  selectedTag: SearchTag | null;
  setSelectedTag: (tag: SearchTag | null) => void;
  selectedCategory: SearchCategory | null;
  setSelectedCategory: (cat: SearchCategory | null) => void;
  selectedOrganization: string | null;
  setSelectedOrganization: (org: string | null) => void;
  selectedProduct: string | null;
  setSelectedProduct: (prod: string | null) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isChat = location.pathname.startsWith('/chat');

  // Dedicated Ticket Desk search query & debounced query
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [debouncedTicketSearchQuery, setDebouncedTicketSearchQuery] = useState('');

  // Dedicated Live Chat search query & debounced query
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [debouncedChatSearchQuery, setDebouncedChatSearchQuery] = useState('');

  const [selectedTag, setSelectedTag] = useState<SearchTag | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTicketSearchQuery(ticketSearchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [ticketSearchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedChatSearchQuery(chatSearchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [chatSearchQuery]);

  // Contextually resolve current search query and debounced query based on route
  const searchQuery = isChat ? chatSearchQuery : ticketSearchQuery;
  const setSearchQuery = isChat ? setChatSearchQuery : setTicketSearchQuery;
  const debouncedSearchQuery = isChat ? debouncedChatSearchQuery : debouncedTicketSearchQuery;

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        debouncedSearchQuery,
        ticketSearchQuery,
        setTicketSearchQuery,
        debouncedTicketSearchQuery,
        chatSearchQuery,
        setChatSearchQuery,
        debouncedChatSearchQuery,
        selectedTag,
        setSelectedTag,
        selectedCategory,
        setSelectedCategory,
        selectedOrganization,
        setSelectedOrganization,
        selectedProduct,
        setSelectedProduct,
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

