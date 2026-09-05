import React, { useState, useEffect } from 'react';
import { PageContainer } from '../components/common/PageContainer';
import { SectionHeading } from '../components/common/SectionHeading';
import { ProductGrid } from '../components/product/ProductGrid';
import { ProductFilters, DesktopFilterSidebar } from '../components/product/ProductFilters';
import { api } from '../services/api';
import type { Product } from '../types/types';
import type { FilterState } from '../types/product';
import { productService } from '../services/productService';

export const WomenPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    categories: [],
    gender: 'women',
    sizes: [],
    colors: [],
    priceRange: [0, 30000],
    sortBy: 'popular',
  });

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getProductsByGender('women');
      setProducts(data);
    } catch {
      setError('Unable to reach the backend service. Please ensure the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const applyFilters = async () => {
      const filtered = await productService.filterProducts(products, filters);
      setFilteredProducts(filtered);
    };
    applyFilters();
  }, [products, filters]);

  const handleClearFilters = () => {
    setFilters({
      category: 'all',
      categories: [],
      gender: 'women',
      sizes: [],
      colors: [],
      priceRange: [0, 30000],
      sortBy: 'popular',
    });
  };

  return (
    <div className="py-10 md:py-14 space-y-8">
      <PageContainer>
        
        {/* Header */}
        <SectionHeading
          eyebrow="Women's Atelier"
          title="Feminine, sculpted"
          subtitle="Chanderi silk fluted trench dresses, pre-draped cashmere sarees, tussar silk co-ord sets, and zari handloom organza."
          align="center"
        />

        {/* Mobile Filter Summary & Sort Bar */}
        <ProductFilters
          filters={filters}
          onFilterChange={setFilters}
          totalResults={filteredProducts.length}
          hideGenderFilter
        />

        {/* 2-Column Discovery Layout */}
        <div className="flex gap-8 items-start pt-2">
          
          {/* Desktop Filter Sidebar */}
          <div className="hidden lg:block">
            <DesktopFilterSidebar
              filters={filters}
              onFilterChange={setFilters}
              hideGenderFilter
            />
          </div>

          {/* Right Main Grid Area */}
          <div className="flex-1 w-full">
            <ProductGrid
              products={filteredProducts}
              isLoading={isLoading}
              error={error}
              onRetry={loadData}
              onClearFilters={handleClearFilters}
              columns={3}
            />
          </div>

        </div>

      </PageContainer>
    </div>
  );
};
