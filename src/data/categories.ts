export interface CategoryMeta {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  itemCount: number;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'men',
    name: 'Men',
    slug: '/men',
    description: 'Sculpted silhouettes, raw silk bandhgalas, and relaxed tailored linen for the contemporary discerning gentleman.',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=85',
    itemCount: 24,
  },
  {
    id: 'women',
    name: 'Women',
    slug: '/women',
    description: 'Chanderi sheer trench coats, cashmere saree gowns, and fluid pleated co-ord ensembles.',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=85',
    itemCount: 36,
  },
  {
    id: 'new-arrivals',
    name: 'New Arrivals',
    slug: '/new-arrivals',
    description: 'The latest seasonal drop marrying machine intelligence with artisanal handcraft.',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=85',
    itemCount: 18,
  },
  {
    id: 'sale',
    name: 'Curated Archive',
    slug: '/sale',
    description: 'Selected archival pieces and seasonal offerings at privileged pricing.',
    image: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=1200&q=85',
    itemCount: 12,
  },
];
