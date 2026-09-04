import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageContainer } from '../components/common/PageContainer';
import { SectionHeading } from '../components/common/SectionHeading';
import { ProductGrid } from '../components/product/ProductGrid';
import { ProductFilters, DesktopFilterSidebar } from '../components/product/ProductFilters';
import { api } from '../services/api';
import type { Product } from '../types/types';
import type { FilterState } from '../types/product';
import { productService } from '../services/productService';

export const ShopPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialCategoryParam = searchParams.get('category');

  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    category: 'all',
    categories: initialCategoryParam ? [initialCategoryParam] : [],
    gender: 'all',
    sizes: [],
    colors: [],
    priceRange: [0, 30000],
    sortBy: 'popular',
  });

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getProducts();
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
      gender: 'all',
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
          eyebrow="The Full Collection"
          title="Discover your Vastra"
          subtitle="Explore 30 signature garments tailored from organic Khadi, Chanderi silk, and Pashmina fleece."
          align="center"
        />

        {/* Mobile Filter Summary & Sort Bar */}
        <ProductFilters
          filters={filters}
          onFilterChange={setFilters}
          totalResults={filteredProducts.length}
        />

        {/* 2-Column Discovery Layout (Left Sidebar + Right Product Grid) */}
        <div className="flex gap-8 items-start pt-2">
          
          {/* Desktop Filter Sidebar */}
          <div className="hidden lg:block">
            <DesktopFilterSidebar
              filters={filters}
              onFilterChange={setFilters}
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
