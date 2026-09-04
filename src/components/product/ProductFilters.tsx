import React, { useState } from 'react';
import type { FilterState } from '../../types/product';
import { COLOR_SWATCHES, FILTER_SIZES } from '../../services/productService';
import { formatCurrency } from '../../lib/utils';
import { SlidersHorizontal, X, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';

export interface ProductFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  totalResults: number;
  hideGenderFilter?: boolean;
}

const CATEGORY_OPTIONS = [
  'Shirts',
  'T-Shirts',
  'Jeans',
  'Dresses',
  'Jackets',
  'Ethnic Wear',
  'Footwear',
  'Accessories',
];

const GENDER_OPTIONS = [
  { id: 'all', label: 'All Silhouettes' },
  { id: 'men', label: 'Men' },
  { id: 'women', label: 'Women' },
  { id: 'unisex', label: 'Unisex' },
];

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  onFilterChange,
  totalResults,
  hideGenderFilter = false,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    categories: true,
    gender: true,
    price: true,
    sizes: true,
    colors: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCategoryToggle = (categoryName: string) => {
    const exists = filters.categories.includes(categoryName);
    const nextCategories = exists
      ? filters.categories.filter((c) => c !== categoryName)
      : [...filters.categories, categoryName];
    onFilterChange({ ...filters, categories: nextCategories });
  };

  const handleGenderSelect = (genderId: FilterState['gender']) => {
    onFilterChange({ ...filters, gender: genderId });
  };

  const handleSizeToggle = (size: string) => {
    const exists = filters.sizes.includes(size);
    const nextSizes = exists
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onFilterChange({ ...filters, sizes: nextSizes });
  };

  const handleColorToggle = (colorName: string) => {
    const exists = filters.colors.includes(colorName);
    const nextColors = exists
      ? filters.colors.filter((c) => c !== colorName)
      : [...filters.colors, colorName];
    onFilterChange({ ...filters, colors: nextColors });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxVal = Number(e.target.value);
    onFilterChange({ ...filters, priceRange: [filters.priceRange[0], maxVal] });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, sortBy: e.target.value as FilterState['sortBy'] });
  };

  const clearAllFilters = () => {
    onFilterChange({
      ...filters,
      categories: [],
      sizes: [],
      colors: [],
      priceRange: [0, 30000],
      searchQuery: '',
      gender: hideGenderFilter ? filters.gender : 'all',
    });
  };

  const activeFilterCount =
    filters.categories.length +
    filters.sizes.length +
    filters.colors.length +
    (filters.priceRange[1] < 30000 ? 1 : 0) +
    (!hideGenderFilter && filters.gender !== 'all' ? 1 : 0);

  // Filter Form Controls Content
  const filterControls = (
    <div className="space-y-6 text-xs text-[#2A2A2A] dark:text-[#F6F7F2]">
      
      {/* 1. Category Filter */}
      <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <button
          onClick={() => toggleSection('categories')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Category</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.categories ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.categories && (
          <div className="space-y-1.5 pt-1">
            {CATEGORY_OPTIONS.map((cat) => {
              const isChecked = filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-left transition-colors ${
                    isChecked
                      ? 'bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold'
                      : 'hover:bg-surface-elevated text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2]'
                  }`}
                >
                  <span>{cat}</span>
                  {isChecked && <Check className="w-3.5 h-3.5 text-[#8AA48A]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Gender Filter */}
      {!hideGenderFilter && (
        <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
          <button
            onClick={() => toggleSection('gender')}
            className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
          >
            <span>Gender / Universe</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
                openSections.gender ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openSections.gender && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {GENDER_OPTIONS.map((g) => {
                const isSelected = filters.gender === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGenderSelect(g.id as FilterState['gender'])}
                    className={`py-1.5 px-3 rounded-full border text-[11px] font-medium transition-all ${
                      isSelected
                        ? 'border-[#8AA48A] bg-[#8AA48A] text-[#2A2A2A] font-semibold shadow-xs'
                        : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A] bg-surface'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Price Range Slider */}
      <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <button
          onClick={() => toggleSection('price')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Price Range</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.price ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.price && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-text-secondary font-normal">Up to:</span>
              <span className="text-[#2A2A2A] dark:text-[#F6F7F2]">{formatCurrency(filters.priceRange[1])}</span>
            </div>
            <input
              type="range"
              min="1500"
              max="30000"
              step="500"
              value={filters.priceRange[1]}
              onChange={handlePriceChange}
              className="w-full accent-[#8AA48A] cursor-pointer bg-stone-200 dark:bg-stone-700 h-1.5 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-text-secondary">
              <span>{formatCurrency(0)}</span>
              <span>{formatCurrency(30000)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Sizes Filter */}
      <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <button
          onClick={() => toggleSection('sizes')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Atelier Sizes</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.sizes ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.sizes && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {FILTER_SIZES.map((size) => {
              const isSelected = filters.sizes.includes(size);
              return (
                <button
                  key={size}
                  onClick={() => handleSizeToggle(size)}
                  className={`py-1.5 px-2 rounded-full border text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'border-[#8AA48A] bg-[#CFD8CF] text-[#2A2A2A] font-semibold'
                      : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A] bg-surface'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Colors Circular Swatches */}
      <div className="space-y-3">
        <button
          onClick={() => toggleSection('colors')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Colorways</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.colors ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.colors && (
          <div className="grid grid-cols-4 gap-3 pt-2">
            {COLOR_SWATCHES.map((swatch) => {
              const isSelected = filters.colors.includes(swatch.name);
              return (
                <button
                  key={swatch.name}
                  onClick={() => handleColorToggle(swatch.name)}
                  title={swatch.label}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div
                    className={`w-7 h-7 rounded-full transition-all flex items-center justify-center ${
                      isSelected
                        ? 'ring-2 ring-[#8AA48A] ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105 opacity-80 group-hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: swatch.hex,
                      border: `1px solid ${swatch.border}`,
                    }}
                  >
                    {isSelected && (
                      <Check className={`w-3.5 h-3.5 ${swatch.name === 'White' ? 'text-[#2A2A2A]' : 'text-white'}`} />
                    )}
                  </div>
                  <span className="text-[9px] text-text-secondary font-medium tracking-tight truncate w-full text-center">
                    {swatch.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );

  return (
    <div className="w-full">
      
      {/* Top Bar: Active Summary, Mobile Drawer Trigger, and Sort Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        
        {/* Left: Mobile Trigger & Result Count */}
        <div className="flex items-center gap-3">
          
          {/* Mobile Filter Drawer Button */}
          <button
            onClick={() => setIsMobileOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#E6E2DA] dark:border-[#3E443D] bg-surface text-xs font-semibold uppercase tracking-wider text-text-primary hover:border-[#8AA48A]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#8AA48A]" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#8AA48A] text-[#2A2A2A] text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          <span className="text-xs uppercase tracking-widest text-text-secondary font-medium">
            {totalResults} {totalResults === 1 ? 'Garment' : 'Garments'} Curated
          </span>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-[#8AA48A] hover:underline flex items-center gap-1 font-medium ml-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Sort By Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <label htmlFor="sort-by-select" className="text-xs uppercase tracking-widest text-text-secondary font-medium">
            Sort by:
          </label>
          <select
            id="sort-by-select"
            value={filters.sortBy}
            onChange={handleSortChange}
            className="bg-surface text-[#2A2A2A] dark:text-[#F6F7F2] text-xs tracking-wider uppercase border border-[#E6E2DA] dark:border-[#3E443D] rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#8AA48A] cursor-pointer"
          >
            <option value="popular">Popular Edit</option>
            <option value="rating">Client Rating</option>
            <option value="newest">New Arrivals</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

      </div>

      {/* Active Filter Chips Bar */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-[11px] uppercase tracking-widest text-text-secondary mr-1 font-semibold">
            Active:
          </span>

          {filters.categories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] text-xs font-medium border border-[#8AA48A]/40"
            >
              <span>{c}</span>
              <button onClick={() => handleCategoryToggle(c)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.sizes.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] text-xs font-medium border border-[#8AA48A]/40"
            >
              <span>Size: {s}</span>
              <button onClick={() => handleSizeToggle(s)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.colors.map((color) => (
            <span
              key={color}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] text-xs font-medium border border-[#8AA48A]/40"
            >
              <span>Color: {color}</span>
              <button onClick={() => handleColorToggle(color)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {filters.priceRange[1] < 30000 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] text-xs font-medium border border-[#8AA48A]/40">
              <span>Under {formatCurrency(filters.priceRange[1])}</span>
              <button
                onClick={() => onFilterChange({ ...filters, priceRange: [0, 30000] })}
                className="hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Mobile Drawer */}
      <Drawer
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        side="left"
        width="md"
        title="Refine Collection"
        footer={
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => setIsMobileOpen(false)}
            >
              Show {totalResults} Results
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={clearAllFilters}
            >
              Reset
            </Button>
          </div>
        }
      >
        <div className="py-2">{filterControls}</div>
      </Drawer>

    </div>
  );
};

export const DesktopFilterSidebar: React.FC<{
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  hideGenderFilter?: boolean;
}> = ({ filters, onFilterChange, hideGenderFilter = false }) => {
  const [openSections, setOpenSections] = useState({
    categories: true,
    gender: true,
    price: true,
    sizes: true,
    colors: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCategoryToggle = (categoryName: string) => {
    const exists = filters.categories.includes(categoryName);
    const nextCategories = exists
      ? filters.categories.filter((c) => c !== categoryName)
      : [...filters.categories, categoryName];
    onFilterChange({ ...filters, categories: nextCategories });
  };

  const handleGenderSelect = (genderId: FilterState['gender']) => {
    onFilterChange({ ...filters, gender: genderId });
  };

  const handleSizeToggle = (size: string) => {
    const exists = filters.sizes.includes(size);
    const nextSizes = exists
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onFilterChange({ ...filters, sizes: nextSizes });
  };

  const handleColorToggle = (colorName: string) => {
    const exists = filters.colors.includes(colorName);
    const nextColors = exists
      ? filters.colors.filter((c) => c !== colorName)
      : [...filters.colors, colorName];
    onFilterChange({ ...filters, colors: nextColors });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxVal = Number(e.target.value);
    onFilterChange({ ...filters, priceRange: [filters.priceRange[0], maxVal] });
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-[#FCFCF9] dark:bg-[#343833] p-5 rounded-3xl border border-[#E6E2DA] dark:border-[#3E443D] shadow-subtle space-y-6 text-xs text-[#2A2A2A] dark:text-[#F6F7F2] sticky top-28 self-start">
      <div className="flex items-center justify-between pb-3 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#8AA48A]" />
          <span className="font-semibold uppercase tracking-widest text-xs text-text-primary">
            Refine By
          </span>
        </div>
      </div>

      {/* 1. Category */}
      <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <button
          onClick={() => toggleSection('categories')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Category</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.categories ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.categories && (
          <div className="space-y-1 pt-1">
            {CATEGORY_OPTIONS.map((cat) => {
              const isChecked = filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-left transition-colors ${
                    isChecked
                      ? 'bg-[#CFD8CF] dark:bg-[#3E443D] text-[#2A2A2A] dark:text-[#F6F7F2] font-semibold'
                      : 'hover:bg-surface-elevated text-text-secondary hover:text-[#2A2A2A] dark:hover:text-[#F6F7F2]'
                  }`}
                >
                  <span>{cat}</span>
                  {isChecked && <Check className="w-3.5 h-3.5 text-[#8AA48A]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Gender */}
      {!hideGenderFilter && (
        <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
          <button
            onClick={() => toggleSection('gender')}
            className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
          >
            <span>Gender / Universe</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
                openSections.gender ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openSections.gender && (
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {GENDER_OPTIONS.map((g) => {
                const isSelected = filters.gender === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGenderSelect(g.id as FilterState['gender'])}
                    className={`py-1.5 px-2.5 rounded-full border text-[11px] font-medium transition-all text-center ${
                      isSelected
                        ? 'border-[#8AA48A] bg-[#8AA48A] text-[#2A2A2A] font-semibold shadow-xs'
                        : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A] bg-surface'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Price Slider */}
      <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <button
          onClick={() => toggleSection('price')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Price Range</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.price ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.price && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-text-secondary font-normal">Max:</span>
              <span className="text-[#2A2A2A] dark:text-[#F6F7F2]">{formatCurrency(filters.priceRange[1])}</span>
            </div>
            <input
              type="range"
              min="1500"
              max="30000"
              step="500"
              value={filters.priceRange[1]}
              onChange={handlePriceChange}
              className="w-full accent-[#8AA48A] cursor-pointer bg-stone-200 dark:bg-stone-700 h-1.5 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-text-secondary">
              <span>{formatCurrency(0)}</span>
              <span>{formatCurrency(30000)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Sizes */}
      <div className="space-y-3 pb-5 border-b border-[#E6E2DA] dark:border-[#3E443D]">
        <button
          onClick={() => toggleSection('sizes')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Sizes</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.sizes ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.sizes && (
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {FILTER_SIZES.map((size) => {
              const isSelected = filters.sizes.includes(size);
              return (
                <button
                  key={size}
                  onClick={() => handleSizeToggle(size)}
                  className={`py-1.5 px-2 rounded-full border text-[11px] font-medium transition-all text-center ${
                    isSelected
                      ? 'border-[#8AA48A] bg-[#CFD8CF] text-[#2A2A2A] font-semibold'
                      : 'border-[#E6E2DA] dark:border-[#3E443D] text-text-secondary hover:border-[#8AA48A] bg-surface'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Colors */}
      <div className="space-y-3">
        <button
          onClick={() => toggleSection('colors')}
          className="w-full flex items-center justify-between font-semibold uppercase tracking-widest text-[11px] text-text-primary"
        >
          <span>Colorways</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
              openSections.colors ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.colors && (
          <div className="grid grid-cols-4 gap-2.5 pt-1">
            {COLOR_SWATCHES.map((swatch) => {
              const isSelected = filters.colors.includes(swatch.name);
              return (
                <button
                  key={swatch.name}
                  onClick={() => handleColorToggle(swatch.name)}
                  title={swatch.label}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div
                    className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${
                      isSelected
                        ? 'ring-2 ring-[#8AA48A] ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-105 opacity-80 group-hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: swatch.hex,
                      border: `1px solid ${swatch.border}`,
                    }}
                  >
                    {isSelected && (
                      <Check className={`w-3 h-3 ${swatch.name === 'White' ? 'text-[#2A2A2A]' : 'text-white'}`} />
                    )}
                  </div>
                  <span className="text-[9px] text-text-secondary font-medium tracking-tight truncate w-full text-center">
                    {swatch.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </aside>
  );
};
