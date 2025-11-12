import React from 'react'
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { replaceTab } from '@/state/reducer/tabs';
import { v4 as uuidv4 } from 'uuid';
export default function TabsController({ href, title, children }) {
    const router = useRouter();
    const dispatch = useDispatch();
  return (
    <button onClick={() => {router.push(href); dispatch(replaceTab({id: uuidv4(), title: title, href: href}));}}>
      {children}
    </button>
  )
}
