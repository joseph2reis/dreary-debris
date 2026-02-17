import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  // Estado tipado como boolean para controle do tema
  const [isLight, setIsLight] = useState<boolean>(false);

  useEffect(() => {
    // Sincroniza o estado inicial com a classe no HTML ao montar o componente
    const isLightMode = document.documentElement.classList.contains('light');
    setIsLight(isLightMode);
  }, []);

  const toggleTheme = (): void => {
    const root = document.documentElement;
    
    if (isLight) {
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setIsLight(false);
    } else {
      root.classList.add('light');
      localStorage.setItem('theme', 'light');
      setIsLight(true);
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm overflow-hidden"
      aria-label="Alternar tema"
    >
      {/* Ícone de Sol (Visível no Light Mode) */}
      <svg
        className={`absolute h-5 w-5 text-primary transition-all duration-300 ${
          isLight ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
        />
      </svg>

      {/* Ícone de Lua (Visível no Dark Mode) */}
      <svg
        className={`absolute h-5 w-5 text-primary transition-all duration-300 ${
          !isLight ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
}