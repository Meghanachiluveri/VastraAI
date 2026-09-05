export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  gender: "men" | "women" | "unisex";
  category: string;
  subcategory?: string;
  sizes: string[];
  colors: string[];
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  material?: string;
  occasion?: string;
  styleTags?: string[];
  isNew?: boolean;
  isArchived?: boolean;
  createdAt?: string;
}

export type ProductGender = "men" | "women" | "unisex";
