export const languageExtensions: Record<string, string> = {
  // JavaScript/TypeScript
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  jsx: 'jsx',
  tsx: 'tsx',

  // Python
  python: 'py',
  py: 'py',

  // Web
  html: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',

  // Markup
  markdown: 'md',
  md: 'md',
  xml: 'xml',
  json: 'json',
  yaml: 'yaml',
  yml: 'yml',
  toml: 'toml',

  // Shell
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  zsh: 'sh',
  fish: 'fish',
  powershell: 'ps1',
  ps1: 'ps1',

  // Systems
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cxx: 'cpp',
  h: 'h',
  hpp: 'hpp',
  rust: 'rs',
  rs: 'rs',
  go: 'go',
  java: 'java',
  kotlin: 'kt',
  kt: 'kt',
  swift: 'swift',

  // Scripting
  ruby: 'rb',
  rb: 'rb',
  php: 'php',
  perl: 'pl',
  pl: 'pl',
  lua: 'lua',

  // Data/Config
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',

  // .NET
  csharp: 'cs',
  'c#': 'cs',
  cs: 'cs',
  fsharp: 'fs',
  'f#': 'fs',
  fs: 'fs',

  // Functional
  haskell: 'hs',
  hs: 'hs',
  elixir: 'ex',
  ex: 'ex',
  erlang: 'erl',
  erl: 'erl',
  clojure: 'clj',
  clj: 'clj',

  // Other
  r: 'r',
  matlab: 'm',
  dart: 'dart',
  scala: 'scala',
  groovy: 'groovy',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  makefile: 'makefile',
  make: 'makefile',

  // Default
  text: 'txt',
  txt: 'txt',
  plaintext: 'txt',
};

/**
 * Gets the file extension for a given language name
 * @param lang Language name (case-insensitive)
 * @returns File extension without the dot
 */
export function getLanguageExtension(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return languageExtensions[normalized] || normalized || 'txt';
}
