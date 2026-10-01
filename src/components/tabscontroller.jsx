import React from "react";
import { useRouter } from "next/navigation";

export default function TabsController({ href, back = false, children }) {
  const router = useRouter();

  const handleClick = () => {
    if (back) {
      router.back();
      return;
    }

    router.push(href);
  };

  return <button onClick={handleClick}>{children}</button>;
}
