import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import MagicBento from "@/components/MagicBento";
import HomeScreenDashboard from "@/components/HomescreenDashboard";
export default function Home() {

  return (
    <div className="">
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <Navbar/>
          <HomeScreenDashboard data={undefined}/>
        </main>
      </div>
    </div>
  );
}
