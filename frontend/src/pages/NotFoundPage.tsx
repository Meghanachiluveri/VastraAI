import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/common/PageContainer';
import { Button } from '../components/common/Button';
import { Sparkles, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <PageContainer size="sm" className="py-28 text-center space-y-6">
      <span className="text-xs uppercase tracking-widest text-accent-sage font-semibold">
        404 — Page Not Found
      </span>
      <h1 className="text-4xl sm:text-5xl font-serif text-text-primary">
        An Uncharted Silhouette
      </h1>
      <p className="text-sm text-text-secondary max-w-md mx-auto font-light leading-relaxed">
        The destination you are looking for has been relocated or archived. 
        Allow our AI Stylist to guide you back to our curated collections.
      </p>

      <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          variant="secondary"
          size="md"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/')}
        >
          Return to Atelier
        </Button>
        <Button
          variant="sage"
          size="md"
          leftIcon={<Sparkles className="w-4 h-4 text-[#FBFAF6]" />}
          onClick={() => navigate('/agent')}
        >
          Consult AI Stylist
        </Button>
      </div>
    </PageContainer>
  );
};
