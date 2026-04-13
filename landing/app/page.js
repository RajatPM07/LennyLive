import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import FeatureShowcase from '@/components/FeatureShowcase';
import SocialProof from '@/components/SocialProof';
import DemoPreview from '@/components/DemoPreview';
import WaitlistCTA from '@/components/WaitlistCTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <FeatureShowcase />
      <SocialProof />
      <DemoPreview />
      <WaitlistCTA />
      <Footer />
    </main>
  );
}
