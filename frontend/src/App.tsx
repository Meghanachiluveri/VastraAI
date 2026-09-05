import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { MenPage } from './pages/MenPage';
import { WomenPage } from './pages/WomenPage';
import { NewArrivalsPage } from './pages/NewArrivalsPage';
import { SalePage } from './pages/SalePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { AgentPage } from './pages/AgentPage';
import { MerchantPage } from './pages/MerchantPage';
import { MerchantLoginPage } from './pages/MerchantLoginPage';
import { MerchantRoute } from './components/merchant/MerchantRoute';
import { NotFoundPage } from './pages/NotFoundPage';

// Scroll to top helper on route change
function ScrollToTop() {
  const { pathname } = window.location;
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/merchant/login" element={<MerchantLoginPage />} />
        <Route
          path="/merchant"
          element={
            <MerchantRoute>
              <MerchantPage />
            </MerchantRoute>
          }
        />
        <Route
          path="/merchant/dashboard"
          element={
            <MerchantRoute>
              <MerchantPage />
            </MerchantRoute>
          }
        />
        <Route
          path="/merchant/*"
          element={
            <MerchantRoute>
              <MerchantPage />
            </MerchantRoute>
          }
        />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="men" element={<MenPage />} />
          <Route path="women" element={<WomenPage />} />
          <Route path="new-arrivals" element={<NewArrivalsPage />} />
          <Route path="archive" element={<SalePage />} />
          <Route path="sale" element={<SalePage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
