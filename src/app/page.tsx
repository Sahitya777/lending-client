import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import MagicBento from "@/components/MagicBento";
export default function Home() {

const cardData = [
  {
    color: '#060010',
    title: 'Analytics',
    description: 'Track user behavior',
    label: 'Insights'
  },
  {
    color: '#060010',
    title: 'Dashboard',
    description: 'Centralized data view',
    label: 'Overview'
  },
  {
    color: '#060010',
    title: 'Collaboration',
    description: 'Work together seamlessly',
    label: 'Teamwork'
  },
  {
    color: '#060010',
    title: 'Automation',
    description: 'Streamline workflows',
    label: 'Efficiency'
  },
  {
    color: '#060010',
    title: 'Integration',
    description: 'Connect favorite tools',
    label: 'Connectivity'
  },
  {
    color: '#060010',
    title: 'Security',
    description: 'Enterprise-grade protection',
    label: 'Protection'
  }
];
  return (
    <div>
      <Navbar />
      <div className="flex gap-8">
        <Sidebar />
        <main className="flex-1 bg-slate-50">
          <MagicBento
            textAutoHide={true}
            enableStars={true}
            enableSpotlight={true}
            enableBorderGlow={true}
            enableTilt={true}
            enableMagnetism={true}
            clickEffect={true}
            spotlightRadius={5}
            particleCount={12}
            glowColor="132, 0, 255"
            cardData={cardData}
          />
        </main>
      </div>
    </div>
  );
}
