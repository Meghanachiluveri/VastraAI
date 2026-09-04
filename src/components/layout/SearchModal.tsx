import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { useUIStore } from '../../stores/useUIStore';
import { api } from '../../services/api';
import type { Product } from '../../types/types';
import { formatCurrency } from '../../lib/utils';
import { Search, Sparkles, ArrowRight, X } from 'lucide-react';

export const SearchModal: React.FC = () => {
  const { isSearchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      const results = await api.searchProducts(query);
      setSearchResults(results.slice(0, 5));
    };
    performSearch();
  }, [query]);

  const handleSelectProduct = (productId: string) => {
    closeSearch();
    setQuery('');
    navigate(`/product/${productId}`);
  };

  const handleAIQuery = (prompt: string) => {
    closeSearch();
    setQuery('');
    window.open(`/agent?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener,noreferrer');
  };

  const popularSearches = [
    'Raw Mulberry Silk',
    'Chanderi Silk Dress',
    'Cashmere Saree Gown',
    'Khadi Linen Kurta',
    'Artisan Bomber',
    'Italian Nappa Loafers',
  ];

  return (
    <Modal
      isOpen={isSearchOpen}
      onClose={closeSearch}
      maxWidth="2xl"
      showCloseButton={false}
    >
      <div className="space-y-6">
        
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-[#E6E2DA] dark:border-[#3E443D] pb-3">
          <Search className="w-5 h-5 text-text-secondary mr-3 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search silhouettes, fabrics, colors, or categories..."
            className="w-full bg-transparent text-base text-[#2A2A2A] dark:text-[#F6F7F2] placeholder-text-secondary/60 focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-text-secondary hover:text-text-primary p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* AI Stylist Direct Search Prompt */}
        <div
          onClick={() => handleAIQuery(query || 'Curate artisanal luxury garments')}
          className="flex items-center justify-between p-4 bg-[#CFD8CF]/60 hover:bg-[#CFD8CF] border border-[#8AA48A]/30 rounded-2xl cursor-pointer transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#8AA48A]" />
            <span className="text-xs text-[#2A2A2A] font-medium">
              {query ? `Ask AI Stylist: "${query}"` : 'Ask Vastra AI Stylist for bespoke curation'}
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[#8AA48A] group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Live Search Results */}
        {query.trim() && (
          <div className="space-y-3">
            <h4 className="text-[11px] uppercase tracking-widest text-text-secondary font-semibold">
              Matching Garments ({searchResults.length})
            </h4>

            {searchResults.length === 0 ? (
              <p className="text-xs text-text-secondary py-4 font-light">
                No direct keyword matches found. Try our AI Stylist for natural language curation.
              </p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product.id)}
                    className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#CFD8CF]/40 cursor-pointer border border-transparent hover:border-[#E6E2DA] dark:hover:border-[#3E443D] transition-all"
                  >
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-12 aspect-[3/4] object-cover rounded-xl border border-[#E6E2DA]"
                    />
                    <div className="flex-1">
                      <h5 className="text-xs font-medium text-[#2A2A2A] dark:text-[#F6F7F2]">{product.name}</h5>
                      <p className="text-[11px] text-text-secondary">{product.category}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#2A2A2A] dark:text-[#F6F7F2]">
                      {formatCurrency(product.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Popular Inquiries */}
        {!query.trim() && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] uppercase tracking-widest text-text-secondary font-semibold">
              Trending Inquiries
            </span>
            <div className="flex flex-wrap gap-2">
              {popularSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="text-xs px-3.5 py-1.5 rounded-full bg-[#CFD8CF]/60 hover:bg-[#CFD8CF] text-[#2A2A2A] border border-[#B2C4B2]/30 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};
