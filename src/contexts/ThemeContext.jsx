import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Check for saved theme preference or default to system preference
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }

    // Check system preference
    if (window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return false;
  });

  // Current theme name (default, gemini)
  const [themeName, setThemeName] = useState(() => {
    return localStorage.getItem('theme-name') || 'default';
  });

  // Update document class and localStorage when theme changes
  useEffect(() => {
    // Handle Dark Mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    // Handle Named Theme
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('theme-name', themeName);

    // Update status bar and theme color
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      if (themeName === 'gemini') {
        themeColorMeta.setAttribute('content', isDarkMode ? '#131314' : '#ffffff');
      } else if (themeName === 'apple') {
        themeColorMeta.setAttribute('content', isDarkMode ? '#000000' : '#f5f5f7');
      } else {
        themeColorMeta.setAttribute('content', isDarkMode ? '#0c1117' : '#ffffff');
      }
    }
  }, [isDarkMode, themeName]);

  // Listen for system theme changes
  useEffect(() => {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Only update if user hasn't manually set a preference
      const savedTheme = localStorage.getItem('theme');
      if (!savedTheme) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const value = {
    isDarkMode,
    toggleDarkMode,
    themeName,
    setThemeName
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};