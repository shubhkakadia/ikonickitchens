import React from "react";

export default function Loader() {
  return (
    <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-900">
        {" "} 
      </div>
    </div>
  );
}
