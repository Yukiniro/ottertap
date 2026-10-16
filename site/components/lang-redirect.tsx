'use client';
import { useEffect } from 'react';

export function LangRedirect() {
  useEffect(() => {
    location.replace(navigator.language.toLowerCase().startsWith('zh') ? '/zh/' : '/en/');
  }, []);
  return null;
}
