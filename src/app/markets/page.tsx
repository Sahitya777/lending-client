import MarketDashboard from '@/components/MarketDashboard'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'

import React from 'react'

const page = () => {
  return (
        <div>
      {/* <Navbar /> */}
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <Navbar/>
          <MarketDashboard/>
        </main>
      </div>
    </div>
  )
}

export default page