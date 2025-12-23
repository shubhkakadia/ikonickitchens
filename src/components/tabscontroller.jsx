import React from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";

export default function TabsController({ href, title, back = false, children }) {
  const router = useRouter();
  const dispatch = useDispatch();

  const handleClick = () => {
    if (back) {
      router.back();
      return;
    }

    router.push(href);
    dispatch(
      replaceTab({
        id: uuidv4(),
        title,
        href,
      })
    );
  };

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
}
